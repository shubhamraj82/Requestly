import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

// Next dev can retain a client from before the WebSocket migration across HMR.
const cached = globalThis.prisma;
const db = cached?.socketRun
  ? cached
  : new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });

if (process.env.NODE_ENV === "development") globalThis.prisma = db;

export default db;
