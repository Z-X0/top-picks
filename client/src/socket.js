import { io } from "socket.io-client";

// In dev we proxy /socket.io through Vite to the server (see vite.config.js).
// In prod set VITE_SERVER_URL to the deployed server URL.
const url = import.meta.env.VITE_SERVER_URL || "/";

export const socket = io(url, {
  autoConnect: true,
  transports: ["websocket", "polling"],
});
