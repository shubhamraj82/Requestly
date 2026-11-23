// Run against a local app using the same local PostgreSQL database as this process.
import assert from "node:assert/strict";
import { randomUUID, createHmac, createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
const base = new URL(process.env.WS_TEST_BASE || "http://127.0.0.1:3000");
assert.equal(base.hostname, "127.0.0.1");
assert.ok(
  ["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_URL).hostname,
  ),
);
const db = new PrismaClient();
const users = [],
  spaces = [];
async function identity() {
  const id = randomUUID(),
    token = randomUUID();
  await db.user.create({
    data: {
      id,
      name: "Access test",
      email: id + "@example.invalid",
      sessions: {
        create: {
          id: randomUUID(),
          token,
          expiresAt: new Date(Date.now() + 3600000),
        },
      },
    },
  });
  users.push(id);
  return {
    id,
    cookie:
      "better-auth.session_token=" +
      encodeURIComponent(
        token +
          "." +
          createHmac("sha256", process.env.BETTER_AUTH_SECRET)
            .update(token)
            .digest("base64"),
      ),
  };
}
async function workspace(owner) {
  const w = await db.workspace.create({
    data: {
      name: "Access integration",
      ownerId: owner.id,
      members: { create: { userId: owner.id, role: "ADMIN" } },
    },
  });
  spaces.push(w.id);
  return w.id;
}
function http(path, who, body) {
  return fetch(new URL(path, base), {
    redirect: "manual",
    method: body ? "POST" : "GET",
    headers: {
      ...(who ? { cookie: who.cookie } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function expect(response, status) {
  const r = await response;
  assert.equal(
    r.status,
    status,
    "Expected HTTP " +
      status +
      "; received " +
      r.status +
      " at " +
      new URL(r.url).pathname.replace(/\/invite\/.*/, "/invite/[redacted]"),
  );
  return r;
}
try {
  const [owner, bob, alice, outsider] = await Promise.all(
    Array.from({ length: 4 }, identity),
  );
  const w = await workspace(owner),
    other = await workspace(outsider),
    path = "/api/workspaces/" + w + "/access";
  const op = (who, data) => http(path, who, data);
  const grant = {
    action: "generate",
    role: "MEMBER",
    permissions: {},
    days: 7,
    maxUses: null,
  };
  const issue = async (extra = {}) =>
    (await expect(op(owner, { ...grant, ...extra }), 200)).json();
  const accept = (who, token) =>
    http("/api/invitations/accept", who, { token });
  await expect(http(path, null), 401);
  await expect(http(path, outsider), 403);
  const link = await issue();
  assert.equal(
    (await db.workspaceInvitation.findUniqueOrThrow({ where: { id: link.id } }))
      .tokenHash,
    createHash("sha256").update(link.token).digest("hex"),
  );
  const login = await expect(http("/invite/" + link.token, null), 307);
  assert.equal(new URL(login.headers.get("location")).search, "?next=join");
  assert.ok(login.headers.get("set-cookie").includes("HttpOnly"));
  await expect(accept(bob, link.token), 200);
  await expect(accept(bob, link.token), 200);
  assert.equal(
    (await db.workspaceInvitation.findUniqueOrThrow({ where: { id: link.id } }))
      .usageCount,
    1,
  );
  const panel = async (who) => (await expect(http(path, who), 200)).json();
  const initial = await panel(bob);
  assert.deepEqual(
    Object.entries(initial.access.rights)
      .filter(([, on]) => on)
      .map(([k]) => k),
    ["view"],
  );
  assert.equal(initial.links.length, 0);
  await expect(op(bob, grant), 403);
  await expect(
    op(bob, { action: "member", userId: bob.id, role: "ADMIN" }),
    403,
  );
  await expect(
    op(owner, { action: "member", userId: owner.id, status: "REMOVED" }),
    403,
  );
  await expect(
    op(owner, { action: "member", userId: owner.id, role: "MEMBER" }),
    403,
  );
  await expect(
    op(bob, { action: "deleteWorkspace", name: "Access integration" }),
    403,
  );
  await expect(op(bob, { action: "comment", text: "Blocked" }), 403);
  const update = (extra) =>
    op(owner, { action: "member", userId: bob.id, ...extra });
  await expect(update({ role: "EDITOR" }), 200);
  assert.equal((await panel(bob)).access.rights.editAll, true);
  await expect(op(bob, { action: "comment", text: "Team update" }), 200);
  await expect(
    update({ permissions: { editAll: false, editOwn: false, invite: true } }),
    200,
  );
  assert.equal((await panel(bob)).access.rights.editAll, false);
  await expect(op(bob, { action: "share", id: link.id }), 200);
  await expect(op(bob, grant), 403);
  await expect(
    http("/api/workspaces/" + other + "/access", owner, {
      action: "revoke",
      id: link.id,
    }),
    403,
  );
  const c = await db.collection.create({
    data: { name: "test", workspaceId: w },
  });
  const socket = await db.socketDefinition.create({
    data: { name: "test", settings: {}, collectionId: c.id, authorId: bob.id },
  });
  const del = (who) =>
    http("/api/realtime", who, {
      action: "delete",
      workspace: w,
      id: socket.id,
    });
  await expect(del(bob), 403);
  const settings = {
    url: "wss://example.com/socket",
    parameters: [],
    headers: [],
    protocols: [],
    format: "text",
    draft: "",
    reconnect: false,
  };
  const save = (who, id) =>
    http("/api/realtime", who, {
      action: "save",
      workspace: w,
      collection: c.id,
      settings,
      name: "Saved request",
      id,
    });
  await expect(
    update({
      permissions: { editOwn: true, editAll: false, createRequests: false },
    }),
    200,
  );
  await expect(save(bob, socket.id), 200);
  const adminSocket = await (await expect(save(owner), 200)).json();
  await expect(save(bob, adminSocket.id), 403);
  await expect(save(bob), 403);
  await expect(
    update({ role: "MEMBER", permissions: { createRequests: true } }),
    200,
  );
  await expect(save(bob), 200);
  await expect(save(bob, socket.id), 403);
  await expect(update({ role: "MEMBER" }), 200);
  await expect(del(bob), 403);
  await expect(del(owner), 200);
  await expect(update({ status: "SUSPENDED" }), 200);
  await expect(http(path, bob), 403);
  await expect(http("/api/realtime?workspace=" + w, bob), 403);
  await expect(accept(bob, link.token), 403);
  await expect(update({ status: "ACTIVE" }), 200);
  await expect(http(path, bob), 200);
  await expect(update({ status: "REMOVED" }), 200);
  await expect(http(path, bob), 403);
  await expect(accept(bob, link.token), 403);
  const expired = await issue();
  await db.workspaceInvitation.update({
    where: { id: expired.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  await expect(accept(alice, expired.token), 410);
  const replacement = await issue({ replace: link.id });
  await expect(accept(alice, link.token), 410);
  await expect(op(owner, { action: "revoke", id: replacement.id }), 200);
  await expect(accept(alice, replacement.token), 410);
  await expect(accept(alice, "invalid"), 404);
  await expect(op(owner, { ...grant, role: "ADMIN" }), 400);
  const capped = await issue({ maxUses: 1 });
  const race = await Promise.all(
    [alice, outsider].map((who) => accept(who, capped.token)),
  );
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 410]);
  const logs = await panel(owner);
  assert.ok(logs.activity.some((a) => a.action === "invitation.revoked"));
  assert.ok(!JSON.stringify(logs).includes(link.token));
  await db.inviteRateLimit.upsert({
    where: { key: "generate:" + owner.id },
    create: {
      key: "generate:" + owner.id,
      count: 20,
      resetsAt: new Date(Date.now() + 600000),
    },
    update: { count: 20 },
  });
  await expect(op(owner, grant), 429);
  await db.inviteRateLimit.update({
    where: { key: "accept:" + alice.id },
    data: { count: 40 },
  });
  await expect(accept(alice, capped.token), 429);
  await expect(op(owner, { action: "deleteWorkspace", name: "wrong" }), 400);
  await expect(
    op(owner, { action: "deleteWorkspace", name: "Access integration" }),
    200,
  );
  assert.equal(await db.workspace.count({ where: { id: w } }), 0);
  assert.equal(
    await db.workspaceActivity.count({
      where: {
        actorId: owner.id,
        action: "workspace.deleted",
        workspaceId: null,
      },
    }),
    1,
  );
  console.log(
    "Passed invitations, login continuation, role defaults, delegation, permissions, suspension, removal, audit, admin-only delete, workspace isolation, owner protection, concurrent redemption and rate limits.",
  );
} finally {
  await db.workspaceActivity.deleteMany({ where: { actorId: { in: users } } });
  await db.workspace.deleteMany({ where: { id: { in: spaces } } });
  await db.inviteRateLimit.deleteMany({
    where: {
      key: { in: users.flatMap((id) => ["generate:" + id, "accept:" + id]) },
    },
  });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
}
