import { EventEmitter } from "node:events";
import { lookup } from "node:dns/promises";
import { validateHeaderName, validateHeaderValue } from "node:http";
import ipaddr from "ipaddr.js";
import WebSocket from "ws";
import type { Prisma } from "@prisma/client";
import db from "@/lib/db";
import type { Settings } from "../settings";

const limit = 65536;
type Active = {
  ws: WebSocket;
  record: (
    kind: string,
    payload?: string,
    format?: string,
    update?: Prisma.SocketRunUpdateInput,
  ) => Promise<void>;
};
const shared = globalThis as typeof globalThis & {
  socketSignals?: EventEmitter;
  socketClients?: Map<string, Active>;
  socketRecovery?: Promise<unknown>;
};
const clients = (shared.socketClients ??= new Map());
const signals = (shared.socketSignals ??= new EventEmitter());
let revision = 0;
function notify(id: string) {
  revision++;
  signals.emit(id);
}
export function workspaceChanged(id: string) {
  signals.emit("workspace:" + id);
}
export function workspaceStream(id: string, signal: AbortSignal) {
  const encoder = new TextEncoder();
  let cleanup = () => {};
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const push = () => {
        if ((controller.desiredSize ?? 0) > 0)
          controller.enqueue(encoder.encode("retry: 250\ndata: changed\n\n"));
      };
      const finish = () => {
        cleanup();
        controller.close();
      };
      const timer = setTimeout(finish, 30000);
      cleanup = () => {
        clearTimeout(timer);
        signals.off("workspace:" + id, push);
        signal.removeEventListener("abort", finish);
      };
      signals.on("workspace:" + id, push);
      signal.addEventListener("abort", finish, { once: true });
      if (signal.aborted) finish();
      else push();
    },
    cancel() {
      cleanup();
    },
  });
}
export function eventRevision() {
  return revision;
}
export function waitForCommit(
  id: string,
  previous: number,
  signal: AbortSignal,
) {
  if (previous !== revision || signal.aborted) return Promise.resolve();
  return new Promise<void>((resolve) => {
    function finish() {
      clearTimeout(timer);
      signals.off(id, finish);
      signal.removeEventListener("abort", finish);
      resolve();
    }
    const timer = setTimeout(finish, 5000);
    signals.once(id, finish);
    signal.addEventListener("abort", finish, { once: true });
  });
}
export function recover() {
  return (shared.socketRecovery ??= db.socketRun
    .updateMany({
      where: { endedAt: null },
      data: {
        endedAt: new Date(),
        status: "interrupted",
        error: "Server restarted",
      },
    })
    .catch((error) => {
      delete shared.socketRecovery;
      throw error;
    }));
}

export function destination(
  settings: Settings,
  secrets?: Record<string, string>,
) {
  const url = new URL(settings.url);
  if (
    !["wss:", "ws:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash
  )
    throw Error("Enter a ws:// or wss:// URL without credentials or fragment");
  for (const pair of settings.parameters)
    if (pair.enabled) {
      const value =
        secrets && pair.value === "{{secret}}" ? secrets[pair.key] : pair.value;
      if (value === undefined) throw Error("Missing runtime parameter");
      url.searchParams.append(pair.key, value);
    }
  return url;
}

function allowed(address: string) {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.WS_LOCAL_FIXTURE === "1" &&
    address === "127.0.0.1"
  )
    return true;
  return ipaddr.process(address).range() === "unicast";
}

export function start(
  id: string,
  workspaceId: string,
  settings: Settings,
  secrets: Record<string, string>,
) {
  const url = destination(settings, secrets);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (ipaddr.isValid(host) && !allowed(host))
    throw Error("Destination address is restricted");
  const headers: Record<string, string> = Object.create(null);
  for (const { key, value, enabled } of settings.headers) {
    if (!enabled) continue;
    if (
      /^(host|connection|upgrade|sec-websocket-.*|proxy-.*|transfer-encoding|content-length)$/i.test(
        key,
      )
    )
      throw Error("Reserved handshake header");
    validateHeaderName(key);
    const resolved = value === "{{secret}}" ? secrets[key] : value;
    if (resolved === undefined) throw Error("Missing runtime header value");
    validateHeaderValue(key, resolved);
    headers[key] = resolved;
  }
  if (clients.size >= 100) throw Error("Connection capacity reached");
  const ws = new WebSocket(url, settings.protocols, {
    headers,
    maxPayload: limit,
    handshakeTimeout: 10000,
    perMessageDeflate: false,
    autoPong: false,
    lookup: (name, options, done) => {
      lookup(name, { all: true, family: options.family })
        .then((addresses) => {
          if (!addresses.length || addresses.some((a) => !allowed(a.address)))
            throw Error("Restricted destination");
          if (options.all) done(null, addresses);
          else done(null, addresses[0].address, addresses[0].family);
        })
        .catch(() => done(Error("Destination lookup failed"), "", 4));
    },
  });
  let sequence = 0,
    pending = 0,
    failed = false;
  let writes = Promise.resolve();
  let handshakeStatus: number | undefined;
  const record: Active["record"] = (
    kind,
    payload = "",
    format = "text",
    update,
  ) => {
    if (failed || pending >= 128) {
      ws.terminate();
      return Promise.reject(Error("Event queue unavailable"));
    }
    const seq = ++sequence,
      createdAt = new Date();
    pending++;
    if (pending >= 32 && ws.readyState === WebSocket.OPEN) ws.pause();
    const write = writes.then(async () => {
      if (failed) throw Error("History unavailable");
      await db.$transaction(async (tx) => {
        await tx.socketEvent.upsert({
          where: { runId_seq: { runId: id, seq } },
          update: {},
          create: {
            runId: id,
            seq,
            kind,
            payload,
            format,
            bytes: Buffer.byteLength(
              payload,
              format === "binary" ? "base64" : "utf8",
            ),
            createdAt,
          },
        });
        if (update) await tx.socketRun.update({ where: { id }, data: update });
      });
      notify(id);
      if (update) workspaceChanged(workspaceId);
    });
    writes = write
      .catch(async () => {
        failed = true;
        notify(id);
        ws.terminate();
        await db.socketRun
          .update({
            where: { id },
            data: {
              status: "error",
              error: "Event persistence failed",
              endedAt: new Date(),
            },
          })
          .catch(() => {});
      })
      .finally(() => {
        pending--;
        if (pending <= 16 && ws.isPaused) ws.resume();
      });
    return write;
  };
  const emit = (...args: Parameters<typeof record>) => {
    void record(...args).catch(() => {});
  };
  clients.set(id, { ws, record });
  const timeout = setTimeout(() => ws.terminate(), 30 * 60_000);
  emit("connecting");
  const noteHandshake = (res: import("node:http").IncomingMessage) => {
    handshakeStatus = res.statusCode;
    emit(
      "handshake",
      JSON.stringify({
        status: handshakeStatus,
        headers: Object.keys(res.headers),
      }),
      "json",
    );
  };
  ws.on("upgrade", noteHandshake);
  ws.on("unexpected-response", (req, res) => {
    noteHandshake(res);
    res.destroy();
    req.destroy();
    ws.terminate();
  });
  ws.on("open", () =>
    emit("connected", "", "text", {
      status: "connected",
      handshakeStatus,
      protocol: ws.protocol,
    }),
  );
  ws.on("message", (raw, binary) =>
    emit(
      "received",
      Buffer.from(raw as Buffer).toString(binary ? "base64" : "utf8"),
      binary ? "binary" : "text",
    ),
  );
  ws.on("ping", (data) => {
    const payload = data.toString("base64");
    emit("ping received", payload, "binary");
    if (ws.readyState === WebSocket.OPEN)
      ws.pong(data, true, (error) => {
        if (error) emit("send failed", "Pong failed");
        else emit("pong sent", payload, "binary");
      });
  });
  ws.on("pong", (data) =>
    emit("pong received", data.toString("base64"), "binary"),
  );
  ws.on("error", () =>
    emit("error", "Connection or handshake failed", "text", {
      status: "error",
      error: "Connection or handshake failed",
      handshakeStatus,
    }),
  );
  ws.on("close", (code, reason) => {
    clearTimeout(timeout);
    clients.delete(id);
    // Reserve room for the terminal event after queued messages drain.
    void writes.then(() =>
      emit("closed", reason.toString(), "text", {
        status: "closed",
        endedAt: new Date(),
        closeCode: code,
        closeReason: reason.toString(),
        handshakeStatus,
      }),
    );
  });
}

export async function command(
  id: string,
  action: string,
  format: string,
  payload: string,
) {
  const client = clients.get(id);
  if (!client) throw Error("Connection is no longer active");
  const { ws, record } = client;
  if (action === "disconnect") {
    if (ws.readyState === WebSocket.CONNECTING) ws.terminate();
    else ws.close(1000, "Disconnected");
    return;
  }
  if (ws.readyState !== WebSocket.OPEN || ws.bufferedAmount > limit)
    throw Error("Socket is unavailable");
  if (format === "json") JSON.parse(payload);
  const data = Buffer.from(payload, format === "binary" ? "base64" : "utf8");
  if (format === "binary" && data.toString("base64") !== payload)
    throw Error("Expected a base64 payload");
  if (data.length > limit) throw Error("Message exceeds 64 KiB");
  await new Promise<void>((resolve, reject) => {
    const done = (err?: Error | null) =>
      err ? reject(Error("Send failed")) : resolve();
    if (action === "ping") ws.ping("", true, done);
    else ws.send(data, { binary: format === "binary" }, done);
  }).catch(async (error) => {
    await record("send failed");
    throw error;
  });
  await record(action === "ping" ? "ping sent" : "sent", payload, format);
}
