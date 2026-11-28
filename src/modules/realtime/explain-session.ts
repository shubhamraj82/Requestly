type LogEntry = { seq: number; kind: string; format: string; payload: string };
export type Observation = { seq: number; text: string; attention?: boolean };
export type SessionExplanation = { through: number; observations: Observation[] };

function object(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function fields(row: LogEntry) {
  if (row.format === "binary" || !row.payload.trimStart().startsWith("{")) return {};
  try { return object(JSON.parse(row.payload)); } catch { return {}; }
}

function excerpt(value: string) {
  const line = value.trim().replace(/\s+/g, " ");
  return line.length > 160 ? line.slice(0, 159) + "…" : line;
}

function serverError(row: LogEntry, data: Record<string, unknown>) {
  if (row.format === "binary") return;
  const tags = [data.type, data.event, data.status].filter((tag): tag is string => typeof tag === "string").map(tag => tag.toLowerCase());
  const subscriptionRejected = tags.includes("subscription_error") || tags.includes("subscription_rejected");
  if (subscriptionRejected || tags.some(tag => ["error", "failed", "rejected"].includes(tag))
    || typeof data.error === "string" && data.error.trim()
    || Object.keys(object(data.error)).length > 0) {
    const detail = [data.error, object(data.error).message, object(data.error).reason, data.message, data.reason, data.code]
      .find((field): field is string => typeof field === "string" && !!field.trim());
    const message = subscriptionRejected ? "The server rejected the subscription" : "The server reported an error";
    return detail ? `${message}: “${excerpt(detail)}”.` : `${message}.`;
  }
  if (/^\s*(?:error\s*:|subscription (?:failed|rejected)\b)/i.test(row.payload))
    return `The server reported “${excerpt(row.payload)}”.`;
}

export type SessionState = {
  through: number;
  sent: number;
  received: number;
  facts: Record<string, Observation>;
};

function emptySession(): SessionState {
  return { through: 0, sent: 0, received: 0, facts: {} };
}

// The history reader and the live timeline apply the same rules to ordered log entries.
export function advanceSession(state: SessionState, rows: LogEntry[]): SessionState {
  let { through, sent, received } = state;
  const facts = { ...state.facts };
  for (const row of rows) {
    if (row.seq <= through) continue;
    through = row.seq;
    const fact = (key: string, text: string, attention = false) => {
      facts[key] = { seq: row.seq, text, attention };
    };
    switch (row.kind) {
      case "connecting": fact("start", "The connection attempt started."); break;
      case "connected":
        delete facts.start;
        fact("open", "The connection opened.");
        break;
      case "handshake": {
        const status = fields(row).status;
        if (typeof status === "number" && status !== 101)
          fact("handshake", `The handshake returned HTTP ${status}.`, true);
        break;
      }
      case "sent": {
        sent++;
        const data = fields(row);
        if ([data.action, data.type, data.op, data.method, data.event].some(
          value => typeof value === "string" && value.toLowerCase() === "subscribe"
        )) {
          fact("subscription", "The client requested a subscription.");
        }
        fact("sent", `The client sent ${sent} ${sent === 1 ? "message" : "messages"}.`);
        break;
      }
      case "received": {
        const error = serverError(row, fields(row));
        if (error) fact("serverError", error, true);
        else {
          received++;
          fact("received", `${received === 1 ? "One server message arrived" : `${received} server messages arrived`} without an explicit error.`);
        }
        break;
      }
      case "error":
      case "send failed":
        fact(row.kind, row.payload ? excerpt(row.payload) : row.kind === "error" ? "The connection failed." : "Sending a message failed.", true);
        break;
      case "closed": fact("close", row.payload ? `The connection closed with reason “${excerpt(row.payload)}”.` : "The connection closed."); break;
    }
  }
  return { through, sent, received, facts };
}

export function describeSession(state: SessionState): SessionExplanation {
  const { through, sent, received } = state;
  const facts = new Map(Object.entries(state.facts));
  if (facts.has("subscription") && sent === 1) facts.delete("sent");
  const error = facts.get("serverError");
  if (error && (facts.get("received")?.seq ?? 0) < error.seq)
    facts.set("silence", { seq: through, text: "No further updates were recorded after the server error." });
  else if (!received && !error && facts.has("open"))
    facts.set("silence", { seq: through, text: "No server messages were recorded through this entry." });
  if (through && !facts.size) facts.set("last", {seq: through, text: "This is the latest recorded event."});
  return { through, observations: [...facts.values()].sort((a, b) => a.seq - b.seq) };
}

export async function readSession(
  through: number,
  read: (after: number, through: number) => Promise<LogEntry[]>,
): Promise<SessionState> {
  let state = emptySession();
  while (state.through < through) {
    const rows = await read(state.through, through);
    if (!rows.length) break;
    state = advanceSession(state, rows);
  }
  return state;
}
