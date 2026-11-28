import assert from "node:assert/strict";
import test from "node:test";
import { advanceSession, describeSession, readSession } from "../src/modules/realtime/explain-session.ts";

async function summarize(frames, through = frames.length) {
  const rows = frames.map(([kind, payload = "", format = "text"], i) => ({
    seq: i + 1, kind, payload, format,
  }));
  return describeSession(await readSession(through, async (after, end) => rows.slice(after, Math.min(after + 2, end))));
}

test("subscription rejection cites the request, rejection reason and observation boundary", async () => {
  const frames = [
    ["connected"], ["sent", '{"op":"subscribe"}'],
    ["received", '{"type":"subscription_rejected","reason":"channel is missing"}'],
    ["pong received"], ["closed"], ["received", "later update"],
  ];
  const { observations, through } = await summarize(frames, 5);
  assert.equal(through, 5);
  assert.deepEqual(observations.map(o => o.seq), [1, 2, 3, 5, 5]);
  assert.match(observations[2].text, /rejected the subscription.*channel is missing/);
  assert.equal(observations[2].attention, true);
  assert.match(observations.at(-1).text, /No further updates/);
  assert.ok(!(await summarize(frames)).observations.some(o => o.text.includes("No further updates")));
});

test("arbitrary messages and binary data do not imply a rejection", async () => {
  const frames = [
    ["connected"], ["sent", '{"type":"subscribe"}'],
    ["received", '{"error":false}'], ["received", "{invalid"], ["received", "ERROR: missing", "binary"],
    ["received", '{"type":{"toString":false}}'], ["received", "a chat message about an error"],
  ];
  const { observations } = await summarize(frames);
  assert.ok(observations.every(o => !o.attention));
  assert.match(observations.at(-1).text, /5 server messages/);
});

test("handshake and send failures cite their own log entries", async () => {
  const { observations } = await summarize([
    ["connecting"], ["handshake", '{"status":401}'], ["error", "Connection or handshake failed"],
    ["send failed"], ["closed", "bye"],
  ]);
  assert.deepEqual(observations.filter(o => o.attention).map(o => o.seq), [2, 3, 4]);
  assert.match(observations[1].text, /401/);
  assert.ok(!observations.some(o => o.text.includes("opened")));
});

test("empty, quiet and unrecognized histories retain accurate boundaries", async () => {
  assert.deepEqual(await summarize([]), { through: 0, observations: [] });
  const { observations } = await summarize([["connected"], ["ping received"]]);
  assert.match(observations[1].text, /No server messages/);
  assert.equal(observations[1].seq, 2);
  assert.equal((await summarize([["other"]])).observations[0].seq, 1);
});

test("quotes nested or plain server errors without guessing a missing field", async () => {
  for (const payload of ['{"error":{"message":"channel required"}}', "Subscription rejected: channel required"]) {
    const { observations } = await summarize([["received", payload]]);
    assert.match(observations[0].text, /channel required/);
    assert.equal(observations[0].seq, 1);
  }
});

test("a live message supersedes silence and replayed entries are counted once", async () => {
  const history = await readSession(1, async () => [
    { seq: 1, kind: "received", format: "text", payload: "Error: missing channel" },
  ]);
  const update = { seq: 2, kind: "received", format: "text", payload: "fresh update" };
  const live = advanceSession(advanceSession(history, [update]), [update]);
  assert.equal(history.through, 1);
  assert.equal(live.received, 1);
  assert.equal(live.through, 2);
  assert.ok(!describeSession(live).observations.some(item => item.text.includes("No further updates")));
});
