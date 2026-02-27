import type { VercelRequest, VercelResponse } from "@vercel/node";
import { initDb, updateLastSeen } from "./_db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    await initDb();
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "id required" });
    await updateLastSeen(id, Date.now());
    return res.json({ ok: true });
  } catch (e) {
    console.error("api/heartbeat error:", e);
    return res.status(500).json({ error: String(e) });
  }
}
