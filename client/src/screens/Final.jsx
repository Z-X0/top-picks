import { socket } from "../socket.js";

export default function Final({ room, iAmHost }) {
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const maxPossible = room.albums.length * 3;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="text-center mb-10 animate-fade-in-up">
        <div className="text-xs uppercase tracking-widest text-white/50 mb-3">winner</div>
        <h1 className="font-display text-6xl font-bold bg-gradient-to-r from-amber-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
          {winner?.name}
        </h1>
        <div className="text-white/60 mt-3">
          best taste · {winner?.score} / {maxPossible} consensus matches
        </div>
        <div className="text-white/40 text-sm mt-1">
          {room.artist?.name} · {room.albums.length} albums
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8">
        <div className="text-xs uppercase tracking-widest text-white/50 mb-3">final standings</div>
        <div className="flex flex-col gap-2">
          {sorted.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                i === 0
                  ? "bg-gradient-to-r from-amber-400/15 to-transparent border-amber-300/40"
                  : "bg-black/20 border-white/10"
              }`}
            >
              <div className="w-8 text-center font-mono text-white/50">#{i + 1}</div>
              <div className="font-semibold flex-1 truncate">{p.name}</div>
              <div className="font-display text-2xl font-bold tabular-nums">{p.score}</div>
            </div>
          ))}
        </div>
      </div>

      {iAmHost && (
        <div className="flex gap-3">
          <button
            onClick={() => socket.emit("game:playAgain")}
            className="flex-1 px-5 py-3 rounded-xl font-semibold bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:brightness-110 active:scale-[0.99] transition"
          >
            play again
          </button>
        </div>
      )}
      {!iAmHost && (
        <div className="text-center text-white/50 text-sm">waiting for host to play again…</div>
      )}
    </div>
  );
}
