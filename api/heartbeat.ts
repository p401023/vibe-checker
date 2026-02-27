import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db, initDb } from "./_db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  await initDb();

  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "id required" });

  await db.execute({
    sql: "UPDATE users SET last_seen = ? WHERE id = ?",
    args: [Date.now(), id],
  });

  return res.json({ ok: true });
}
