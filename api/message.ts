import type { VercelRequest, VercelResponse } from "@vercel/node";
import { pusher } from "./_pusher.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { toId, fromName, text } = req.body;
    if (!toId || !fromName || !text) return res.status(400).json({ error: "toId, fromName, text required" });
    await pusher.trigger("vibe-checker", "user-message", { toId, fromName, text });
    return res.json({ ok: true });
  } catch (e) {
    console.error("api/message error:", e);
    return res.status(500).json({ error: String(e) });
  }
}
