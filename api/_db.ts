// Calls Turso via its HTTP API — no native binaries, works on any platform

const dbUrl = process.env.TURSO_DATABASE_URL!.replace(/^libsql:\/\//, "https://");
const dbToken = process.env.TURSO_AUTH_TOKEN!;

type SqlArg = string | number | null;

interface TursoRow { [col: string]: string | number | null }

async function execute(sql: string, args: SqlArg[] = []): Promise<TursoRow[]> {
  const typedArgs = args.map((v) => {
    if (v === null) return { type: "null" };
    if (typeof v === "number") return { type: "integer", value: String(v) };
    return { type: "text", value: String(v) };
  });

  const res = await fetch(`${dbUrl}/v2/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${dbToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        { type: "execute", stmt: { sql, args: typedArgs } },
        { type: "close" },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Turso HTTP ${res.status}: ${await res.text()}`);

  const data = await res.json() as { results: { type: string; response?: { result: { cols: { name: string }[]; rows: (string | number | null)[][] } }; error?: { message: string } }[] };
  const first = data.results[0];
  if (first.type !== "ok" || !first.response) throw new Error(`Turso error: ${first.error?.message}`);

  const { cols, rows } = first.response.result;
  return rows.map((row) =>
    Object.fromEntries(cols.map((c, i) => [c.name, row[i]]))
  );
}

export async function initDb() {
  await execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      vibe TEXT,
      last_seen INTEGER NOT NULL
    )
  `);
}

export async function getActiveUsers(cutoff: number) {
  const rows = await execute("SELECT * FROM users WHERE last_seen > ?", [cutoff]);
  const users: Record<string, { name: string; vibe: string | null; lastSeen: number }> = {};
  for (const row of rows) {
    users[row.id as string] = {
      name: row.name as string,
      vibe: row.vibe as string | null,
      lastSeen: row.last_seen as number,
    };
  }
  return users;
}

export async function upsertUser(id: string, name: string, vibe: string | null, lastSeen: number) {
  await execute(
    `INSERT INTO users (id, name, vibe, last_seen) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       vibe = excluded.vibe,
       last_seen = excluded.last_seen`,
    [id, name, vibe, lastSeen]
  );
}

export async function deleteUser(id: string) {
  await execute("DELETE FROM users WHERE id = ?", [id]);
}

export async function updateLastSeen(id: string, lastSeen: number) {
  await execute("UPDATE users SET last_seen = ? WHERE id = ?", [lastSeen, id]);
}
