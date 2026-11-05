import "server-only";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import * as schema from "./schema";
import { DB_PATH, SCREENSHOTS_DIR } from "@/lib/paths";

mkdirSync(SCREENSHOTS_DIR, { recursive: true });

// Reuse the connection across hot-reloads in dev.
const globalForDb = globalThis as unknown as {
  __sqlite?: Database.Database;
};

const sqlite =
  globalForDb.__sqlite ??
  (() => {
    const conn = new Database(DB_PATH);
    conn.pragma("journal_mode = WAL");
    conn.pragma("foreign_keys = ON");
    return conn;
  })();

if (process.env.NODE_ENV !== "production") globalForDb.__sqlite = sqlite;

export const db = drizzle(sqlite, { schema });
export { schema };
