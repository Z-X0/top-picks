import { useGame } from "./useGame.js";
import Home from "./screens/Home.jsx";
import Lobby from "./screens/Lobby.jsx";
import Picking from "./screens/Picking.jsx";
import Reveal from "./screens/Reveal.jsx";
import Final from "./screens/Final.jsx";

export default function App() {
  const { room, me, iAmHost, connected, error, clearError } = useGame();

  return (
    <div className="min-h-full">
      {!connected && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-30 bg-rose-500/15 border border-rose-400/30 text-rose-200 text-xs px-3 py-1.5 rounded-full backdrop-blur">
          connecting…
        </div>
      )}
      {error && (
        <div
          className="fixed top-3 left-1/2 -translate-x-1/2 z-30 bg-rose-500/20 border border-rose-400/40 text-rose-100 text-sm px-4 py-2 rounded-full cursor-pointer"
          onClick={clearError}
        >
          {error} · tap to dismiss
        </div>
      )}

      {!room && <Home />}
      {room && room.phase === "lobby" && <Lobby room={room} iAmHost={iAmHost} />}
      {room && room.phase === "picking" && <Picking room={room} me={me} iAmHost={iAmHost} />}
      {room && room.phase === "reveal" && <Reveal room={room} iAmHost={iAmHost} />}
      {room && room.phase === "final" && <Final room={room} iAmHost={iAmHost} />}
    </div>
  );
}
