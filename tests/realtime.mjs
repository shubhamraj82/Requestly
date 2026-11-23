// Run against a local development server started with WS_LOCAL_FIXTURE=1.
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { startFixture } from "./websocket-fixture.mjs";
import { setTimeout as pause } from "node:timers/promises";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
const base = new URL(process.env.WS_TEST_BASE || "http://127.0.0.1:3000");
assert.equal(base.hostname, "127.0.0.1");
const db = new PrismaClient();
const fixture = await startFixture();
const userId = randomUUID(),
  outsider = randomUUID();
async function identity(id) {
  const token = randomUUID();
  await db.user.create({
    data: {
      id,
      email: id + "@example.invalid",
      name: "Socket test",
      sessions: {
        create: {
          id: randomUUID(),
          token,
          expiresAt: new Date(Date.now() + 600000),
        },
      },
    },
  });
  return (
    "better-auth.session_token=" +
    encodeURIComponent(
      token +
        "." +
        createHmac("sha256", process.env.BETTER_AUTH_SECRET)
          .update(token)
          .digest("base64"),
    )
  );
}
const workspace = randomUUID();
try {
  const cookie = await identity(userId),
    otherCookie = await identity(outsider);
  await db.workspace.create({
    data: { id: workspace, ownerId: userId, name: "Socket test" },
  });
  const collection = await db.collection.create({
    data: { workspaceId: workspace, name: "Socket test" },
  });
  const http = async (params = {}, body, who = cookie) =>
    fetch(
      new URL(
        "/api/realtime?" + new URLSearchParams({ workspace, ...params }),
        base,
      ),
      {
        method: body ? "POST" : "GET",
        headers: { cookie: who, "content-type": "application/json" },
        body: body ? JSON.stringify({ workspace, ...body }) : undefined,
      },
    );
  const json = async (res) => {
    assert.equal(res.status, 200);
    return res.json();
  };
  const post = async (body) => json(await http({}, body));
  const detail = async (run, extra = {}) => json(await http({ run, ...extra }));
  const wait = async (id, predicate) => {
    for (let i = 0; i < 100; i++) {
      const d = await detail(id);
      if (predicate(d)) return d;
      await pause(60);
    }
    throw Error("Timed out waiting for run state");
  };
  const url = "ws://127.0.0.1:" + fixture.address().port;
  const settings = {
    url,
    parameters: [],
    headers: [],
    protocols: [],
    format: "text",
    draft: "",
    reconnect: false,
  };
  const inspected = await post({
    action: "connect",
    settings: {
      ...settings,
      url: url + "/inspect",
      protocols: ["chat"],
      parameters: [{ key: "sample", value: "one", enabled: true }],
      headers: [
        { key: "X-Test", value: "two", enabled: true },
        { key: "Authorization", value: "{{secret}}", enabled: true },
      ],
    },
    secrets: { Authorization: "fixture-runtime-value" },
  });
  const inspection = await wait(inspected.id, (d) =>
    d.events.some((e) => e.kind === "received"),
  );
  assert.deepEqual(
    JSON.parse(inspection.events.find((e) => e.kind === "received").payload),
    {
      sample: "one",
      testHeader: "two",
      hasAuthorization: true,
      protocol: "chat",
    },
  );
  assert.ok(!JSON.stringify(inspection).includes("fixture-runtime-value"));
  assert.equal(
    (
      await http(
        {},
        { action: "send", id: inspected.id, format: "json", payload: "{" },
      )
    ).status,
    400,
  );
  await post({ action: "disconnect", id: inspected.id });
  await wait(inspected.id, (d) => d.run.endedAt);
  const saved = await post({
    action: "save",
    settings,
    collection: collection.id,
    name: "Echo",
  });
  const { id } = await post({ action: "connect", settings, id: saved.id });
  await wait(id, (d) => d.run.status === "connected");
  const controller = new AbortController();
  const stream = await fetch(
    new URL(
      "/api/realtime?" +
        new URLSearchParams({ workspace, run: id, stream: "1", after: "2" }),
      base,
    ),
    { headers: { cookie }, signal: controller.signal },
  );
  assert.equal(stream.status, 200);
  const reader = stream.body.getReader(),
    decoder = new TextDecoder();
  const streamed = (async () => {
    let data = "";
    while (!data.includes('"kind":"received"')) {
      const chunk = await reader.read();
      assert.ok(!chunk.done);
      data += decoder.decode(chunk.value);
    }
    controller.abort();
  })();
  try {
    for (const [format, payload] of [
      ["text", "hello"],
      ["json", ' { "value": 1 } '],
      ["binary", "AP8="],
    ])
      await post({ action: "send", id, format, payload });
    await Promise.race([
      streamed,
      pause(5000).then(() => {
        throw Error("Missing live event");
      }),
    ]);
  } finally {
    controller.abort();
  }
  await post({ action: "ping", id });
  const live = await wait(id, (d) =>
    d.events.some((e) => e.kind === "pong received"),
  );
  for (const payload of ["hello", ' { "value": 1 } ', "AP8="])
    assert.ok(
      live.events.some((e) => e.kind === "received" && e.payload === payload),
    );
  assert.equal((await http({ run: id }, undefined, otherCookie)).status, 403);
  assert.equal(
    (await http({}, { action: "disconnect", id }, otherCookie)).status,
    403,
  );
  await post({ action: "disconnect", id });
  await wait(id, (d) => d.run.endedAt);
  await post({
    action: "save",
    id: saved.id,
    collection: collection.id,
    name: "Changed",
    settings: { ...settings, url: url + "/changed" },
  });
  assert.equal((await detail(id)).run.snapshot.url, url + "/");
  for (const path of ["/reject", "/close", "/burst"]) {
    const run = await post({
      action: "connect",
      settings: { ...settings, url: url + path },
    });
    if (path === "/burst") {
      await wait(run.id, (d) => d.events.at(-1)?.seq >= 122);
      await post({ action: "disconnect", id: run.id });
      await wait(run.id, (d) => d.run.endedAt);
      let rows = (await detail(run.id)).events;
      while (rows[0].seq > 1)
        rows = [
          ...(await detail(run.id, { before: String(rows[0].seq) })).events,
          ...rows,
        ];
      assert.deepEqual(
        rows.filter((e) => e.kind === "received").map((e) => e.payload),
        Array.from({ length: 120 }, (_, i) => String(i)),
      );
      assert.equal(new Set(rows.map((e) => e.seq)).size, rows.length);
    } else {
      const { run: result } = await wait(run.id, (d) => d.run.endedAt);
      if (path === "/reject") assert.equal(result.handshakeStatus, 401);
      else assert.equal(result.closeCode, 1001);
    }
  }
  console.log(
    "Passed authenticated live stream, echo, ping, binary, snapshots, access control, handshake failure, peer close and 120-message history.",
  );
} finally {
  for (const client of fixture.clients) client.terminate();
  fixture.close();
  await db.workspace.deleteMany({ where: { id: workspace } });
  await db.user.deleteMany({ where: { id: { in: [userId, outsider] } } });
  await db.$disconnect();
}
