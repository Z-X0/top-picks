import { socket } from "../socket.js";

export default function Reveal({ room, iAmHost }) {
  const reveal = room.lastReveal;
  if (!reveal) return null;

  const album = reveal.album;
  const sortedPlayers = [...reveal.playerResults].sort((a, b) => b.totalScore - a.totalScore);
  const isLast = room.albumIndex >= room.albums.length - 1;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center gap-4 mb-6 animate-fade-in-up">
        <img
          src={album?.artwork}
          alt=""
          className="w-24 h-24 rounded-xl object-cover border border-white/10 shadow-xl"
        />
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-widest text-white/50">consensus top 3</div>
          <h2 className="font-display text-3xl font-bold truncate">{album?.name}</h2>
        </div>
      </div>

      {/* Consensus podium */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {reveal.consensus.map((c, i) => (
          <div
            key={c.id}
            className={`rounded-2xl p-4 border bg-white/5 animate-fade-in-up ${
              i === 0
                ? "border-amber-300/50 bg-gradient-to-b from-amber-400/15 to-transparent"
                : i === 1
                ? "border-slate-300/40"
                : "border-orange-400/30"
            }`}
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <div className="text-xs uppercase tracking-widest text-white/50">#{i + 1}</div>
            <div className="font-semibold mt-1 break-words">{c.name}</div>
            <div className="text-xs text-white/50 mt-2">
              {c.votes} {c.votes === 1 ? "vote" : "votes"}
            </div>
          </div>
        ))}
      </div>

      {/* Per-player results */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-24">
        <div className="text-xs uppercase tracking-widest text-white/50 mb-3">leaderboard</div>
        <div className="flex flex-col gap-2">
          {sortedPlayers.map((p, i) => (
            <div
              key={p.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-black/20 border border-white/10"
            >
              <div className="w-7 text-center text-white/50 font-mono">#{i + 1}</div>
              <div className="font-semibold flex-1 truncate">{p.name}</div>
              <div className="text-xs text-white/50 hidden sm:block">
                {p.matches} match{p.matches === 1 ? "" : "es"} this album
              </div>
              <div className="font-display text-2xl font-bold tabular-nums">{p.totalScore}</div>
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
