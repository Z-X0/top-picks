import { useState } from "react";
import { socket } from "../socket.js";

export default function Home() {
  const [name, setName] = useState(() => localStorage.getItem("tp_name") || "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const persistName = (n) => {
    setName(n);
    localStorage.setItem("tp_name", n);
  };

  const create = () => {
    if (!name.trim()) return setErr("Enter a name");
    setBusy(true);
    setErr("");
    socket.emit("room:create", { name: name.trim() }, (res) => {
      setBusy(false);
      if (!res?.ok) setErr(res?.error || "Failed");
    });
  };

  const join = () => {
    if (!name.trim()) return setErr("Enter a name");
    if (code.trim().length < 3) return setErr("Enter a room code");
    setBusy(true);
    setErr("");
    socket.emit("room:join", { name: name.trim(), code: code.trim().toUpperCase() }, (res) => {
      setBusy(false);
      if (!res?.ok) setErr(res?.error || "Failed");
    });
  };

  return (
    <div className="min-h-full flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-xl">
        <div className="text-center mb-10 animate-fade-in-up">
          <div className="inline-block px-3 py-1 rounded-full bg-white/10 text-xs uppercase tracking-widest text-white/70 mb-4">
            multiplayer · party game
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-bold leading-tight">
            top <span className="bg-gradient-to-r from-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">picks</span>
          </h1>
          <p className="text-white/60 mt-3 text-base sm:text-lg">
            Pick the top 3 songs from each album of an artist.
            <br />
            See whose taste matches the group.
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6 shadow-2xl animate-fade-in-up">
          <label className="block text-xs uppercase tracking-wider text-white/60 mb-2">your name</label>
          <input
            value={name}
            onChange={(e) => persistName(e.target.value)}
            maxLength={20}
            placeholder="DJ Khaled"
            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-lg outline-none focus:border-fuchsia-400/60 transition"
          />

          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <button
              onClick={create}
              disabled={busy}
              className="flex-1 px-5 py-3 rounded-xl font-semibold bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:brightness-110 active:scale-[0.99] transition disabled:opacity-50"
            >
              create room
            </button>
          </div>

          <div className="my-6 flex items-center gap-3 text-white/30 text-xs uppercase tracking-widest">
            <div className="h-px bg-white/10 flex-1" />
            or join
            <div className="h-px bg-white/10 flex-1" />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ROOM CODE"
              maxLength={6}
              className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-lg tracking-[0.4em] uppercase outline-none focus:border-cyan-300/60 transition text-center font-mono"
            />
            <button
              onClick={join}
              disabled={busy}
              className="px-5 py-3 rounded-xl font-semibold bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
            >
              join
            </button>
          </div>

          {err && <div className="text-rose-300 text-sm mt-4">{err}</div>}
        </div>

        <p className="text-center text-white/40 text-xs mt-6">
          host picks an artist · everyone ranks each album · best taste wins
        </p>
      </div>
    </div>
  );
}
