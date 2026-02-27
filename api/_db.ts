import { createClient } from "@libsql/client/http";

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL!.replace(/^libsql:\/\//, "https://"),
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      vibe TEXT,
      last_seen INTEGER NOT NULL
    )
  `);
}
