import { socket } from "../socket.js";

/** Deterministic vibrant color per player id (so the same person keeps the same chip color). */
function playerColor(id) {
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

export default function Reveal({ room, iAmHost }) {
  const reveal = room.lastReveal;
  if (!reveal) return null;

  const album = reveal.album;
  const tracks = reveal.trackVotes || [];
  const isLast = room.albumIndex >= room.albums.length - 1;
  const consensusIds = new Set(reveal.consensus.map((c) => c.id));

  // bar scale: max votes on this album so 100% width = top vote getter
  const maxVotes = Math.max(1, ...tracks.map((t) => t.votes));

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 animate-fade-in-up">
        <img
          src={album?.artwork}
          alt=""
          className="w-24 h-24 rounded-xl object-cover border border-white/10 shadow-xl"
        />
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-widest text-white/50">
            results · album {room.albumIndex + 1} / {room.albums.length}
          </div>
          <h2 className="font-display text-3xl font-bold truncate">{album?.name}</h2>
          <div className="text-xs text-white/40 mt-1">
            {reveal.totalVoters} voter{reveal.totalVoters === 1 ? "" : "s"} · top 3 highlighted
          </div>
        </div>
      </div>

      {/* Vote graph */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5 mb-24">
        <div className="flex flex-col gap-2.5">
          {tracks.map((t, i) => {
            const isTop = consensusIds.has(t.id);
            const widthPct = (t.votes / maxVotes) * 100;
            return (
              <div
                key={t.id}
                className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl bg-black/20 border border-white/5 overflow-hidden animate-fade-in-up"
                style={{ animationDelay: `${i * 0.03}s` }}
              >
                {/* bar fill */}
                <div
                  className={`absolute inset-y-0 left-0 ${
                    isTop
                      ? "bg-gradient-to-r from-fuchsia-500/50 to-pink-500/30"
                      : "bg-white/[0.06]"
                  } transition-all duration-700 ease-out`}
                  style={{ width: t.votes > 0 ? `${widthPct}%` : "0%" }}
                />
                <div className="absolute inset-y-0 left-0 w-[2px] bg-fuchsia-300/0" />

                {/* track number */}
                <div className="relative shrink-0 w-7 text-center text-sm text-white/40 font-mono">
                  {t.trackNumber}
                </div>

                {/* track name */}
                <div className="relative flex-1 min-w-0">
                  <div
                    className={`truncate ${
                      isTop ? "font-bold text-white" : "font-medium text-white/85"
                    }`}
                  >
                    {t.name}
                  </div>
                </div>

                {/* voter chips */}
                <div className="relative flex items-center gap-1 shrink-0">
                  {t.voters.map((v) => (
                    <div
                      key={v.id}
                      title={v.name}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border border-black/40 shadow"
                      style={{ background: playerColor(v.id) }}
                    >
                      {initials(v.name)}
                    </div>
                  ))}
                </div>

                {/* vote count */}
                <div
                  className={`relative shrink-0 w-10 text-right font-display text-lg font-bold tabular-nums ${
                    t.votes > 0 ? "text-white" : "text-white/30"
                  }`}
                >
                  {t.votes}
                </div>
              </div>
            );
          })}
        </div>

        {/* legend */}
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap gap-2">
          {room.players.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-1.5 text-xs bg-white/5 border border-white/10 rounded-full pl-1 pr-3 py-1"
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                style={{ background: playerColor(p.id) }}
              >
                {initials(p.name)}
              </div>
              <span className="text-white/80">{p.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky next bar */}
      <div className="fixed bottom-0 left-0 right-0 px-6 pb-6 pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-auto">
          <div className="bg-[#13131c]/95 backdrop-blur border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center gap-3">
            <div className="flex-1 text-sm text-white/60">
              {iAmHost
                ? isLast
                  ? "last album done — see final results"
                  : `next: album ${room.albumIndex + 2} of ${room.albums.length}`
                : "waiting for host…"}
            </div>
            {iAmHost && (
              <button
                onClick={() => socket.emit("game:nextAlbum")}
                className="px-5 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:brightness-110 active:scale-[0.99] transition"
              >
                {isLast ? "see results" : "next album"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
