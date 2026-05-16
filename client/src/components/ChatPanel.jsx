import { useEffect, useRef, useState } from "react";
import { socket } from "../socket.js";

function playerColor(id) {
  if (!id) return "hsl(0 0% 50%)";
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 80% 62%)`;
}
function initials(name) {
  return (name || "?")
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
function timeOf(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Floating chat panel. Pinned bottom-right. Collapses to a chat bubble.
 * Shows IP next to each player's name.
 */
export default function ChatPanel({ room, meId }) {
  // Lift the bubble higher in phases that have a sticky bottom bar (picking/reveal)
  const hasStickyBar = room?.phase === "picking" || room?.phase === "reveal";
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef(null);
  const lastSeenIdRef = useRef(0);

  const messages = room?.chat || [];

  // Auto-scroll on new messages while open; track unread when closed
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    if (open) {
      lastSeenIdRef.current = last.id;
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      });
    } else {
      const newCount = messages.filter((m) => m.id > lastSeenIdRef.current).length;
      setUnread(newCount);
    }
  }, [messages.length, open]);

  // When the panel opens, mark all as seen
  useEffect(() => {
    if (open) {
      const last = messages[messages.length - 1];
      if (last) lastSeenIdRef.current = last.id;
      setUnread(0);
    }
  }, [open]);

  if (!room) return null;

  const send = () => {
    const t = text.trim();
    if (!t) return;
    socket.emit("chat:send", { text: t });
    setText("");
  };

  return (
    <>
      {/* Toggle bubble */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed z-40 right-4 sm:right-6 w-14 h-14 rounded-full shadow-2xl bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white flex items-center justify-center hover:brightness-110 active:scale-95 transition ${
          hasStickyBar ? "bottom-28 sm:bottom-28" : "bottom-4 sm:bottom-6"
        }`}
        aria-label="toggle chat"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {!open && unread > 0 && (
          <div className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-amber-300 text-black text-[11px] font-bold flex items-center justify-center border-2 border-[#0b0b12]">
            {unread > 99 ? "99+" : unread}
          </div>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed z-40 inset-0 sm:inset-auto sm:bottom-24 sm:right-6 sm:w-[380px] sm:h-[520px] bg-[#0f0f17]/98 backdrop-blur sm:rounded-2xl border-0 sm:border border-white/10 shadow-2xl flex flex-col animate-fade-in-up">
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div>
              <div className="font-display text-lg font-bold">room chat</div>
              <div className="text-[11px] text-white/40">
                {room.players.length} connected · room {room.code}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/50 hover:text-white p-2"
              aria-label="close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Connected players */}
          <div className="px-4 py-2 border-b border-white/10 bg-white/[0.02]">
            <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1.5">
              players
            </div>
            <div className="flex flex-col gap-1 max-h-28 overflow-y-auto scrollbar-thin">
              {room.players.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-xs">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                    style={{ background: playerColor(p.id) }}
                  >
                    {initials(p.name)}
                  </div>
                  <span className={`font-medium ${p.id === meId ? "text-fuchsia-300" : "text-white/85"}`}>
                    {p.name}
                    {p.id === meId && <span className="text-white/40 font-normal"> (you)</span>}
                  </span>
                  {p.isHost && (
                    <span className="ml-auto text-[9px] uppercase tracking-widest bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-400/30 rounded-full px-1.5">
                      host
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin">
            {messages.length === 0 ? (
              <div className="text-center text-white/30 text-sm mt-12">
                no messages yet — start something
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {messages.map((m) =>
                  m.kind === "system" ? (
                    <div key={m.id} className="text-center text-[11px] text-white/40 italic">
                      {m.text}
                    </div>
                  ) : (
                    <div key={m.id} className="flex gap-2">
                      <div
                        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{ background: playerColor(m.playerId) }}
                      >
                        {initials(m.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span
                            className={`text-sm font-semibold truncate ${
                              m.playerId === meId ? "text-fuchsia-300" : "text-white"
                            }`}
                          >
                            {m.name}
                          </span>
                          <span className="text-[10px] text-white/30 ml-auto">{timeOf(m.ts)}</span>
                        </div>
                        <div className="text-sm text-white/90 mt-0.5 break-words whitespace-pre-wrap">
                          {m.text}
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-white/10 p-2 flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              maxLength={500}
              placeholder="say something…"
              className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-fuchsia-400/60"
            />
            <button
              onClick={send}
              disabled={!text.trim()}
              className="px-4 py-2 rounded-xl font-semibold bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:brightness-110 active:scale-95 transition text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
