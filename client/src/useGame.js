import { useEffect, useState } from "react";
import { socket } from "./socket.js";

/**
 * Subscribes to room state from the server.
 * Returns:
 *   me          - { id, ... } for the current socket
 *   room        - latest public room state, or null if not in one
 *   error       - last broadcast error message
 *   connected   - socket connection state
 */
export function useGame() {
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(socket.connected);
  const [meId, setMeId] = useState(socket.id || null);

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      setMeId(socket.id);
    };
    const onDisconnect = () => setConnected(false);
    const onState = (r) => setRoom(r);
    const onError = ({ message }) => setError(message);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room:state", onState);
    socket.on("room:error", onError);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room:state", onState);
      socket.off("room:error", onError);
    };
  }, []);

  const me = room && meId ? room.players.find((p) => p.id === meId) : null;
  const iAmHost = !!(room && meId && room.hostId === meId);

  return { room, me, meId, iAmHost, error, connected, clearError: () => setError(null) };
}
