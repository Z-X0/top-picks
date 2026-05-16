import { useState } from "react";
import { socket } from "../socket.js";
import ArtistSearch from "../components/ArtistSearch.jsx";

export default function Lobby({ room, iAmHost }) {
  const [picking, setPicking] = useState(false);
  const [err, setErr] = useState("");

  const setArtist = (artist) => {
    setPicking(true);
    setErr("");
    socket.emit("game:setArtist", { artist }, (res) => {
      setPicking(false);
      if (!res?.ok) setErr(res?.error || "Failed");
    });
  };

  const startGame = () => {
    setErr("");
    socket.emit("game:start", {}, (res) => {
      if (!res?.ok) setErr(res?.error || "Failed");
    });
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between mb-8 animate-fade-in-up">
        <div>
          <div className="text-xs uppercase tracking-widest text-white/50">room code</div>
          <div className="font-mono text-4xl tracking-[0.3em] font-bold">{room.code}</div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-white/50">players</div>
          <div className="font-display text-2xl font-semibold">{room.players.length}</div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-8">
        {room.players.map((p) => (
          <div
            key={p.id}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold">{p.name}</span>
              {p.isHost && (
                <span className="text-[10px] uppercase tracking-widest bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-400/30 rounded-full px-2 py-0.5">
                  host
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="text-xs uppercase tracking-widest text-white/50 mb-3">step 1 — pick an artist</div>
        {iAmHost ? (
          <ArtistSearch onPick={setArtist} disabled={picking} />
        ) : (
          <div className="text-white/60">Waiting for the host to pick an artist…</div>
        )}

        {room.artist && (
          <div className="mt-5 p-4 bg-black/30 rounded-xl border border-white/10 animate-fade-in-up">
            <div className="text-xs uppercase tracking-widest text-white/50">selected</div>
            <div className="font-display text-2xl font-bold">{room.artist.name}</div>
            <div className="text-white/50 text-sm">{room.albums.length} albums loaded</div>
            {room.albums.length > 0 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {room.albums.slice(0, 12).map((a) => (
                  <div key={a.id} className="shrink-0 w-20">
                    <img
                      src={a.artwork}
                      alt=""
                      className="w-20 h-20 rounded-lg object-cover border border-white/10"
                    />
                    <div className="text-[11px] text-white/60 truncate mt-1">{a.year}</div>
                  </div>
                ))}
                {room.albums.length > 12 && (
                  <div className="shrink-0 w-20 h-20 flex items-center justify-center text-xs text-white/50 bg-white/5 rounded-lg border border-white/10">
                    +{room.albums.length - 12}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {err && <div className="text-rose-300 text-sm mt-3">{err}</div>}

        <div className="mt-6">
          {iAmHost ? (
            <button
              onClick={startGame}
              disabled={!room.artist || room.albums.length === 0}
              className="w-full px-5 py-3 rounded-xl font-semibold bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:brightness-110 active:scale-[0.99] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              start game
            </button>
          ) : (
            <div className="text-center text-white/50 text-sm">Host will start when ready.</div>
          )}
        </div>
      </div>
    </div>
  );
}
