import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db, initDb } from "./_db";
import { pusher } from "./_pusher";

const STALE_THRESHOLD_MS = 10 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await initDb();

    if (req.method === "GET") {
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
      return res.json(users);
    }

    if (req.method === "POST") {
      const { id, name, vibe } = req.body;
      if (!id || !name) return res.status(400).json({ error: "id and name required" });

      const lastSeen = Date.now();
      await db.execute({
        sql: `INSERT INTO users (id, name, vibe, last_seen) VALUES (?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                vibe = excluded.vibe,
                last_seen = excluded.last_seen`,
        args: [id, name, vibe ?? null, lastSeen],
      });

      await pusher.trigger("vibe-checker", "user-updated", {
        id,
        name,
        vibe: vibe ?? null,
        lastSeen,
      });

      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("api/users error:", e);
    return res.status(500).json({ error: String(e) });
  }
}
