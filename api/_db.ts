import { createClient } from "@libsql/client";

// Force HTTPS so libsql uses HTTP rather than WebSockets — required for Vercel serverless
const dbUrl = process.env.TURSO_DATABASE_URL!.replace(/^libsql:\/\//, "https://");

export const db = createClient({
  url: dbUrl,
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
