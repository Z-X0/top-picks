import { useEffect, useRef, useState } from "react";

/**
 * Live-search input that calls /api/search/artist on the server.
 * Calls onPick({ id, name }) when an artist is clicked.
 */
export default function ArtistSearch({ onPick, disabled }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search/artist?q=${encodeURIComponent(q.trim())}`);
        const data = await res.json();
        setResults(data.artists || []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [q]);

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        disabled={disabled}
        placeholder="search an artist…"
        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-lg outline-none focus:border-fuchsia-400/60 transition disabled:opacity-60"
      />
      {loading && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/40 animate-pulse-soft">
          searching…
        </div>
      )}
      {open && results.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-2 bg-[#16161f] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto scrollbar-thin">
          {results.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                onPick({ id: a.id, name: a.name });
                setOpen(false);
                setQ(a.name);
              }}
              className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center justify-between gap-3 transition"
            >
              <span className="font-medium">{a.name}</span>
              <span className="text-xs text-white/40">{a.genre}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
