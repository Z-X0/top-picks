import { useEffect, useMemo, useState } from "react";
import { socket } from "../socket.js";
import TrackRow from "../components/TrackRow.jsx";

export default function Picking({ room, me, iAmHost }) {
  const album = room.currentAlbum?.album;
  const tracks = room.currentAlbum?.tracks || [];

  // Local pick order: array of track IDs in selection order, max 3
  const [picks, setPicks] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const [err, setErr] = useState("");

  // Reset local state when album changes
  useEffect(() => {
    setPicks([]);
    setSubmitted(false);
    setPlayingId(null);
    setErr("");
  }, [album?.id]);

  const togglePick = (trackId) => {
    if (submitted) return;
    setPicks((prev) => {
      if (prev.includes(trackId)) return prev.filter((id) => id !== trackId);
      if (prev.length >= 3) return prev;
      return [...prev, trackId];
    });
  };

  const submit = () => {
    if (picks.length !== 3) return setErr("Pick exactly 3");
    setErr("");
    socket.emit("game:submitPicks", { trackIds: picks }, (res) => {
      if (!res?.ok) setErr(res?.error || "Failed");
      else setSubmitted(true);
    });
  };

  const submittedCount = room.players.filter((p) => p.submitted).length;
  const totalPlayers = room.players.length;

  const meSubmitted = !!me?.submitted;

  const albumNumber = `${room.albumIndex + 1} / ${room.albums.length}`;

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
            album {albumNumber} · {room.artist?.name}
          </div>
          <h2 className="font-display text-3xl font-bold truncate">{album?.name}</h2>
          <div className="text-sm text-white/50 mt-1">
            pick your <span className="text-fuchsia-300 font-semibold">top 3</span> songs
          </div>
        </div>
      </div>

      {/* progress bar of submissions */}
      <div className="mb-5 flex items-center gap-3 text-xs text-white/60">
        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-fuchsia-500 to-cyan-300 transition-all"
            style={{ width: `${totalPlayers ? (submittedCount / totalPlayers) * 100 : 0}%` }}
          />
        </div>
        <div className="font-mono">{submittedCount}/{totalPlayers} ready</div>
      </div>

      {/* Track list */}
      <div className="flex flex-col gap-2 mb-24">
        {tracks.map((t) => {
          const idx = picks.indexOf(t.id);
          return (
            <TrackRow
              key={t.id}
              track={t}
              selected={idx !== -1}
              rank={idx + 1}
              onToggle={() => togglePick(t.id)}
              disabled={meSubmitted || (picks.length >= 3 && !picks.includes(t.id))}
              isPlaying={playingId === t.id}
              onPlay={() => setPlayingId(t.id)}
              onStop={() => setPlayingId(null)}
            />
          );
        })}
      </div>

      {/* Sticky submit bar */}
      <div className="fixed bottom-0 left-0 right-0 px-6 pb-6 pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-auto">
          <div className="bg-[#13131c]/95 backdrop-blur border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center gap-3">
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm font-bold ${
                    picks[i]
                      ? "bg-gradient-to-br from-fuchsia-500 to-pink-500 border-transparent"
                      : "border-white/15 text-white/30"
                  }`}
                >
                  {i + 1}
                </div>
              ))}
            </div>
            <div className="flex-1 text-sm text-white/60">
              {meSubmitted
                ? "submitted — waiting for others"
                : picks.length === 3
                ? "ready to lock in"
                : `pick ${3 - picks.length} more`}
            </div>
            {!meSubmitted ? (
              <button
                onClick={submit}
                disabled={picks.length !== 3}
                className="px-5 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:brightness-110 active:scale-[0.99] transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                lock in
              </button>
            ) : (
              <div className="px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 font-semibold text-sm animate-pulse-soft">
                locked
              </div>
            )}
          </div>
          {err && <div className="text-rose-300 text-sm mt-2 text-center">{err}</div>}
          {iAmHost && submittedCount > 0 && submittedCount < totalPlayers && (
            <div className="text-center mt-2">
              <button
                onClick={() => socket.emit("game:forceReveal")}
                className="text-xs text-white/50 hover:text-white/80 underline underline-offset-2"
              >
                reveal now (skip stragglers)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
