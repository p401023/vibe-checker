import express from "express";
import { createClient } from "@libsql/client/http";
import Pusher from "pusher";
import * as dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!.replace(/^libsql:\/\//, "https://"),
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

const STALE_THRESHOLD_MS = 10 * 60 * 1000;

async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      vibe TEXT,
      last_seen INTEGER NOT NULL
    )
  `);
}

initDb()
  .then(() => console.log("[api] DB ready"))
  .catch((e) => console.error("[api] DB init failed:", e));

app.get("/api/users", async (_req, res) => {
  try {
    const cutoff = Date.now() - STALE_THRESHOLD_MS;
    const result = await db.execute({
      sql: "SELECT * FROM users WHERE last_seen > ?",
      args: [cutoff],
    });
    const users: Record<string, { name: string; vibe: string | null; lastSeen: number }> = {};
    for (const row of result.rows) {
      users[row.id as string] = {
        name: row.name as string,
        vibe: row.vibe as string | null,
        lastSeen: row.last_seen as number,
      };
    }
    res.json(users);
  } catch (e) {
    console.error("[api] GET /api/users error:", e);
    res.status(500).json({ error: String(e) });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const { id, name, vibe } = req.body;
    if (!id || !name) { res.status(400).json({ error: "id and name required" }); return; }
    const lastSeen = Date.now();
    await db.execute({
      sql: `INSERT INTO users (id, name, vibe, last_seen) VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              vibe = excluded.vibe,
              last_seen = excluded.last_seen`,
      args: [id, name, vibe ?? null, lastSeen],
    });
    await pusher.trigger("vibe-checker", "user-updated", { id, name, vibe: vibe ?? null, lastSeen });
    res.json({ ok: true });
  } catch (e) {
    console.error("[api] POST /api/users error:", e);
    res.status(500).json({ error: String(e) });
  }
});

app.post("/api/leave", async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) { res.status(400).json({ error: "id required" }); return; }
    await db.execute({ sql: "DELETE FROM users WHERE id = ?", args: [id] });
    await pusher.trigger("vibe-checker", "user-removed", { id });
    res.json({ ok: true });
  } catch (e) {
    console.error("[api] POST /api/leave error:", e);
    res.status(500).json({ error: String(e) });
  }
});

app.post("/api/heartbeat", async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) { res.status(400).json({ error: "id required" }); return; }
    await db.execute({
      sql: "UPDATE users SET last_seen = ? WHERE id = ?",
      args: [Date.now(), id],
    });
    res.json({ ok: true });
  } catch (e) {
    console.error("[api] POST /api/heartbeat error:", e);
    res.status(500).json({ error: String(e) });
  }
});

app.listen(3001, () => console.log("[api] Server running on http://localhost:3001"));
