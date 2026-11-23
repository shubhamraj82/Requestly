import { once } from "node:events";
import { pathToFileURL } from "node:url";
import { WebSocketServer } from "ws";

export async function startFixture(port = 0) {
  const server = new WebSocketServer({
    host: "127.0.0.1",
    port,
    verifyClient: ({ req }) =>
      new URL(req.url, "http://localhost").pathname !== "/reject",
  });
  await once(server, "listening");
  server.on("connection", (ws, req) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/inspect") {
      ws.send(
        JSON.stringify({
          sample: url.searchParams.get("sample"),
          testHeader: req.headers["x-test"],
          hasAuthorization: Boolean(req.headers.authorization),
          protocol: ws.protocol,
        }),
      );
    }
    if (url.pathname === "/burst")
      for (let i = 0; i < 120; i++) ws.send(String(i));
    ws.on("message", (data, binary) => ws.send(data, { binary }));
    if (url.pathname === "/close") ws.close(1001, "fixture finished");
  });
  return server;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const server = await startFixture(8787);
  console.log(
    "WebSocket fixture listening at ws://127.0.0.1:" + server.address().port,
  );
}
