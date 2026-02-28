import { useState, useEffect, useLayoutEffect, useRef, useMemo, CSSProperties, FC, KeyboardEvent } from "react";
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

type AppMode = "twitter" | "linkedin";

// ─── Mode Content ────────────────────────────────────────────────────────────

const CONTENT = {
  twitter: {
    appTitle: "VIBE CHECKER",
    loginSub: "ENTER YOUR NAME TO JOIN",
    loginPlaceholder: "YOUR NAME",
    joinBtn: "JOIN →",
    axisTop: "HIGH ENERGY",
    axisBottom: "LOW ENERGY",
    axisLeft: "UNPLEASANT",
    axisRight: "PLEASANT",
    sidebarTitle: "ACTIVE USERS",
    onlineLabel: "online",
    footerOthers: "OTHERS",
    footerMid: "ACTIVE USERS IN LAST 10 MINUTES",
    logoutBtn: "LOG OUT",
    liveLabel: "LIVE",
    contextMessage: "MESSAGE USER",
    contextRemove: "REMOVE USER",
    dialogTitlePrefix: "MESSAGE →",
    dialogPlaceholder: "TYPE MESSAGE...",
    sendBtn: "SEND",
    cancelBtn: "CANCEL",
    incomingPrefix: "⚠ MESSAGE FROM",
    dismissLabel: "CLICK ANYWHERE TO ACKNOWLEDGE",
    quadrants: {
      "high-unpleasant": "FUCK IT\nWE BALL",
      "high-pleasant": "LETS\nFUCKING\nGOOOOO",
      "low-unpleasant": "MOM\nWOULD BE\nBE SAD",
      "low-pleasant": "WE\nVIBING",
    } as Record<QuadrantKey, string>,
  },
  linkedin: {
    appTitle: "SENTIMENT DASHBOARD",
    loginSub: "INPUT YOUR PROFESSIONAL IDENTIFIER",
    loginPlaceholder: "YOUR NAME",
    joinBtn: "ONBOARD →",
    axisTop: "HIGH BANDWIDTH",
    axisBottom: "LOW BANDWIDTH",
    axisLeft: "MISALIGNED",
    axisRight: "SYNERGIZED",
    sidebarTitle: "ACTIVE STAKEHOLDERS",
    onlineLabel: "engaged",
    footerOthers: "PEERS",
    footerMid: "STAKEHOLDERS ENGAGED IN LAST 10 MIN",
    logoutBtn: "DISCONNECT",
    liveLabel: "SYNCING",
    contextMessage: "REACH OUT",
    contextRemove: "OFFBOARD",
    dialogTitlePrefix: "OUTREACH →",
    dialogPlaceholder: "ARTICULATE VALUE PROP...",
    sendBtn: "DEPLOY",
    cancelBtn: "ABORT MISSION",
    incomingPrefix: "💼 SYNERGY PING FROM",
    dismissLabel: "CLICK ANYWHERE TO CIRCLE BACK",
    quadrants: {
      "high-unpleasant": "DISRUPTING\nTHE SPACE\nPROACTIVELY",
      "high-pleasant": "HUMBLED\nAND\nHONOURED",
      "low-unpleasant": "PIVOTING\nGROWTH\nMINDSET",
      "low-pleasant": "DELIVERING\nSTAKEHOLDER\nVALUE",
    } as Record<QuadrantKey, string>,
  },
} satisfies Record<AppMode, unknown>;

// ─── LinkedIn Theme ──────────────────────────────────────────────────────────

const LI_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const LI = {
  bg:           "#080f1a",
  card:         "#0d1e30",
  cardActive:   "#0a2548",
  blue:         "#0a66c2",
  blueGlow:     "rgba(10,102,194,0.35)",
  gold:         "#f0b429",
  goldGlow:     "rgba(240,180,41,0.35)",
  text:         "#e8f0f8",
  muted:        "#6b8aab",
  border:       "rgba(255,255,255,0.07)",
  borderBlue:   "rgba(10,102,194,0.5)",
  shadow:       "0 8px 32px rgba(0,0,0,0.6)",
  shadowBlue:   "0 0 28px rgba(10,102,194,0.3)",
  shadowGold:   "0 0 28px rgba(240,180,41,0.3)",
};

const LI_QUADRANT: Record<QuadrantKey, { color: string; bg: string; border: string }> = {
  "high-pleasant":   { color: "#22c55e", border: "#22c55e", bg: "radial-gradient(ellipse at 65% 30%, rgba(34,197,94,0.18) 0%, #0d1e30 70%)"  },
  "high-unpleasant": { color: "#f97316", border: "#f97316", bg: "radial-gradient(ellipse at 35% 30%, rgba(249,115,22,0.18) 0%, #0d1e30 70%)" },
  "low-pleasant":    { color: "#38bdf8", border: "#38bdf8", bg: "radial-gradient(ellipse at 65% 70%, rgba(56,189,248,0.14) 0%, #0d1e30 70%)"  },
  "low-unpleasant":  { color: "#a78bfa", border: "#a78bfa", bg: "radial-gradient(ellipse at 35% 70%, rgba(167,139,250,0.14) 0%, #0d1e30 70%)" },
};

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

function playSelectSound(mode: AppMode): void {
  const audio = new Audio(mode === "linkedin" ? "/hooray.mp3" : "/gunshot.mp3");
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

const CONFETTI_COLORS = ["#0077b5","#00a0dc","#f5a623","#7fc15e","#e74c3c","#ffffff","#86c3da","#ffd700","#b36adf"];

const ConfettiPieces: FC = () => {
  const pieces = useMemo(() =>
    Array.from({ length: 72 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      width: 5 + Math.random() * 9,
      height: 4 + Math.random() * 7,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      delay: Math.random() * 2.8,
      duration: 1.8 + Math.random() * 2.2,
    }))
  , []);

  return (
    <>
      {pieces.map(p => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            top: "-20px",
            left: `${p.left}%`,
            width: p.width,
            height: p.height,
            background: p.color,
            borderRadius: "2px",
            animation: `confettiFall ${p.duration}s ${p.delay}s ease-in infinite`,
          }}
        />
      ))}
    </>
  );
};

interface QuadrantProps {
  quadKey: QuadrantKey;
  quadrant: QuadrantConfig;
  isMine: boolean;
  usersHere: [string, UserRecord][];
  onClick: () => void;
  mode: AppMode;
}

const Quadrant: FC<QuadrantProps> = ({ quadKey, quadrant, isMine, usersHere, onClick, mode }) => {
  const isLI = mode === "linkedin";
  const liq = LI_QUADRANT[quadKey];
  return (
    <div
      onClick={onClick}
      style={{
        ...styles.quadrant,
        background: isLI ? liq.bg : quadrant.bg,
        border: isLI
          ? (isMine ? `2px solid ${LI.gold}` : `1px solid ${liq.border}44`)
          : (isMine ? `2px solid ${quadrant.border}` : "1px solid #1a2a1a"),
        boxShadow: isLI
          ? (isMine
              ? `0 0 28px rgba(240,180,41,0.35), 0 0 0 1px ${LI.gold}55, inset 0 0 40px rgba(240,180,41,0.04)`
              : `0 0 16px rgba(0,0,0,0.5), inset 0 0 20px ${liq.border}0a`)
          : (isMine ? `0 0 30px ${quadrant.border}55, inset 0 0 30px ${quadrant.border}11` : "none"),
        borderRadius: isLI ? "8px" : "0",
        cursor: "pointer",
        transition: "all 0.2s ease",
      }}
    >
      <div
        style={{
          ...styles.quadLabel,
          color: isLI ? (isMine ? LI.gold : liq.color) : quadrant.color,
          opacity: isLI ? (isMine ? 1 : 0.75) : (isMine ? 1 : 0.35),
          textShadow: isLI
            ? (isMine ? `0 0 30px ${LI.gold}` : `0 0 20px ${liq.color}66`)
            : (isMine ? `0 0 20px ${quadrant.color}` : "none"),
          fontFamily: isLI ? LI_FONT : undefined,
          fontWeight: 900,
          fontSize: isLI ? "clamp(15px, 2.2vw, 26px)" : undefined,
          letterSpacing: isLI ? "-0.02em" : undefined,
          lineHeight: isLI ? 1.05 : undefined,
        }}
      >
        {quadrant.label}
      </div>

      <div style={styles.avatarRow}>
        {usersHere.map(([id, u]) => (
          <div key={id} style={styles.avatar} title={u.name}>
            <div style={{
              ...styles.avatarDot,
              background: isLI ? liq.color : "#00ff88",
              boxShadow: isLI ? `0 0 6px ${liq.color}88` : "0 0 8px #00ff88",
            }} />
            <div style={{
              ...styles.avatarName,
              color: isLI ? liq.color : "#00ff88",
              fontFamily: isLI ? LI_FONT : undefined,
              fontSize: isLI ? "8px" : undefined,
              letterSpacing: isLI ? "0.05em" : undefined,
            }}>{u.name.slice(0, 6).toUpperCase()}</div>
          </div>
        ))}
      </div>

      {isMine && (
        <div style={{
          ...styles.myIndicator,
          color: isLI ? LI.gold : "#fff",
          fontFamily: isLI ? LI_FONT : undefined,
          fontWeight: isLI ? 800 : undefined,
          fontSize: isLI ? "10px" : undefined,
          letterSpacing: isLI ? "0.15em" : undefined,
          background: isLI ? "rgba(240,180,41,0.12)" : "transparent",
          borderRadius: isLI ? "4px" : "0",
          padding: isLI ? "2px 6px" : "0",
        }}>
          {isLI ? "● YOU" : "● YOU"}
        </div>
      )}
    </div>
  );
};

interface LoginScreenProps {
  nameInput: string;
  setNameInput: (val: string) => void;
  onJoin: () => void;
  mode: AppMode;
  onToggleMode: () => void;
}

const LoginScreen: FC<LoginScreenProps> = ({ nameInput, setNameInput, onJoin, mode, onToggleMode }) => {
  const c = CONTENT[mode];
  const isLI = mode === "linkedin";
  return (
    <div style={{
      ...styles.loginRoot,
      background: isLI ? LI.bg : "#050e05",
      fontFamily: isLI ? LI_FONT : undefined,
    }}>
      {!isLI && <div style={styles.scanlines} />}
      <div style={{
        ...styles.loginBox,
        background: isLI ? LI.card : "#000a00",
        border: isLI ? `1px solid ${LI.border}` : "1px solid #00ff4444",
        boxShadow: isLI ? `${LI.shadow}, 0 0 60px ${LI.blueGlow}` : "0 0 60px #00ff4422",
        borderRadius: isLI ? "16px" : "0",
      }}>
        {isLI && (
          <div style={{ fontSize: "48px", marginBottom: "-4px" }}>💼</div>
        )}
        <div style={{
          ...styles.loginTitle,
          color: isLI ? LI.gold : "#00ff88",
          textShadow: isLI ? `0 0 40px ${LI.goldGlow}` : "0 0 30px #00ff88",
          fontFamily: isLI ? LI_FONT : undefined,
          fontWeight: 900,
          letterSpacing: isLI ? "-0.03em" : "0.1em",
          fontSize: isLI ? "32px" : "36px",
        }}>{c.appTitle}</div>
        <div style={{
          ...styles.loginSub,
          color: isLI ? LI.muted : "#00ff8866",
          letterSpacing: isLI ? "0.05em" : "0.3em",
          fontSize: isLI ? "13px" : "11px",
          textTransform: "uppercase",
        }}>{c.loginSub}</div>
        <input
          style={{
            ...styles.loginInput,
            color: isLI ? LI.text : "#00ff88",
            borderBottom: isLI ? `2px solid ${LI.blue}` : "1px solid #00ff8855",
            fontFamily: isLI ? LI_FONT : undefined,
            letterSpacing: isLI ? "0.05em" : "0.15em",
            fontSize: isLI ? "17px" : "18px",
          }}
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && onJoin()}
          placeholder={c.loginPlaceholder}
          autoFocus
          maxLength={20}
        />
        <button style={{
          ...styles.loginBtn,
          background: isLI ? LI.gold : "transparent",
          border: isLI ? "none" : "1px solid #00ff88",
          color: isLI ? "#080f1a" : "#00ff88",
          borderRadius: isLI ? "6px" : "0",
          boxShadow: isLI ? `${LI.shadowGold}` : "0 0 20px #00ff8833",
          fontFamily: isLI ? LI_FONT : undefined,
          fontWeight: isLI ? 800 : undefined,
          letterSpacing: isLI ? "0.08em" : "0.2em",
          padding: isLI ? "14px 40px" : "10px 32px",
          fontSize: isLI ? "15px" : undefined,
          textTransform: "uppercase",
        }} onClick={onJoin}>
          {c.joinBtn}
        </button>
        <div style={styles.modeToggle}>
          <button
            style={{ ...styles.modeBtn, ...(mode === "twitter" ? styles.modeBtnActive : (isLI ? styles.modeBtnInactiveLI : styles.modeBtnInactive)) }}
            onClick={() => mode !== "twitter" && onToggleMode()}
          >
            𝕏 TWITTER
          </button>
          <button
            style={{ ...styles.modeBtn, ...(mode === "linkedin" ? styles.modeBtnActiveLinkedIn : (isLI ? styles.modeBtnInactiveLI : styles.modeBtnInactive)) }}
            onClick={() => mode !== "linkedin" && onToggleMode()}
          >
            in LINKEDIN
          </button>
        </div>
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
  const [mode, setMode] = useState<AppMode>(
    () => (localStorage.getItem("vibeMode") as AppMode) ?? "twitter"
  );

  const toggleMode = (): void => {
    setMode((prev) => {
      const next: AppMode = prev === "twitter" ? "linkedin" : "twitter";
      localStorage.setItem("vibeMode", next);
      return next;
    });
  };

  const userId = useRef<string>(getOrCreateUserId());
  const modeRef = useRef<AppMode>(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  const sirenRef = useRef<HTMLAudioElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!contextMenu || !contextMenuRef.current) return;
    const el = contextMenuRef.current;
    const rect = el.getBoundingClientRect();
    const x = Math.min(contextMenu.x, window.innerWidth - rect.width - 4);
    const y = Math.min(contextMenu.y, window.innerHeight - rect.height - 4);
    el.style.left = `${Math.max(4, x)}px`;
    el.style.top = `${Math.max(4, y)}px`;
  }, [contextMenu]);
  const tadaRef = useRef<HTMLAudioElement | null>(null);
  const lastTapRef = useRef<{ time: number; id: string } | null>(null);

  // Unlock both notification sounds on first user click (browser autoplay policy)
  useEffect(() => {
    const unlock = () => {
      const siren = new Audio("/siren.mp3");
      siren.loop = true;
      siren.play().then(() => { siren.pause(); siren.currentTime = 0; }).catch(() => {});
      sirenRef.current = siren;

      const tada = new Audio("/tada.mp3");
      tada.play().then(() => { tada.pause(); tada.currentTime = 0; }).catch(() => {});
      tadaRef.current = tada;

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
      if (modeRef.current === "linkedin") {
        if (tadaRef.current) {
          tadaRef.current.currentTime = 0;
          tadaRef.current.play().catch(console.error);
        }
      } else {
        if (sirenRef.current) {
          sirenRef.current.currentTime = 0;
          sirenRef.current.play().catch(console.error);
        }
      }
      setIncomingMessage({ fromName: data.fromName, text: data.text });
    });

    return () => {
      clearInterval(pollInterval);
      pusherClient.unsubscribe("vibe-checker");
    };
  }, []);

  // Sync body background to mode
  useEffect(() => {
    document.body.style.background = mode === "linkedin" ? LI.bg : "#050e05";
  }, [mode]);

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
    if (newVibe) playSelectSound(mode);
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

  const c = CONTENT[mode];
  const isLI = mode === "linkedin";

  if (!userName) {
    return (
      <LoginScreen
        nameInput={nameInput}
        setNameInput={setNameInput}
        onJoin={handleJoin}
        mode={mode}
        onToggleMode={toggleMode}
      />
    );
  }

  return (
    <div style={{
      ...styles.root,
      background: isLI ? LI.bg : "#050e05",
      color: isLI ? LI.text : "#00ff88",
      fontFamily: isLI ? LI_FONT : styles.root.fontFamily,
      border: isLI ? `1px solid ${LI.border}` : "2px solid #00ff4422",
    }}>
      {!isLI && <div style={styles.scanlines} />}

      {/* Header */}
      <div style={{
        ...styles.header,
        borderBottom: isLI ? `1px solid ${LI.border}` : "none",
        paddingBottom: isLI ? "14px" : "0",
        marginBottom: isLI ? "16px" : "8px",
      }}>
        <div style={{
          ...styles.title,
          color: isLI ? LI.gold : "#00ff88",
          textShadow: isLI ? `0 0 40px ${LI.goldGlow}` : "0 0 30px #00ff8888, 0 0 60px #00ff8844",
          fontFamily: isLI ? LI_FONT : styles.title.fontFamily,
          letterSpacing: isLI ? "-0.03em" : "0.08em",
          fontSize: isLI ? "clamp(20px, 3.5vw, 34px)" : "clamp(28px, 5vw, 52px)",
          fontWeight: 900,
        }}>{c.appTitle}</div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={styles.modeToggle}>
            <button
              style={{ ...styles.modeBtn, ...(mode === "twitter" ? styles.modeBtnActive : (isLI ? styles.modeBtnInactiveLI : styles.modeBtnInactive)) }}
              onClick={() => mode !== "twitter" && toggleMode()}
            >
              𝕏 TWITTER
            </button>
            <button
              style={{ ...styles.modeBtn, ...(mode === "linkedin" ? styles.modeBtnActiveLinkedIn : (isLI ? styles.modeBtnInactiveLI : styles.modeBtnInactive)) }}
              onClick={() => mode !== "linkedin" && toggleMode()}
            >
              in LINKEDIN
            </button>
          </div>
          <div style={{
            ...styles.liveIndicator,
            color: isLI ? LI.gold : "#00ff88",
            fontFamily: isLI ? LI_FONT : undefined,
            fontWeight: isLI ? 700 : undefined,
          }}>
            <span style={{
              ...styles.liveDot,
              background: isLI ? LI.gold : "#00ff88",
              boxShadow: isLI ? `0 0 10px ${LI.gold}` : "0 0 10px #00ff88",
              animation: "pulse 1.5s infinite",
            }} />
            {c.liveLabel}
          </div>
        </div>
      </div>

      {/* Main grid + sidebar */}
      <div style={styles.gridWrapper} className="grid-wrapper">
        {/* Grid with flanking axis labels — kept in one row so labels stay beside grid on all screen sizes */}
        <div style={styles.gridWithAxes}>
          <div style={{ ...styles.axisLeft, color: isLI ? LI.muted : "#00ff8866" }}>{c.axisLeft}</div>
          <div style={styles.gridColumn}>
            <div style={{ ...styles.axisTop, color: isLI ? LI.muted : "#00ff8888", fontFamily: isLI ? LI_FONT : undefined, letterSpacing: isLI ? "0.15em" : "0.25em", fontWeight: isLI ? 700 : undefined }}>{c.axisTop}</div>
            <div style={{ ...styles.grid, gap: isLI ? "8px" : "4px" }}>
            {(Object.entries(QUADRANTS) as [QuadrantKey, QuadrantConfig][]).map(([key, q]) => {
              const usersHere = otherUsers.filter(([, u]) => u.vibe === key);
              const isMine = myVibe === key;
              return (
                <Quadrant
                  key={key}
                  quadKey={key}
                  quadrant={{ ...q, label: c.quadrants[key] }}
                  isMine={isMine}
                  usersHere={usersHere}
                  onClick={() => handleVibeClick(key)}
                  mode={mode}
                />
              );
            })}
            </div>
            <div style={{ ...styles.axisBottom, color: isLI ? LI.muted : "#00ff8888", fontFamily: isLI ? LI_FONT : undefined, letterSpacing: isLI ? "0.15em" : "0.25em", fontWeight: isLI ? 700 : undefined }}>{c.axisBottom}</div>
          </div>
          <div style={{ ...styles.axisRight, color: isLI ? LI.muted : "#00ff8866" }}>{c.axisRight}</div>
        </div>

        {/* Sidebar */}
        <div style={{
          ...styles.sidebar,
          borderLeft: isLI ? `1px solid ${LI.border}` : "1px solid #00ff4422",
          background: isLI ? LI.card : "transparent",
          borderRadius: isLI ? "8px" : "0",
          padding: isLI ? "14px 14px" : undefined,
          boxShadow: isLI ? LI.shadow : "none",
        }} className="sidebar">
          <div style={{
            ...styles.sidebarTitle,
            color: isLI ? LI.gold : "#00ff8888",
            fontFamily: isLI ? LI_FONT : undefined,
            fontWeight: isLI ? 800 : undefined,
            letterSpacing: isLI ? "0.12em" : "0.2em",
            fontSize: isLI ? "11px" : "11px",
            textTransform: "uppercase",
          }} className="sidebar-title">{c.sidebarTitle}</div>
          <div style={{
            ...styles.sidebarCount,
            color: isLI ? LI.muted : "#00ff8855",
            fontFamily: isLI ? LI_FONT : undefined,
            fontWeight: isLI ? 600 : undefined,
          }}>{activeCount} {c.onlineLabel}</div>
          <div style={styles.userList} className="user-list">
            {Object.entries(users).map(([id, u]) => (
              <div
                key={id}
                style={{
                  ...styles.userItem,
                  borderBottom: isLI ? `1px solid ${LI.border}` : "1px solid #00ff4418",
                  borderRadius: isLI ? "6px" : "0",
                  padding: isLI ? "10px 8px" : "14px 0",
                  background: isLI && id === userId.current ? "rgba(240,180,41,0.07)" : undefined,
                }}
                className={`user-item${flashingUsers.has(id) ? " user-item-flash" : ""}`}
                onContextMenu={(e) => handleContextMenu(e, id, u.name)}
                onTouchEnd={(e) => handleTap(e, id, u.name)}
              >
                <span
                  style={{
                    ...styles.userDot,
                    background: id === userId.current ? (isLI ? LI.gold : "#fff") : (isLI ? LI.blue : "#00ff88"),
                    boxShadow: isLI
                      ? (id === userId.current ? `0 0 8px ${LI.goldGlow}` : `0 0 8px ${LI.blueGlow}`)
                      : "0 0 6px currentColor",
                  }}
                />
                <div style={styles.userInfo} className="user-info">
                  <span style={{
                    ...styles.userName2,
                    color: isLI ? LI.text : "#00ff88cc",
                    fontFamily: isLI ? LI_FONT : undefined,
                    fontWeight: isLI ? 700 : undefined,
                  }}>{u.name}</span>
                  {u.vibe && (
                    <span style={{
                      ...styles.userVibeBadge,
                      color: isLI ? LI.bg : "#00ff8888",
                      fontFamily: isLI ? LI_FONT : undefined,
                      background: isLI ? LI.blue : "transparent",
                      padding: isLI ? "2px 6px" : "0",
                      borderRadius: isLI ? "3px" : "0",
                      fontSize: "10px",
                      fontWeight: isLI ? 700 : undefined,
                      letterSpacing: isLI ? "0.02em" : undefined,
                    }}>
                      {c.quadrants[u.vibe].replace(/\n/g, " ")}
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
          ref={contextMenuRef}
          style={{
            ...styles.contextMenu,
            left: contextMenu.x,
            top: contextMenu.y,
            background: isLI ? LI.card : "#050e05",
            border: isLI ? `1px solid ${LI.borderBlue}` : "1px solid #00ff4444",
            boxShadow: isLI ? `${LI.shadow}, ${LI.shadowBlue}` : "0 0 20px #00ff4422",
            borderRadius: isLI ? "8px" : "0",
            fontFamily: isLI ? LI_FONT : undefined,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{
            ...styles.contextMenuUser,
            color: isLI ? LI.gold : "#00ff8855",
            borderBottom: isLI ? `1px solid ${LI.border}` : "1px solid #00ff4422",
            fontWeight: isLI ? 800 : undefined,
            letterSpacing: isLI ? "0.05em" : undefined,
          }}>{contextMenu.name}</div>
          {contextMenu.id !== userId.current && (
            <div style={{
              ...styles.contextMenuItem,
              color: isLI ? LI.blue : "#ff3355",
              fontWeight: isLI ? 600 : undefined,
            }} onClick={() => handleMessageUser(contextMenu.id, contextMenu.name)}>
              {c.contextMessage}
            </div>
          )}
          <div style={{ ...styles.contextMenuItem, color: isLI ? "#e74c3c" : "#ff3355", fontWeight: isLI ? 600 : undefined }} onClick={() => handleForceLogout(contextMenu.id)}>
            {c.contextRemove}
          </div>
        </div>
      )}

      {/* Message compose dialog */}
      {messageTarget && (
        <div style={styles.dialogOverlay} onClick={() => setMessageTarget(null)}>
          <div style={{
            ...styles.dialogBox,
            background: isLI ? LI.card : "#050e05",
            border: isLI ? `1px solid ${LI.borderBlue}` : "1px solid #00ff4466",
            boxShadow: isLI ? `${LI.shadow}, ${LI.shadowBlue}` : "0 0 40px #00ff4422",
            borderRadius: isLI ? "12px" : "0",
            fontFamily: isLI ? LI_FONT : undefined,
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              ...styles.dialogTitle,
              color: isLI ? LI.gold : "#00ff8888",
              fontFamily: isLI ? LI_FONT : undefined,
              fontWeight: isLI ? 800 : undefined,
              fontSize: isLI ? "16px" : "12px",
              letterSpacing: isLI ? "0.02em" : "0.2em",
            }}>{c.dialogTitlePrefix} {messageTarget.name}</div>
            <input
              style={{
                ...styles.dialogInput,
                color: isLI ? LI.text : "#00ff88",
                borderBottom: isLI ? `2px solid ${LI.blue}` : "1px solid #00ff8855",
                fontFamily: isLI ? LI_FONT : undefined,
                letterSpacing: isLI ? "0.02em" : "0.1em",
              }}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && sendMessage()}
              placeholder={c.dialogPlaceholder}
              autoFocus
              maxLength={80}
            />
            <div style={styles.dialogButtons}>
              <button style={{
                ...styles.dialogSend,
                background: isLI ? LI.gold : "transparent",
                border: isLI ? "none" : "1px solid #00ff88",
                color: isLI ? LI.bg : "#00ff88",
                borderRadius: isLI ? "6px" : "0",
                fontFamily: isLI ? LI_FONT : undefined,
                fontWeight: isLI ? 800 : undefined,
              }} onClick={sendMessage}>{c.sendBtn}</button>
              <button style={{
                ...styles.dialogCancel,
                fontFamily: isLI ? LI_FONT : undefined,
                borderRadius: isLI ? "24px" : "0",
              }} onClick={() => setMessageTarget(null)}>{c.cancelBtn}</button>
            </div>
          </div>
        </div>
      )}

      {/* Incoming message overlay — Twitter mode */}
      {incomingMessage && !isLI && (
        <div style={styles.messageOverlay} onClick={dismissMessage}>
          <div style={styles.messageFrom}>{c.incomingPrefix} {incomingMessage.fromName.toUpperCase()}</div>
          <div style={styles.messageText}>{incomingMessage.text.toUpperCase()}</div>
          <div style={styles.messageDismiss}>{c.dismissLabel}</div>
        </div>
      )}

      {/* Incoming message overlay — LinkedIn mode */}
      {incomingMessage && isLI && (
        <div style={styles.linkedInOverlay} onClick={dismissMessage}>
          <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
            <ConfettiPieces />
          </div>
          <div style={styles.linkedInCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.linkedInCardEmoji}>🎉</div>
            <div style={styles.linkedInCardTitle}>New Synergy Ping!</div>
            <div style={styles.linkedInCardFrom}>
              <strong>{incomingMessage.fromName}</strong> has reached out to leverage synergies with you
            </div>
            <div style={styles.linkedInCardMessage}>"{incomingMessage.text}"</div>
            <button style={styles.linkedInCardBtn} onClick={dismissMessage}>
              {c.dismissLabel}
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        ...styles.footer,
        color: isLI ? LI.muted : "#00ff8888",
        borderTop: isLI ? `1px solid ${LI.border}` : "none",
        paddingTop: isLI ? "12px" : "0",
        marginTop: isLI ? "16px" : "10px",
        fontFamily: isLI ? LI_FONT : undefined,
      }}>
        <div style={styles.footerLeft}>
          <span style={{ ...styles.footerDot, background: isLI ? LI.gold : "#fff", boxShadow: isLI ? `0 0 8px ${LI.goldGlow}` : "0 0 6px currentColor" }} /> YOU ({userName})
          &nbsp;&nbsp;|&nbsp;&nbsp;
          <span style={{ ...styles.footerDot, background: isLI ? LI.blue : "#00ff88", boxShadow: isLI ? `0 0 8px ${LI.blueGlow}` : "0 0 6px currentColor" }} /> {c.footerOthers}
        </div>
        <div style={styles.footerMid}>{c.footerMid}</div>
        <button style={{
          ...styles.logoutBtn,
          background: isLI ? "transparent" : "transparent",
          border: isLI ? `1px solid ${LI.border}` : "1px solid #00ff8855",
          color: isLI ? LI.muted : "#00ff88",
          borderRadius: isLI ? "6px" : "0",
          fontFamily: isLI ? LI_FONT : undefined,
        }} onClick={handleLogout}>
          {c.logoutBtn}
        </button>
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles: Record<string, CSSProperties> = {
  root: {
    height: "100vh",
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
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    writingMode: "vertical-rl",
    transform: "rotate(180deg)",
    fontSize: "11px",
    letterSpacing: "0.25em",
    color: "#00ff8866",
    whiteSpace: "nowrap",
    flexShrink: 0,
    width: "16px",
    userSelect: "none",
  },
  axisRight: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    writingMode: "vertical-rl",
    fontSize: "11px",
    letterSpacing: "0.25em",
    color: "#00ff8866",
    whiteSpace: "nowrap",
    flexShrink: 0,
    width: "16px",
    userSelect: "none",
  },
  gridWrapper: {
    display: "flex",
    gap: "12px",
    flex: 1,
    minHeight: 0,
  },
  gridWithAxes: {
    display: "flex",
    flexDirection: "row",
    flex: 1,
    minHeight: 0,
    minWidth: 0,
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
    minHeight: 0,
    overflow: "hidden",
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
    display: "block",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
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
  linkedInOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(8,15,26,0.85)",
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
    cursor: "pointer",
  },
  linkedInCard: {
    background: "#0d1e30",
    border: "1px solid rgba(240,180,41,0.4)",
    borderRadius: "16px",
    padding: "48px 40px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
    maxWidth: "480px",
    width: "90%",
    boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 40px rgba(240,180,41,0.2)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    position: "relative",
    zIndex: 1,
    animation: "linkedInPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)",
    cursor: "default",
  },
  linkedInCardEmoji: {
    fontSize: "64px",
    lineHeight: 1,
  },
  linkedInCardTitle: {
    fontSize: "28px",
    fontWeight: 900,
    color: "#f0b429",
    letterSpacing: "-0.03em",
    textAlign: "center",
    textShadow: "0 0 30px rgba(240,180,41,0.5)",
  },
  linkedInCardFrom: {
    fontSize: "14px",
    color: "#6b8aab",
    textAlign: "center",
    lineHeight: 1.6,
  },
  linkedInCardMessage: {
    fontSize: "18px",
    color: "#e8f0f8",
    textAlign: "center",
    lineHeight: 1.6,
    fontStyle: "italic",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "8px",
    padding: "16px 20px",
    width: "100%",
  },
  linkedInCardBtn: {
    marginTop: "8px",
    background: "#f0b429",
    border: "none",
    borderRadius: "6px",
    color: "#080f1a",
    padding: "14px 40px",
    fontSize: "15px",
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    animation: "linkedInPulse 2s 0.5s infinite",
  },
  modeToggle: {
    display: "flex",
    gap: "4px",
  },
  modeBtn: {
    background: "transparent",
    border: "1px solid transparent",
    fontSize: "10px",
    letterSpacing: "0.12em",
    padding: "4px 10px",
    cursor: "pointer",
    fontFamily: "'Share Tech Mono', monospace",
    transition: "all 0.2s",
  },
  modeBtnActive: {
    border: "1px solid #00ff8866",
    color: "#00ff88",
    boxShadow: "0 0 10px #00ff8833",
  },
  modeBtnActiveLinkedIn: {
    border: "1px solid rgba(240,180,41,0.6)",
    color: "#f0b429",
    boxShadow: "0 0 10px rgba(240,180,41,0.25)",
  },
  modeBtnInactive: {
    border: "1px solid #ffffff11",
    color: "#ffffff22",
  },
  modeBtnInactiveLI: {
    border: "1px solid rgba(255,255,255,0.12)",
    color: "rgba(255,255,255,0.3)",
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
