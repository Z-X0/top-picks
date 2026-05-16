import { useEffect, useRef, useState } from "react";

/**
 * A track row with a tiny preview play button (30s mp3 from iTunes).
 * Coordinates with siblings via an optional onPlay callback so only one plays at a time.
 */
export default function TrackRow({
  track,
  selected,
  rank,
  onToggle,
  disabled,
  isPlaying,
  onPlay,
  onStop,
}) {
  const audioRef = useRef(null);
  const [progress, setProgress] = useState(0);

  // Stash the latest onStop in a ref so the play/pause effect doesn't depend on it.
  // Without this, every parent re-render (e.g. when another player locks in)
  // would change onStop's identity, re-fire this effect, and restart the audio.
  const onStopRef = useRef(onStop);
  useEffect(() => {
    onStopRef.current = onStop;
  }, [onStop]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (isPlaying) {
      a.currentTime = 0;
      a.play().catch(() => onStopRef.current?.());
    } else {
      a.pause();
      setProgress(0);
    }
  }, [isPlaying]);

  return (
    <div
      className={`group relative flex items-center gap-3 px-3 py-3 rounded-xl border transition cursor-pointer ${
        selected
          ? "bg-fuchsia-500/15 border-fuchsia-400/50"
          : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06]"
      } ${disabled && !selected ? "opacity-40 cursor-not-allowed" : ""}`}
      onClick={() => !disabled || selected ? onToggle() : null}
    >
      {/* play button */}
      {track.previewUrl ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            isPlaying ? onStop?.() : onPlay?.();
          }}
          className="shrink-0 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
          aria-label={isPlaying ? "pause" : "play"}
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      ) : (
        <div className="shrink-0 w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-white/30 text-xs">
          —
        </div>
      )}

      <div className="shrink-0 w-6 text-center text-sm text-white/40 font-mono">{track.trackNumber}</div>

      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{track.name}</div>
      </div>

      {/* selection chip */}
      <div
        className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition ${
          selected
            ? "bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white"
            : "bg-white/5 text-white/40 border border-white/10 group-hover:text-white/70"
        }`}
      >
        {selected ? rank : "+"}
      </div>

      <audio
        ref={audioRef}
        src={track.previewUrl || ""}
        preload="none"
        onTimeUpdate={(e) => setProgress(e.target.currentTime / (e.target.duration || 30))}
        onEnded={() => onStop?.()}
      />

      {isPlaying && (
        <div
          className="absolute left-0 bottom-0 h-[2px] bg-fuchsia-400/80 rounded-b-xl"
          style={{ width: `${Math.min(100, progress * 100)}%` }}
        />
      )}
    </div>
  );
}
