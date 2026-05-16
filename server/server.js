/**
 * Top Picks - Game Server
 *
 * Express + Socket.io server that handles:
 *  - Lobby/room management
 *  - Real-time game state (host picks an artist, players choose top 3 per album)
 *  - iTunes Search API proxy (artist search, album lookup, track lookup)
 *
 * No external API keys required. iTunes Search API is free and public.
 */
import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import cors from "cors";
import { Server } from "socket.io";

const ITUNES_BASE = "https://itunes.apple.com";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
export const server = http.createServer(app);

const corsOriginFunction = (origin, callback) => {
  if (!origin) return callback(null, true);
  if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
    return callback(null, true);
  }
  // Allow any origin in this minimal demo. Lock down in production.
  return callback(null, true);
};

app.use(cors({ origin: corsOriginFunction, methods: ["GET", "POST"], credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "top-picks", time: new Date().toISOString() });
});

/* ------------------------------------------------------------------ */
/* iTunes proxy                                                        */
/* ------------------------------------------------------------------ */

async function itunesFetch(path) {
  const url = `${ITUNES_BASE}${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`itunes ${res.status}`);
  return res.json();
}

function upgradeArtwork(url, size = 600) {
  if (!url) return url;
  return url.replace(/\/\d+x\d+(bb)?\./, `/${size}x${size}bb.`);
}

// Filter out non-studio releases (EPs, live, remix collections, singles, etc.)
const NON_STUDIO_PATTERNS = [
  /\bb-sides?\b/i,
  /\bremix(es|ed)?\b/i,
  /\blive\b/i,
  /\bdeluxe edition\b/i, // skip duplicate deluxe variants
  /\bep\b/i,
  /\bsingle\b/i,
  /\bsoundtrack\b/i,
  /\binstrumentals?\b/i,
  /\bdemos?\b/i,
  /\bunplugged\b/i,
];

function isStudioAlbum(name) {
  if (!name) return false;
  return !NON_STUDIO_PATTERNS.some((re) => re.test(name));
}

/** Normalised album lookup shared by /api/artist/:id/albums and game:setArtist */
async function fetchArtistAlbums(artistId) {
  const data = await itunesFetch(`/lookup?id=${artistId}&entity=album&limit=200`);
  const items = data.results || [];
  const seen = new Set();
  return items
    .filter((x) => x.wrapperType === "collection" && x.collectionType === "Album")
    .map((a) => ({
      id: a.collectionId,
      name: a.collectionName,
      artist: a.artistName,
      year: a.releaseDate ? new Date(a.releaseDate).getFullYear() : null,
      trackCount: a.trackCount,
      artwork: upgradeArtwork(a.artworkUrl100, 600),
    }))
    .filter((a) => {
      if (a.trackCount < 5) return false;
      if (!isStudioAlbum(a.name)) return false;
      const key = a.name.toLowerCase().replace(/\s*\(.*?\)\s*/g, "").trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (a.year || 0) - (b.year || 0));
}

/** Search for artists by name. */
app.get("/api/search/artist", async (req, res) => {
  try {
    const term = (req.query.q || "").toString().trim();
    if (term.length < 2) return res.json({ artists: [] });
    const data = await itunesFetch(
      `/search?term=${encodeURIComponent(term)}&entity=musicArtist&limit=15`
    );
    const artists = (data.results || []).map((a) => ({
      id: a.artistId,
      name: a.artistName,
      genre: a.primaryGenreName,
    }));
    res.json({ artists });
  } catch (e) {
    console.error("search/artist failed", e);
    res.status(500).json({ error: "search failed" });
  }
});

/** List albums for a given artist (studio albums only, deduped). */
app.get("/api/artist/:id/albums", async (req, res) => {
  try {
    const albums = await fetchArtistAlbums(req.params.id);
    res.json({ albums });
  } catch (e) {
    console.error("artist/:id/albums failed", e);
    res.status(500).json({ error: "lookup failed" });
  }
});

/** Get tracks for an album. */
app.get("/api/album/:id/tracks", async (req, res) => {
  try {
    const id = req.params.id;
    const data = await itunesFetch(`/lookup?id=${id}&entity=song&limit=200`);
    const items = data.results || [];
    const album = items.find((x) => x.wrapperType === "collection");
    const tracks = items
      .filter((x) => x.wrapperType === "track" && x.kind === "song")
      .sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0))
      .map((t) => ({
        id: t.trackId,
        name: t.trackName,
        trackNumber: t.trackNumber,
        durationMs: t.trackTimeMillis,
        previewUrl: t.previewUrl, // 30s mp3 preview
      }));
    res.json({
      album: album
        ? {
            id: album.collectionId,
            name: album.collectionName,
            artist: album.artistName,
            artwork: upgradeArtwork(album.artworkUrl100, 600),
          }
        : null,
      tracks,
    });
  } catch (e) {
    console.error("album/:id/tracks failed", e);
    res.status(500).json({ error: "lookup failed" });
  }
});

/* ------------------------------------------------------------------ */
/* Game state                                                          */
/* ------------------------------------------------------------------ */

/** @type {Map<string, Room>} */
const rooms = new Map();

const MAX_CHAT_HISTORY = 200;
const MAX_CHAT_LENGTH = 500;

/** Pull the real client IP, accounting for Railway/Heroku style x-forwarded-for. */
function clientIp(socket) {
  const xff = socket.handshake.headers["x-forwarded-for"];
  if (xff) return xff.toString().split(",")[0].trim();
  const real = socket.handshake.headers["x-real-ip"];
  if (real) return real.toString();
  // socket.handshake.address comes back as "::ffff:1.2.3.4" sometimes — trim it
  const addr = socket.handshake.address || "";
  return addr.replace(/^::ffff:/, "");
}

let chatIdCounter = 0;
function pushChat(room, msg) {
  const full = { id: ++chatIdCounter, ts: Date.now(), ...msg };
  room.chat.push(full);
  if (room.chat.length > MAX_CHAT_HISTORY) {
    room.chat.splice(0, room.chat.length - MAX_CHAT_HISTORY);
  }
  return full;
}

/**
 * @typedef {Object} Player
 * @property {string} id - socket id
 * @property {string} name
 * @property {boolean} isHost
 * @property {number} score
 *
 * @typedef {Object} Room
 * @property {string} code
 * @property {string} hostId
 * @property {Map<string, Player>} players
 * @property {'lobby'|'picking'|'reveal'|'final'} phase
 * @property {Object|null} artist
 * @property {Array} albums
 * @property {number} albumIndex
 * @property {Object|null} currentAlbum  // { album, tracks }
 * @property {Map<string, number[]>} picks  // socketId -> [trackId, trackId, trackId]
 * @property {Object|null} lastReveal
 */

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function publicRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      score: p.score,
      submitted: room.picks.has(p.id),
    })),
    artist: room.artist,
    albums: room.albums.map((a) => ({ id: a.id, name: a.name, year: a.year, artwork: a.artwork })),
    albumIndex: room.albumIndex,
    currentAlbum: room.currentAlbum,
    lastReveal: room.lastReveal,
    chat: room.chat,
  };
}

function broadcast(io, code) {
  const room = rooms.get(code);
  if (!room) return;
  io.to(code).emit("room:state", publicRoom(room));
}

function computeReveal(room) {
  const album = room.currentAlbum?.album;
  const tracks = room.currentAlbum?.tracks || [];

  // For each track, build the list of voters (player ids + names).
  // voters: trackId -> Array<{ id, name }>
  const voters = new Map();
  for (const [playerId, picks] of room.picks.entries()) {
    const player = room.players.get(playerId);
    if (!player) continue;
    for (const trackId of picks) {
      if (!voters.has(trackId)) voters.set(trackId, []);
      voters.get(trackId).push({ id: player.id, name: player.name });
    }
  }

  // Build the per-track vote summary used for the bar graph.
  // Sorted by track number so the album reads top-to-bottom in tracklist order.
  const trackVotes = tracks.map((t) => {
    const vs = voters.get(t.id) || [];
    return {
      id: t.id,
      name: t.name,
      trackNumber: t.trackNumber,
      votes: vs.length,
      voters: vs,
    };
  });

  // Consensus = top 3 by votes, tiebreak by track number
  const consensus = [...trackVotes]
    .sort((a, b) => b.votes - a.votes || a.trackNumber - b.trackNumber)
    .slice(0, 3);
  const consensusIds = new Set(consensus.map((c) => c.id));

  // Update running totals AND build per-player results for this album
  const playerResults = [...room.players.values()].map((p) => {
    const picks = room.picks.get(p.id) || [];
    const matches = picks.filter((id) => consensusIds.has(id)).length;
    p.score += matches;
    return {
      id: p.id,
      name: p.name,
      matches,
      totalScore: p.score,
    };
  });

  return {
    album,
    trackVotes,
    consensus: consensus.map((c) => ({
      id: c.id,
      name: c.name,
      trackNumber: c.trackNumber,
      votes: c.votes,
    })),
    playerResults,
    totalVoters: room.picks.size,
  };
}

/* ------------------------------------------------------------------ */
/* Static client (production)                                          */
/* ------------------------------------------------------------------ */
// In production we serve the built React client from this same server so
// everything lives on one Railway URL.
const clientDist = path.resolve(__dirname, "../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback: any non-API GET returns index.html
  app.get(/^\/(?!api|socket\.io).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
  console.log(`[top-picks] serving static client from ${clientDist}`);
} else {
  console.log(`[top-picks] no client/dist found — running API only`);
}

/* ------------------------------------------------------------------ */
/* Socket.io                                                           */
/* ------------------------------------------------------------------ */

const io = new Server(server, {
  cors: { origin: corsOriginFunction, methods: ["GET", "POST"], credentials: true },
});

io.on("connection", (socket) => {
  // helpers scoped to this socket
  const getRoomFromSocket = () => {
    for (const r of rooms.values()) if (r.players.has(socket.id)) return r;
    return null;
  };

  socket.on("room:create", ({ name }, ack) => {
    const playerName = (name || "Player").toString().slice(0, 20);
    const ip = clientIp(socket);
    const code = makeCode();
    const room = {
      code,
      hostId: socket.id,
      players: new Map(),
      phase: "lobby",
      artist: null,
      albums: [],
      albumIndex: -1,
      currentAlbum: null,
      picks: new Map(),
      lastReveal: null,
      chat: [],
    };
    room.players.set(socket.id, {
      id: socket.id, name: playerName, isHost: true, score: 0, ip,
    });
    rooms.set(code, room);
    socket.join(code);
    pushChat(room, {
      kind: "system",
      text: `${playerName} created the room`,
    });
    ack?.({ ok: true, code });
    broadcast(io, code);
  });

  socket.on("room:join", ({ code, name }, ack) => {
    code = (code || "").toString().toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return ack?.({ ok: false, error: "Room not found" });
    if (room.phase !== "lobby") return ack?.({ ok: false, error: "Game already in progress" });
    const playerName = (name || "Player").toString().slice(0, 20);
    const ip = clientIp(socket);
    room.players.set(socket.id, {
      id: socket.id, name: playerName, isHost: false, score: 0, ip,
    });
    socket.join(code);
    pushChat(room, {
      kind: "system",
      text: `${playerName} joined`,
    });
    ack?.({ ok: true, code });
    broadcast(io, code);
  });

  socket.on("chat:send", ({ text }, ack) => {
    const room = getRoomFromSocket();
    if (!room) return ack?.({ ok: false, error: "no room" });
    const player = room.players.get(socket.id);
    if (!player) return ack?.({ ok: false, error: "not in room" });
    const clean = (text || "").toString().slice(0, MAX_CHAT_LENGTH).trim();
    if (!clean) return ack?.({ ok: false, error: "empty" });
    pushChat(room, {
      kind: "msg",
      playerId: player.id,
      name: player.name,
      text: clean,
    });
    ack?.({ ok: true });
    broadcast(io, room.code);
  });

  socket.on("game:setArtist", async ({ artist }, ack) => {
    const room = getRoomFromSocket();
    if (!room || room.hostId !== socket.id) return ack?.({ ok: false, error: "not host" });
    if (room.phase !== "lobby") return ack?.({ ok: false, error: "not in lobby" });
    if (!artist || !artist.id || !artist.name) return ack?.({ ok: false, error: "bad artist" });

    try {
      const albums = await fetchArtistAlbums(artist.id);
      if (albums.length === 0) return ack?.({ ok: false, error: "No albums found" });
      room.artist = { id: artist.id, name: artist.name };
      room.albums = albums;
      ack?.({ ok: true, count: albums.length });
      broadcast(io, room.code);
    } catch (e) {
      console.error(e);
      ack?.({ ok: false, error: "Failed to load albums" });
    }
  });

  socket.on("game:start", async (payload, ack) => {
    const room = getRoomFromSocket();
    if (!room || room.hostId !== socket.id) return ack?.({ ok: false, error: "not host" });
    if (room.phase !== "lobby") return ack?.({ ok: false, error: "already started" });
    if (!room.artist || room.albums.length === 0) return ack?.({ ok: false, error: "no artist set" });
    if (room.players.size < 1) return ack?.({ ok: false, error: "no players" });

    // Optional: host can pass a subset of album ids to play (and re-order them).
    const requested = Array.isArray(payload?.albumIds) ? payload.albumIds : null;
    if (requested && requested.length > 0) {
      const idSet = new Set(requested.map(Number));
      const byId = new Map(room.albums.map((a) => [a.id, a]));
      // Preserve the order requested by the host
      const filtered = requested.map(Number).map((id) => byId.get(id)).filter(Boolean);
      if (filtered.length === 0) return ack?.({ ok: false, error: "no valid albums" });
      // also keep any others out (only the selected ones survive)
      room.albums = filtered.filter((a) => idSet.has(a.id));
    }

    room.albumIndex = -1;
    await loadNextAlbum(room);
    ack?.({ ok: true });
  });

  async function loadNextAlbum(room) {
    room.albumIndex += 1;
    if (room.albumIndex >= room.albums.length) {
      room.phase = "final";
      room.currentAlbum = null;
      broadcast(io, room.code);
      return;
    }
    const album = room.albums[room.albumIndex];
    try {
      const data = await itunesFetch(`/lookup?id=${album.id}&entity=song&limit=200`);
      const items = data.results || [];
      const tracks = items
        .filter((x) => x.wrapperType === "track" && x.kind === "song")
        .sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0))
        .map((t) => ({
          id: t.trackId,
          name: t.trackName,
          trackNumber: t.trackNumber,
          durationMs: t.trackTimeMillis,
          previewUrl: t.previewUrl,
        }));
      room.currentAlbum = { album, tracks };
      room.picks = new Map();
      room.phase = "picking";
      room.lastReveal = null;
      broadcast(io, room.code);
    } catch (e) {
      console.error("loadNextAlbum failed", e);
      io.to(room.code).emit("room:error", { message: "Failed to load album" });
    }
  }

  socket.on("game:submitPicks", ({ trackIds }, ack) => {
    const room = getRoomFromSocket();
    if (!room) return ack?.({ ok: false, error: "no room" });
    if (room.phase !== "picking") return ack?.({ ok: false, error: "not in picking phase" });
    if (!Array.isArray(trackIds) || trackIds.length !== 3) {
      return ack?.({ ok: false, error: "must pick exactly 3" });
    }
    const validIds = new Set((room.currentAlbum?.tracks || []).map((t) => t.id));
    const clean = [...new Set(trackIds.map((n) => Number(n)))].filter((id) => validIds.has(id));
    if (clean.length !== 3) return ack?.({ ok: false, error: "invalid tracks" });

    room.picks.set(socket.id, clean);
    ack?.({ ok: true });
    broadcast(io, room.code);

    // If everyone has submitted, reveal automatically
    if (room.picks.size >= room.players.size) {
      const reveal = computeReveal(room);
      room.lastReveal = reveal;
      room.phase = "reveal";
      broadcast(io, room.code);
    }
  });

  socket.on("game:nextAlbum", async (_payload, ack) => {
    const room = getRoomFromSocket();
    if (!room || room.hostId !== socket.id) return ack?.({ ok: false, error: "not host" });
    if (room.phase !== "reveal") return ack?.({ ok: false, error: "not in reveal phase" });
    ack?.({ ok: true });
    await loadNextAlbum(room);
  });

  socket.on("game:forceReveal", (_payload, ack) => {
    const room = getRoomFromSocket();
    if (!room || room.hostId !== socket.id) return ack?.({ ok: false, error: "not host" });
    if (room.phase !== "picking") return ack?.({ ok: false, error: "not in picking" });
    if (room.picks.size === 0) return ack?.({ ok: false, error: "no picks yet" });
    const reveal = computeReveal(room);
    room.lastReveal = reveal;
    room.phase = "reveal";
    ack?.({ ok: true });
    broadcast(io, room.code);
  });

  socket.on("game:playAgain", (_payload, ack) => {
    const room = getRoomFromSocket();
    if (!room || room.hostId !== socket.id) return ack?.({ ok: false, error: "not host" });
    room.phase = "lobby";
    room.artist = null;
    room.albums = [];
    room.albumIndex = -1;
    room.currentAlbum = null;
    room.picks = new Map();
    room.lastReveal = null;
    for (const p of room.players.values()) p.score = 0;
    ack?.({ ok: true });
    broadcast(io, room.code);
  });

  socket.on("disconnect", () => {
    const room = getRoomFromSocket();
    if (!room) return;
    const leaving = room.players.get(socket.id);
    room.players.delete(socket.id);
    room.picks.delete(socket.id);
    if (room.players.size === 0) {
      rooms.delete(room.code);
      return;
    }
    if (leaving) {
      pushChat(room, {
        kind: "system",
        text: `${leaving.name} left`,
      });
    }
    if (room.hostId === socket.id) {
      const next = [...room.players.values()][0];
      next.isHost = true;
      room.hostId = next.id;
      pushChat(room, {
        kind: "system",
        text: `${next.name} is now host`,
      });
    }
    // If everyone submitted after disconnect, advance reveal
    if (room.phase === "picking" && room.picks.size >= room.players.size && room.picks.size > 0) {
      const reveal = computeReveal(room);
      room.lastReveal = reveal;
      room.phase = "reveal";
    }
    broadcast(io, room.code);
  });
});
