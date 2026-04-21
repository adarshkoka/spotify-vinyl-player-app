# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Dev server at http://127.0.0.1:5173
npm run build      # TypeScript check + Vite production build
npm run lint       # ESLint with TypeScript-aware rules
npm run preview    # Preview the production build locally
npm run deploy     # Build and push to GitHub Pages (gh-pages -d dist)
```

No test suite is configured.

## Architecture

This is a React 19 + TypeScript + Vite SPA that renders an animated vinyl record player synchronized to the user's Spotify playback. It deploys to GitHub Pages.

### Auth & API (`src/utils/auth.ts`, `src/services/spotifyService.ts`, `src/App.tsx`)

Spotify OAuth uses the PKCE flow. `App.tsx` handles the callback, token exchange, and routes between `LoginPage` and `MainAppPage`. Tokens are stored in `localStorage`; refresh happens proactively when within 60s of expiry. `spotifyService.ts` is the central API layer — it auto-refreshes on 401 and uses a promise-based lock to prevent concurrent refresh calls. Polling for current playback runs every 3000ms and pauses when the tab is hidden.

### State Management — Custom Hooks (`src/hooks/`)

All state lives in hooks composed in `MainAppPage`:

- **`useSpotifyPlayback`** — Polls current track, exposes play/pause/skip controls.
- **`useTrackTransition`** — 9-stage animation state machine (`TransitionStage` enum in `src/types/player.ts`): `empty → jacket-enter → disc-emerge → disc-center → disc-rest → disc-place → playing/paused/eject`. Transitions advance via `setTimeout` timed to CSS animation durations.
- **`useDiscScrub`** — Pointer/touch event handler for rotating the disc to seek; throttles Spotify seek API calls to 300ms minimum.
- **`usePlayerColors`** — LocalStorage-backed color state; material presets (wood/aluminum/silver/gold) map to color values.
- **`useTracklistPanel`** — Panel open/close, context detection (album vs. playlist vs. queue), track navigation.

### Animation Timing (`src/config.ts`)

`config.ts` is the single source of truth for all animation durations (in ms) and layout spacing. On app init (`main.tsx`), `applyCssVars()` injects these as CSS custom properties on `:root`, keeping JS state machine timeouts and CSS `animation-duration` values in sync. **When changing any animation duration, update it in `config.ts` only** — do not hardcode values in CSS or component files.

### Styling

Tailwind CSS 4 via `@tailwindcss/vite`. Spotify brand colors (`spotify-black`, `spotify-green`, `spotify-gray-dark`, etc.) are defined as utilities in `src/index.css`. Custom CSS animations for the record player mechanics also live there.

### Environment Variables

| Variable | Dev | Production |
|---|---|---|
| `VITE_SPOTIFY_CLIENT_ID` | same in both | same in both |
| `VITE_SPOTIFY_REDIRECT_URI` | `http://127.0.0.1:5173` | `https://adarshkoka.github.io/spotify-vinyl-player-app` |

The redirect URI in `.env` / `.env.production` must match what is registered in the Spotify Developer Dashboard.

### Color Extraction (`src/utils/colorExtractor.ts`)

Extracts a vibrant palette from the current album art image to drive the `RoomScene` background gradient. Called by `useSpotifyPlayback` when a new track loads.
