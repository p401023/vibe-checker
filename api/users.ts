import type { VercelRequest, VercelResponse } from "@vercel/node";
import { initDb, getActiveUsers, upsertUser } from "./_db.js";
import { pusher } from "./_pusher.js";

const STALE_THRESHOLD_MS = 10 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await initDb();

    if (req.method === "GET") {
      const users = await getActiveUsers(Date.now() - STALE_THRESHOLD_MS);
      return res.json(users);
    }

    if (req.method === "POST") {
      const { id, name, vibe } = req.body;
      if (!id || !name) return res.status(400).json({ error: "id and name required" });

      const lastSeen = Date.now();
      await upsertUser(id, name, vibe ?? null, lastSeen);
      await pusher.trigger("vibe-checker", "user-updated", { id, name, vibe: vibe ?? null, lastSeen });
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("api/users error:", e);
    return res.status(500).json({ error: String(e) });
  }
}
