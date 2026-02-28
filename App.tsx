import { useState, useEffect, useRef, CSSProperties, FC, KeyboardEvent } from "react";
import Pusher from "pusher-js";

const pusherClient = new Pusher(import.meta.env.VITE_PUSHER_KEY, {
  cluster: import.meta.env.VITE_PUSHER_CLUSTER,
});

// ─── Types ──────────────────────────────────────────────────────────────────

type QuadrantKey = "high-unpleasant" | "high-pleasant" | "low-unpleasant" | "low-pleasant";

interface QuadrantConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
}

interface UserRecord {
  name: string;
  vibe: QuadrantKey | null;
  lastSeen: number;
}
 
type UsersMap = Record<string, UserRecord>;

// ─── Constants ──────────────────────────────────────────────────────────────

const QUADRANTS: Record<QuadrantKey, QuadrantConfig> = {
  "high-unpleasant": {
    label: "FUCK IT\nWE BALL",
    color: "#ff3355",
    bg: "radial-gradient(ellipse at 30% 40%, #ff335588 0%, #1a0008 70%)",
    border: "#ff3355",
  },
  "high-pleasant": {
    label: "LETS\nFUCKING\nGOOOOO",
    color: "#00ff88",
    bg: "radial-gradient(ellipse at 70% 30%, #00ff8866 0%, #001a0e 70%)",
    border: "#00ff88",
  },
  "low-unpleasant": {
    label: "MOM\nWOULD BE\nBE SAD",
    color: "#aa33ff44",
    bg: "radial-gradient(ellipse at 30% 70%, #330066 0%, #0a0010 70%)",
    border: "#330066",
  },
  "low-pleasant": {
    label: "WE\nVIBING",
    color: "#00ff8833",
    bg: "radial-gradient(ellipse at 60% 70%, #003322 0%, #000d08 70%)",
    border: "#003322",
  },
};

const HEARTBEAT_INTERVAL_MS = 30_000;

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function getOrCreateUserId(): string {
  let id = sessionStorage.getItem("vibeUserId");
  if (!id) {
    id = generateId();
    sessionStorage.setItem("vibeUserId", id);
  }
  return id;
}

function playGunshot(): void {
  const audio = new Audio("/gunshot.mp3");
  audio.play();
}


async function post(path: string, body: object) {
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => {
    if (!r.ok) r.text().then((t) => console.error(`[vibe] POST ${path} failed:`, r.status, t));
    return r;
  }).catch((e) => console.error(`[vibe] POST ${path} error:`, e));
}

// ─── Components ─────────────────────────────────────────────────────────────

interface QuadrantProps {
  quadKey: QuadrantKey;
  quadrant: QuadrantConfig;
  isMine: boolean;
  usersHere: [string, UserRecord][];
  onClick: () => void;
}

const Quadrant: FC<QuadrantProps> = ({ quadrant, isMine, usersHere, onClick }) => {
  return (
    <div
      onClick={onClick}
      style={{
        ...styles.quadrant,
        background: quadrant.bg,
        border: isMine ? `2px solid ${quadrant.border}` : "1px solid #1a2a1a",
        boxShadow: isMine
          ? `0 0 30px ${quadrant.border}55, inset 0 0 30px ${quadrant.border}11`
          : "none",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          ...styles.quadLabel,
          color: quadrant.color,
          opacity: isMine ? 1 : 0.35,
          textShadow: isMine ? `0 0 20px ${quadrant.color}` : "none",
        }}
      >
        {quadrant.label}
      </div>

      <div style={styles.avatarRow}>
        {usersHere.map(([id, u]) => (
          <div key={id} style={styles.avatar} title={u.name}>
            <div style={styles.avatarDot} />
            <div style={styles.avatarName}>{u.name.slice(0, 6).toUpperCase()}</div>
          </div>
        ))}
      </div>

      {isMine && <div style={styles.myIndicator}>● YOU</div>}
    </div>
  );
};

interface LoginScreenProps {
  nameInput: string;
  setNameInput: (val: string) => void;
  onJoin: () => void;
}

const LoginScreen: FC<LoginScreenProps> = ({ nameInput, setNameInput, onJoin }) => {
  return (
    <div style={styles.loginRoot}>
      <div style={styles.scanlines} />
      <div style={styles.loginBox}>
        <div style={styles.loginTitle}>VIBE CHECKER</div>
        <div style={styles.loginSub}>ENTER YOUR NAME TO JOIN</div>
        <input
          style={styles.loginInput}
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && onJoin()}
          placeholder="YOUR NAME"
          autoFocus
          maxLength={20}
        />
        <button style={styles.loginBtn} onClick={onJoin}>
          JOIN →
        </button>
      </div>
    </div>
  );
};

// ─── Main App ───────────────────────────────────────────────────────────────

export default function App(): JSX.Element {
  const [userName, setUserName] = useState<string>(
    () => sessionStorage.getItem("vibeName") ?? ""
  );
  const [nameInput, setNameInput] = useState<string>("");
  const [myVibe, setMyVibe] = useState<QuadrantKey | null>(null);
  const [users, setUsers] = useState<UsersMap>({});
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string; name: string } | null>(null);
  const [messageTarget, setMessageTarget] = useState<{ id: string; name: string } | null>(null);
  const [messageInput, setMessageInput] = useState<string>("");
  const [incomingMessage, setIncomingMessage] = useState<{ fromName: string; text: string } | null>(null);
  const [flashingUsers, setFlashingUsers] = useState<Set<string>>(new Set());

  const userId = useRef<string>(getOrCreateUserId());
  const sirenRef = useRef<HTMLAudioElement | null>(null);
  const lastTapRef = useRef<{ time: number; id: string } | null>(null);

  // Unlock siren audio on the first user click so it can play from Pusher events later
  useEffect(() => {
    const unlock = () => {
      const audio = new Audio("/siren.mp3");
      audio.loop = true;
      audio.play().then(() => { audio.pause(); audio.currentTime = 0; }).catch(() => {});
      sirenRef.current = audio;
      window.removeEventListener("click", unlock);
    };
    window.addEventListener("click", unlock);
    return () => window.removeEventListener("click", unlock);
  }, []);

  const fetchUsers = (): void => {
    fetch("/api/users")
      .then((r) => {
        if (!r.ok) return r.text().then((t) => { throw new Error(`API error: ${r.status} — ${t}`); });
        return r.json();
      })
      .then((data: UsersMap) => {
        // Preserve own optimistic state if server hasn't caught up yet
        setUsers((prev) => {
          const merged = { ...data };
          if (prev[userId.current] && !data[userId.current]) {
            merged[userId.current] = prev[userId.current];
          }
          return merged;
        });
        const me = data[userId.current];
        if (me) setMyVibe(me.vibe ?? null);
      })
      .catch((e) => console.error("[vibe] fetchUsers failed:", e));
  };

  // Load initial users + subscribe to real-time updates + poll as fallback
  useEffect(() => {
    fetchUsers();

    // Poll every 4 seconds as fallback in case Pusher events are missed
    const pollInterval = setInterval(fetchUsers, 4000);

    const channel = pusherClient.subscribe("vibe-checker");

    channel.bind("user-updated", (data: { id: string; name: string; vibe: string | null; lastSeen: number }) => {
      setUsers((prev) => ({
        ...prev,
        [data.id]: { name: data.name, vibe: data.vibe as QuadrantKey | null, lastSeen: data.lastSeen },
      }));
      if (data.id === userId.current) {
        setMyVibe(data.vibe as QuadrantKey | null);
      } else {
        setFlashingUsers((prev) => new Set(prev).add(data.id));
        setTimeout(() => {
          setFlashingUsers((prev) => {
            const next = new Set(prev);
            next.delete(data.id);
            return next;
          });
        }, 900);
      }
    });

    channel.bind("user-removed", (data: { id: string }) => {
      setUsers((prev) => {
        const next = { ...prev };
        delete next[data.id];
        return next;
      });
    });

    channel.bind("user-message", (data: { toId: string; fromName: string; text: string }) => {
      if (data.toId !== userId.current) return;
      if (sirenRef.current) {
        sirenRef.current.currentTime = 0;
        sirenRef.current.play().catch(console.error);
      }
      setIncomingMessage({ fromName: data.fromName, text: data.text });
    });

    return () => {
      clearInterval(pollInterval);
      pusherClient.unsubscribe("vibe-checker");
    };
  }, []);

  // Heartbeat
  useEffect(() => {
    if (!userName) return;
    const interval = setInterval(() => {
      post("/api/heartbeat", { id: userId.current });
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [userName]);

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, id: string, name: string): void => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, id, name });
  };

  const handleTap = (e: React.TouchEvent, id: string, name: string): void => {
    const now = Date.now();
    const last = lastTapRef.current;
    if (last && last.id === id && now - last.time < 300) {
      e.preventDefault();
      const touch = e.changedTouches[0];
      setContextMenu({ x: touch.clientX, y: touch.clientY, id, name });
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { time: now, id };
    }
  };

  const handleMessageUser = (id: string, name: string): void => {
    setContextMenu(null);
    setMessageInput("");
    setMessageTarget({ id, name });
  };

  const sendMessage = async (): Promise<void> => {
    if (!messageTarget || !messageInput.trim()) return;
    await post("/api/message", { toId: messageTarget.id, fromName: userName, text: messageInput.trim() });
    setMessageTarget(null);
    setMessageInput("");
  };

  const dismissMessage = (): void => {
    if (sirenRef.current) {
      sirenRef.current.pause();
      sirenRef.current.currentTime = 0;
    }
    setIncomingMessage(null);
  };

  const handleForceLogout = async (id: string): Promise<void> => {
    await post("/api/leave", { id });
    setUsers((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (id === userId.current) {
      sessionStorage.clear();
      window.location.reload();
    }
    setContextMenu(null);
  };

  const handleJoin = (): void => {
    const name = nameInput.trim();
    if (!name) return;
    sessionStorage.setItem("vibeName", name);
    setUserName(name);
    setUsers((prev) => ({
      ...prev,
      [userId.current]: { name, vibe: null, lastSeen: Date.now() },
    }));
    post("/api/users", { id: userId.current, name, vibe: null });
  };

  const handleVibeClick = (quadrant: QuadrantKey): void => {
    const newVibe: QuadrantKey | null = myVibe === quadrant ? null : quadrant;
    if (newVibe) playGunshot();
    setMyVibe(newVibe);
    setUsers((prev) => ({
      ...prev,
      [userId.current]: { name: userName, vibe: newVibe, lastSeen: Date.now() },
    }));
    post("/api/users", { id: userId.current, name: userName, vibe: newVibe });
  };

  const handleLogout = (): void => {
    post("/api/leave", { id: userId.current }).finally(() => {
      sessionStorage.clear();
      window.location.reload();
    });
  };

  const otherUsers = Object.entries(users).filter(([id]) => id !== userId.current) as [string, UserRecord][];
  const activeCount = Object.keys(users).length;

  if (!userName) {
    return (
      <LoginScreen
        nameInput={nameInput}
        setNameInput={setNameInput}
        onJoin={handleJoin}
      />
    );
  }

  return (
    <div style={styles.root}>
      <div style={styles.scanlines} />

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.title}>VIBE CHECKER</div>
        <div style={styles.liveIndicator}>
          <span style={styles.liveDot} />
          LIVE
        </div>
      </div>

      {/* Axis labels (left/right are absolute) */}
      <div style={styles.axisLeft}>UNPLEASANT</div>
      <div style={styles.axisRight}>PLEASANT</div>

      {/* Main grid + sidebar */}
      <div style={styles.gridWrapper} className="grid-wrapper">
        <div style={styles.gridColumn}>
          <div style={styles.axisTop}>HIGH ENERGY</div>
          <div style={styles.grid}>
          {(Object.entries(QUADRANTS) as [QuadrantKey, QuadrantConfig][]).map(([key, q]) => {
            const usersHere = otherUsers.filter(([, u]) => u.vibe === key);
            const isMine = myVibe === key;
            return (
              <Quadrant
                key={key}
                quadKey={key}
                quadrant={q}
                isMine={isMine}
                usersHere={usersHere}
                onClick={() => handleVibeClick(key)}
              />
            );
          })}
          </div>
          <div style={styles.axisBottom}>LOW ENERGY</div>
        </div>

        {/* Sidebar */}
        <div style={styles.sidebar} className="sidebar">
          <div style={styles.sidebarTitle} className="sidebar-title">ACTIVE USERS</div>
          <div style={styles.sidebarCount}>{activeCount} online</div>
          <div style={styles.userList} className="user-list">
            {Object.entries(users).map(([id, u]) => (
              <div
                key={id}
                style={styles.userItem}
                className={`user-item${flashingUsers.has(id) ? " user-item-flash" : ""}`}
                onContextMenu={(e) => handleContextMenu(e, id, u.name)}
                onTouchEnd={(e) => handleTap(e, id, u.name)}
              >
                <span
                  style={{
                    ...styles.userDot,
                    background: id === userId.current ? "#fff" : "#00ff88",
                  }}
                />
                <div style={styles.userInfo} className="user-info">
                  <span style={styles.userName2}>{u.name}</span>
                  {u.vibe && (
                    <span style={styles.userVibeBadge}>
                      {QUADRANTS[u.vibe]?.label.replace(/\n/g, " ")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          style={{ ...styles.contextMenu, left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={styles.contextMenuUser}>{contextMenu.name}</div>
          {contextMenu.id !== userId.current && (
            <div style={styles.contextMenuItem} onClick={() => handleMessageUser(contextMenu.id, contextMenu.name)}>
              MESSAGE USER
            </div>
          )}
          <div style={{ ...styles.contextMenuItem, color: "#ff3355" }} onClick={() => handleForceLogout(contextMenu.id)}>
            REMOVE USER
          </div>
        </div>
      )}

      {/* Message compose dialog */}
      {messageTarget && (
        <div style={styles.dialogOverlay} onClick={() => setMessageTarget(null)}>
          <div style={styles.dialogBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.dialogTitle}>MESSAGE → {messageTarget.name.toUpperCase()}</div>
            <input
              style={styles.dialogInput}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && sendMessage()}
              placeholder="TYPE MESSAGE..."
              autoFocus
              maxLength={80}
            />
            <div style={styles.dialogButtons}>
              <button style={styles.dialogSend} onClick={sendMessage}>SEND</button>
              <button style={styles.dialogCancel} onClick={() => setMessageTarget(null)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {/* Incoming message overlay */}
      {incomingMessage && (
        <div style={styles.messageOverlay} onClick={dismissMessage}>
          <div style={styles.messageFrom}>⚠ MESSAGE FROM {incomingMessage.fromName.toUpperCase()} ⚠</div>
          <div style={styles.messageText}>{incomingMessage.text.toUpperCase()}</div>
          <div style={styles.messageDismiss}>CLICK ANYWHERE TO ACKNOWLEDGE</div>
        </div>
      )}

      {/* Footer */}
      <div style={styles.footer}>
        <div style={styles.footerLeft}>
          <span style={{ ...styles.footerDot, background: "#fff" }} /> YOU ({userName})
          &nbsp;&nbsp;|&nbsp;&nbsp;
          <span style={{ ...styles.footerDot, background: "#00ff88" }} /> OTHERS
        </div>
        <div style={styles.footerMid}>ACTIVE USERS IN LAST 10 MINUTES</div>
        <button style={styles.logoutBtn} onClick={handleLogout}>
          LOG OUT
        </button>
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles: Record<string, CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "#050e05",
    color: "#00ff88",
    fontFamily: "'Share Tech Mono', 'Courier New', monospace",
    display: "flex",
    flexDirection: "column",
    padding: "16px",
    boxSizing: "border-box",
    position: "relative",
    overflow: "hidden",
    border: "2px solid #00ff4422",
  },
  scanlines: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background:
      "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
    pointerEvents: "none",
    zIndex: 100,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  title: {
    fontSize: "clamp(28px, 5vw, 52px)",
    fontWeight: 900,
    letterSpacing: "0.08em",
    color: "#00ff88",
    textShadow: "0 0 30px #00ff8888, 0 0 60px #00ff8844",
    fontFamily: "'Share Tech Mono', monospace",
  },
  liveIndicator: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    letterSpacing: "0.15em",
    color: "#00ff88",
  },
  liveDot: {
    display: "inline-block",
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: "#00ff88",
    boxShadow: "0 0 10px #00ff88",
    animation: "pulse 1.5s infinite",
  },
  axisTop: {
    textAlign: "center",
    fontSize: "11px",
    letterSpacing: "0.25em",
    color: "#00ff8888",
    marginBottom: "4px",
  },
  axisBottom: {
    textAlign: "center",
    fontSize: "11px",
    letterSpacing: "0.25em",
    color: "#00ff8888",
    marginTop: "4px",
  },
  axisLeft: {
    position: "absolute",
    left: "6px",
    top: "50%",
    transform: "translateX(-50%) rotate(-90deg)",
    fontSize: "11px",
    letterSpacing: "0.25em",
    color: "#00ff8866",
    whiteSpace: "nowrap",
  },
  axisRight: {
    position: "absolute",
    right: "-8px",
    top: "50%",
    transform: "translateX(-50%) rotate(90deg)",
    fontSize: "11px",
    letterSpacing: "0.25em",
    color: "#00ff8866",
    whiteSpace: "nowrap",
  },
  gridWrapper: {
    display: "flex",
    gap: "12px",
    flex: 1,
    minHeight: 0,
  },
  gridColumn: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gridTemplateRows: "1fr 1fr",
    gap: "4px",
    flex: 1,
    minHeight: 0,
  },
  quadrant: {
    position: "relative",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    minHeight: "200px",
    transition: "all 0.2s ease",
    userSelect: "none",
  },
  quadLabel: {
    fontSize: "clamp(18px, 3vw, 32px)",
    fontWeight: 900,
    lineHeight: 1.1,
    letterSpacing: "0.04em",
    whiteSpace: "pre-line",
    fontFamily: "'Share Tech Mono', monospace",
    transition: "all 0.3s ease",
  },
  avatarRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "8px",
  },
  avatar: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2px",
  },
  avatarDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: "#00ff88",
    boxShadow: "0 0 8px #00ff88",
  },
  avatarName: {
    fontSize: "9px",
    color: "#00ff88",
    letterSpacing: "0.1em",
  },
  myIndicator: {
    position: "absolute",
    bottom: "10px",
    right: "12px",
    fontSize: "11px",
    color: "#fff",
    letterSpacing: "0.1em",
  },
  sidebar: {
    width: "180px",
    borderLeft: "1px solid #00ff4422",
    paddingLeft: "12px",
    display: "flex",
    flexDirection: "column",
  },
  sidebarTitle: {
    fontSize: "11px",
    letterSpacing: "0.2em",
    color: "#00ff8888",
    marginBottom: "4px",
  },
  sidebarCount: {
    fontSize: "12px",
    color: "#00ff8855",
    marginBottom: "12px",
  },
  userList: {
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
  },
  userItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    padding: "14px 0",
    borderBottom: "1px solid #00ff4418",
    fontSize: "12px",
  },
  userDot: {
    display: "inline-block",
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    flexShrink: 0,
    marginTop: "3px",
    boxShadow: "0 0 6px currentColor",
  },
  userInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    flex: 1,
    minWidth: 0,
  },
  userName2: {
    color: "#00ff88cc",
    letterSpacing: "0.05em",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "12px",
  },
  userVibeBadge: {
    fontSize: "10px",
    color: "#00ff8888",
    letterSpacing: "0.05em",
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "10px",
    fontSize: "12px",
    letterSpacing: "0.12em",
    color: "#00ff8888",
  },
  footerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  footerDot: {
    display: "inline-block",
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    boxShadow: "0 0 6px currentColor",
  },
  footerMid: {
    fontSize: "11px",
    letterSpacing: "0.15em",
  },
  logoutBtn: {
    background: "transparent",
    border: "1px solid #00ff8855",
    color: "#00ff88",
    padding: "6px 16px",
    fontSize: "12px",
    letterSpacing: "0.15em",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 0.2s",
  },
  dialogOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  dialogBox: {
    background: "#050e05",
    border: "1px solid #00ff4466",
    boxShadow: "0 0 40px #00ff4422",
    padding: "32px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    minWidth: "360px",
    fontFamily: "'Share Tech Mono', monospace",
  },
  dialogTitle: {
    fontSize: "12px",
    letterSpacing: "0.2em",
    color: "#00ff8888",
  },
  dialogInput: {
    background: "transparent",
    border: "none",
    borderBottom: "1px solid #00ff8855",
    color: "#00ff88",
    fontSize: "16px",
    fontFamily: "inherit",
    padding: "8px 4px",
    outline: "none",
    letterSpacing: "0.1em",
  },
  dialogButtons: {
    display: "flex",
    gap: "12px",
  },
  dialogSend: {
    background: "transparent",
    border: "1px solid #00ff88",
    color: "#00ff88",
    padding: "8px 24px",
    fontSize: "12px",
    letterSpacing: "0.2em",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  dialogCancel: {
    background: "transparent",
    border: "1px solid #ffffff22",
    color: "#ffffff44",
    padding: "8px 24px",
    fontSize: "12px",
    letterSpacing: "0.2em",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  messageOverlay: {
    position: "fixed",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
    cursor: "pointer",
    animation: "shake 0.5s ease-in-out infinite, flashBg 0.6s step-start infinite",
    padding: "40px",
    gap: "32px",
  },
  messageFrom: {
    fontSize: "clamp(14px, 2vw, 20px)",
    letterSpacing: "0.3em",
    color: "#ff6666",
    fontFamily: "'Share Tech Mono', monospace",
  },
  messageText: {
    fontSize: "clamp(32px, 7vw, 90px)",
    fontWeight: 900,
    letterSpacing: "0.06em",
    textAlign: "center",
    fontFamily: "'Share Tech Mono', monospace",
    color: "#ff0000",
    animation: "flashText 0.5s step-start infinite",
    lineHeight: 1.1,
    wordBreak: "break-word",
  },
  messageDismiss: {
    fontSize: "12px",
    letterSpacing: "0.25em",
    color: "#ffffff55",
    fontFamily: "'Share Tech Mono', monospace",
  },
  contextMenu: {
    position: "fixed",
    background: "#050e05",
    border: "1px solid #00ff4444",
    boxShadow: "0 0 20px #00ff4422",
    zIndex: 999,
    minWidth: "150px",
    fontFamily: "'Share Tech Mono', monospace",
  },
  contextMenuUser: {
    padding: "7px 12px",
    fontSize: "10px",
    letterSpacing: "0.2em",
    color: "#00ff8855",
    borderBottom: "1px solid #00ff4422",
  },
  contextMenuItem: {
    padding: "10px 12px",
    fontSize: "11px",
    letterSpacing: "0.15em",
    color: "#ff3355",
    cursor: "pointer",
  },
  loginRoot: {
    minHeight: "100vh",
    background: "#050e05",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Share Tech Mono', monospace",
    position: "relative",
  },
  loginBox: {
    border: "1px solid #00ff4444",
    padding: "48px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    alignItems: "center",
    background: "#000a00",
    boxShadow: "0 0 60px #00ff4422",
    minWidth: "320px",
  },
  loginTitle: {
    fontSize: "36px",
    fontWeight: 900,
    color: "#00ff88",
    letterSpacing: "0.1em",
    textShadow: "0 0 30px #00ff88",
  },
  loginSub: {
    fontSize: "11px",
    letterSpacing: "0.3em",
    color: "#00ff8866",
  },
  loginInput: {
    background: "transparent",
    border: "none",
    borderBottom: "1px solid #00ff8855",
    color: "#00ff88",
    fontSize: "18px",
    fontFamily: "inherit",
    padding: "8px 4px",
    outline: "none",
    letterSpacing: "0.15em",
    textAlign: "center",
    width: "100%",
  },
  loginBtn: {
    background: "transparent",
    border: "1px solid #00ff88",
    color: "#00ff88",
    padding: "10px 32px",
    fontSize: "14px",
    letterSpacing: "0.2em",
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 0 20px #00ff8833",
    transition: "all 0.2s",
  },
};
