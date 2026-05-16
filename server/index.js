/**
 * Top Picks - server entry point
 */
import { server } from "./server.js";

const PORT = process.env.PORT || 3002;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[top-picks] listening on http://localhost:${PORT}`);
});

server.on("error", (err) => {
  console.error("[top-picks] error:", err);
  process.exit(1);
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
