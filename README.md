This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## WebSocket testing

Run `docker compose up -d`, `npx prisma migrate deploy`, `npx prisma generate`, then `npm run dev`. Sign in, select a workspace and open **WebSocket** at `/realtime`. Enter a WebSocket URL and connect. Send text, JSON or a base64-encoded binary message. Expand timeline entries to inspect their original payloads. Use **Run history** to reopen previous attempts and **Older events** to read beyond the live window.

Choose a collection, enter a connection name and select **Save to collection** to reuse the settings. Use `{{secret}}` in a header or parameter value to supply a credential for that connection. Runtime credentials stay in memory. Message payloads are stored as entered.

### Runtime

Deploy a single long-lived Node.js instance with PostgreSQL. The Node process owns upstream WebSocket connections and pushes committed events to the browser using server-sent events. Configure any reverse proxy to stream `/api/realtime` responses without buffering. Running multiple app processes against the same database requires a shared connection manager first. On the first authorized request after a process restart, unfinished runs are marked interrupted.

Messages are limited to 64 KiB, handshakes to 10 seconds and connections to 30 minutes. The live window displays up to 100 events. History pages contain 50 entries. The server accepts public destinations by default. Auto-reconnect runs while the tester is open and allows three retries after the initial attempt.

### Local integration test

Start the local dev server with `WS_LOCAL_FIXTURE=1 npm run dev`, then run `node tests/realtime.mjs` in another terminal. The test uses temporary users, a collection and a loopback echo server. Set `WS_TEST_BASE` if the app is listening on a different port. The fixture flag allows loopback only in development.

### Test the WebSocket editor by hand

1. Start PostgreSQL with `docker compose up -d`. Run `npx prisma migrate deploy` and `npx prisma generate`. Restart the app with `WS_LOCAL_FIXTURE=1 npm run dev` so the dev server can connect to the loopback fixture.
2. In another terminal run `node tests/websocket-fixture.mjs`. Open `/realtime`, select a workspace and enter `ws://127.0.0.1:8787`. Use the paths below on that same endpoint.
3. Open an event to inspect its payload. Open **Connection details** to inspect the stored run.

| Check | Action and expected result |
| --- | --- |
| Live connection | Click Connect. The status becomes connected and the timeline shows the handshake. Disconnect ends the run with close code 1000. |
| Message formats | Send text `hello`, JSON `{"hello":1}`, and binary `AP8=` in their respective formats. Each send produces a sent event and a matching received event. The binary event contains two bytes. Malformed JSON produces an error and no received event. |
| Ping | Click Ping. Look for **ping sent** and **pong received**. |
| Handshake settings | Before connecting to `/inspect`, add parameter `sample=one`, header `X-Test: two`, and subprotocol `chat`. The first received message reports all three. Disable a row and reconnect to see it omitted or null. |
| Runtime credentials | Add header `Authorization` with value `{{secret}}` and enter a dummy runtime value. Connect to `/inspect`. The fixture reports `hasAuthorization: true`. Inspect the run snapshot and reopen the saved configuration to verify the runtime value was excluded. |
| Collection lifecycle | Create a collection in the workspace if needed. Enter a connection name, choose the collection and save. Reopen it from the collection folder, rename it and save again. Deleting the definition removes it from the picker. Earlier runs remain in History. |
| Persistence and pagination | Connect to `/burst`. Refresh the page. Use Older events to find payload `0` and Return to live to find `119`. Review the run again after disconnecting. |
| Failures and retries | Connect to `/reject` for handshake status 401, then `/close` for close code 1001. Enable retry and connect to `/close` again. History shows up to four attempts. Repeat and click Disconnect during backoff to cancel the remaining retries. |
| Workspace isolation | Switch to a second workspace and check its collection and history pickers. Run `node tests/realtime.mjs` to verify that another user receives HTTP 403 when reading or controlling the first user's run. |

## Workspace access and invitations

Open **Invite** in the workspace header. **Invite Members** configures the role, permissions, expiration, and usage limit of a shareable link. **Manage Members** lists people, their status and join date, member actions, workspace settings, and recent activity. The workspace creator always retains administrative access.

| Role | Default access |
| --- | --- |
| Admin | Manage workspace content, members, invitations, settings, and activity. Only admins can delete content. |
| Editor | View content, edit collections, create and edit requests, and post updates. An admin can explicitly allow an editor to share existing view-only invitation links. |
| Member | View the workspace and its saved content. Creating requests, editing, commenting, and inviting are disabled by default. |

Each invitation grants its configured permissions when accepted. Regenerating a link revokes the previous link in the same transaction. Revoking a link affects future joins. Use **Suspend access** or **Remove member** for someone who has already joined. A suspended member requires admin restoration. A removed member needs an invitation issued after removal to rejoin.

### Deployment

1. Set the application's PostgreSQL connection, OAuth configuration, public Better Auth URL, and a stable, high-entropy server-side `BETTER_AUTH_SECRET` in each deployment environment.
2. Run `npx prisma migrate deploy` against that environment, then `npm run build`. The migrations backfill owner memberships and attribute older requests and WebSocket definitions to the workspace creator.
3. Serve the application over HTTPS. Exclude `/invite/*` paths from hosting, reverse-proxy, and analytics access logs or redact the token segment. The application suppresses those incoming request paths in Next.js development logs.
4. Invitation records store a token hash. Recovering a shareable URL for an authorized user uses the signing secret. After rotating that secret, regenerate existing links to distribute them again.

### Routes

| Route | Purpose |
| --- | --- |
| `GET /invite/[token]` | Validate a link, set a short-lived HTTP-only continuation cookie, and redirect to sign-in or the join page. |
| `/join` | Show the workspace and granted permissions. The Join Workspace action accepts the invitation and opens that workspace. |
| `POST /api/invitations/accept` | Authenticated JSON acceptance with a token. Returns the joined workspace ID. |
| `GET /api/workspaces/[workspace]/access` | Return current access, members, permitted invitations, and recent activity. Add `?activity=1&before=<event-id>` to page through older activity. |
| `POST /api/workspaces/[workspace]/access` | Generate, share, replace, and revoke links, update roles and restrictions, post updates, rename, or delete a workspace. |

Generate and accept operations are rate-limited per authenticated user in PostgreSQL. Redemption and membership changes lock the workspace row. Content mutations check permissions on the server, including the existing collection and request server actions and the WebSocket API.

### Verify locally

Start the app with the local PostgreSQL migrations applied. Run `node tests/workspace-access.mjs` to exercise invitation limits, authenticated joins, cross-workspace isolation, editing grants, admin-only deletion, suspensions, and audit retention. The test creates and cleans up temporary accounts and workspaces. Set `WS_TEST_BASE=http://127.0.0.1:PORT` if the app uses another port. The WebSocket regression suite above additionally requires `WS_LOCAL_FIXTURE=1` on the development server.

Invitation links use the verified production domain supplied by Vercel. To use that domain during local development or override it with a custom domain, set `INVITE_BASE_URL` to the full HTTPS origin in `.env.local`. Generate shared invitations in the environment whose database will process the join.
