# top picks

A multiplayer party game built on top of the [aux-wars](https://github.com/woverfield/aux-wars) project.
Settle the music-taste argument: the host picks an artist, then everyone goes through that artist's albums one at a time and picks their **top 3 songs** from each album. After every album, the group's **consensus top 3** is revealed and each player scores +1 for each of their picks that matches the consensus. After every album has been played, the player with the highest total score wins — best taste = most aligned with the group.

No accounts. No API keys. Music data + 30s previews are pulled from the public iTunes Search API.

## game flow

1. **Home** — enter a name, create a room (4-letter code) or join one
2. **Lobby** — host searches for an artist; the app loads all of that artist's studio albums
3. **Picking** — for each album, every player chooses 3 songs (with 30s previews to refresh memory)
4. **Reveal** — once everyone has locked in (or the host force-reveals), the consensus top 3 is shown and the leaderboard updates
5. **Final** — after the last album, the player with the highest total wins. Host can `play again` to reset.

## tech

- React 19 + Vite + Tailwind v4 (client)
- Express + Socket.io (server)
- iTunes Search API (artist / album / track data + 30s mp3 previews)

## run locally

```bash
npm run install-all
npm start
```

Open http://localhost:5173.

The Vite dev server proxies `/api` and `/socket.io` to the Node server on port `3002`, so no extra `.env` is needed in development.

For deployment, set `VITE_SERVER_URL` in `client/.env` to the public URL of the Node server.

## changes from upstream

The original aux-wars game (pick a song that fits a creative prompt, then vote) has been replaced. Removed:

- Convex backend
- YouTube search proxy
- Prompt categories, custom prompts, snippet/feedback modals, analytics

Kept:

- Vite + React + Tailwind shell
- Express + Socket.io server shell

## winner mechanic

```
score(player) = Σ over all albums of |player.picks ∩ consensus_top_3(album)|
```

`consensus_top_3(album)` is the 3 most-voted songs across all players for that album, with track number as a tiebreaker. Maximum possible score per album is 3, so a perfect score is `3 × number_of_albums`.
