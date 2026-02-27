import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db, initDb } from "./_db";
import { pusher } from "./_pusher";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  await initDb();

  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "id required" });

  await db.execute({ sql: "DELETE FROM users WHERE id = ?", args: [id] });
  await pusher.trigger("vibe-checker", "user-removed", { id });

  return res.json({ ok: true });
}
