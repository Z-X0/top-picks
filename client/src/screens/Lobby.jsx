import { useEffect, useState } from "react";
import { socket } from "../socket.js";
import ArtistSearch from "../components/ArtistSearch.jsx";

export default function Lobby({ room, iAmHost }) {
  const [picking, setPicking] = useState(false);
  const [err, setErr] = useState("");

  // Set of album ids the host has selected to play. Default: all of them.
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Whenever the artist's album list changes, default-select everything.
  useEffect(() => {
    setSelectedIds(new Set(room.albums.map((a) => a.id)));
  }, [room.artist?.id, room.albums.length]);

  const setArtist = (artist) => {
    setPicking(true);
    setErr("");
    socket.emit("game:setArtist", { artist }, (res) => {
      setPicking(false);
      if (!res?.ok) setErr(res?.error || "Failed");
    });
  };

  const toggleAlbum = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(room.albums.map((a) => a.id)));
  const selectNone = () => setSelectedIds(new Set());

  const startGame = () => {
    setErr("");
    const albumIds = room.albums.filter((a) => selectedIds.has(a.id)).map((a) => a.id);
    socket.emit("game:start", { albumIds }, (res) => {
      if (!res?.ok) setErr(res?.error || "Failed");
    });
  };

  const selectedCount = selectedIds.size;
  const totalCount = room.albums.length;

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
          <div className="mt-6 animate-fade-in-up">
            <div className="flex items-end justify-between mb-3">
              <div>
                <div className="text-xs uppercase tracking-widest text-white/50">step 2 — choose albums</div>
                <div className="font-display text-xl font-bold">{room.artist.name}</div>
              </div>
              {iAmHost && (
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={selectAll}
                    className="px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 transition text-white/70"
                  >
                    all
                  </button>
                  <button
                    onClick={selectNone}
                    className="px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 transition text-white/70"
                  >
                    none
                  </button>
                  <span className="text-white/50 ml-1 tabular-nums">
                    {selectedCount} / {totalCount}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {room.albums.map((a) => {
                const selected = selectedIds.has(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => iAmHost && toggleAlbum(a.id)}
                    disabled={!iAmHost}
                    className={`group relative text-left transition ${
                      iAmHost ? "cursor-pointer" : "cursor-default"
                    }`}
                  >
                    <div
                      className={`relative rounded-xl overflow-hidden border transition ${
                        selected
                          ? "border-fuchsia-400/70 shadow-[0_0_0_2px_rgba(244,114,182,0.35)]"
                          : "border-white/10 opacity-40"
                      }`}
                    >
                      <img
                        src={a.artwork}
                        alt=""
                        className={`w-full aspect-square object-cover transition ${
                          selected ? "" : "grayscale"
                        }`}
                      />
                      {/* check badge */}
                      <div
                        className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition ${
                          selected
                            ? "bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white shadow-lg"
                            : "bg-black/60 border border-white/20 text-white/40"
                        }`}
                      >
                        {selected ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <span className="opacity-50">+</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 text-xs">
                      <div className={`truncate font-medium ${selected ? "text-white" : "text-white/50"}`}>
                        {a.name}
                      </div>
                      <div className="text-white/40">{a.year}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {!iAmHost && (
              <div className="mt-4 text-xs text-white/50">
                host is curating the setlist — {selectedCount > 0 ? `${selectedCount} album${selectedCount === 1 ? "" : "s"}` : "all albums"} so far
              </div>
            )}
          </div>
        )}

        {err && <div className="text-rose-300 text-sm mt-4">{err}</div>}

        <div className="mt-6">
          {iAmHost ? (
            <button
              onClick={startGame}
              disabled={!room.artist || selectedCount === 0}
              className="w-full px-5 py-3 rounded-xl font-semibold bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:brightness-110 active:scale-[0.99] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {selectedCount > 0
                ? `start game · ${selectedCount} album${selectedCount === 1 ? "" : "s"}`
                : "select at least one album"}
            </button>
          ) : (
            <div className="text-center text-white/50 text-sm">Host will start when ready.</div>
          )}
        </div>
      </div>
    </div>
  );
}
