import express from "express";
import Pusher from "pusher";
import * as dotenv from "dotenv";

dotenv.config();

// Must load dotenv before importing _db (which reads process.env at module level)
import { initDb, getActiveUsers, upsertUser, deleteUser, updateLastSeen } from "./api/_db.js";

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

const STALE_THRESHOLD_MS = 10 * 60 * 1000;

const app = express();
app.use(express.json());

initDb()
  .then(() => console.log("[api] DB ready"))
  .catch((e: unknown) => console.error("[api] DB init failed:", e));

app.get("/api/users", async (_req, res) => {
  try {
    const users = await getActiveUsers(Date.now() - STALE_THRESHOLD_MS);
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
    await upsertUser(id, name, vibe ?? null, lastSeen);
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
    await deleteUser(id);
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
    await updateLastSeen(id, Date.now());
    res.json({ ok: true });
  } catch (e) {
    console.error("[api] POST /api/heartbeat error:", e);
    res.status(500).json({ error: String(e) });
  }
});

app.listen(3001, () => console.log("[api] Server running on http://localhost:3001"));
