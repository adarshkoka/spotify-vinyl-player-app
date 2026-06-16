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

- **`useSpotifyPlayback`** — Polls current track, exposes play/pause/skip controls and progress/duration. `refetchPlayback({ untilTrackChanges: true })` is used after the user picks a track in the panel so the UI updates within ~300–700ms instead of waiting for the next 3000ms poll.
- **`useTrackTransition`** — 9-stage animation state machine (`TransitionStage` enum in `src/types/player.ts`): `empty → jacket-enter → disc-emerge → disc-center → disc-rest → disc-place → playing/paused/eject`. Transitions advance via `setTimeout` timed to CSS animation durations. Same-album track changes skip the swap animation and update the disc label in place.
- **`useDiscScrub`** — Pointer/touch event handler for rotating the disc to seek; throttles Spotify seek API calls to 300ms minimum. Full-rotation thresholds trigger skip-next / skip-back.
- **`usePlayerColors`** — LocalStorage-backed color state for the turntable base and tonearm. Material presets (wood/aluminum/silver/gold) and per-target favorite swatches.
- **`useArtBaseSettings`** — LocalStorage-backed toggle for the "album-art-driven base" mode, which replaces the manually picked `baseColor` with a darkened dominant + gradient derived from the current album art.
- **`useLyrics`** — Fetches time-synced lyrics from [LRCLIB](https://lrclib.net) and parses LRC format via `src/utils/lrcParser.ts`. Results are cached per-track to avoid refetching.
- **`useLyricsSettings`** — LocalStorage-backed toggle (`enabled`) and position (`'flank'` = both sides of the jacket, `'right'` = jacket left-anchored and lyrics fill the right half).
- **`useTracklistPanel`** — The panel surface below the record player. Owns:
  - The `panelView` tab state: `'album' | 'library' | 'playlist' | 'queue' | 'liked'`.
  - Per-context track fetching with a per-URI cache (album, playlist). Queue and Liked Songs are never cached.
  - Liked Songs infinite-scroll paging (50 at a time).
  - User-owned playlists for the Library view, fetched once and cached in a ref.
  - An `overrideUri`/`overrideType` mechanism so picking a playlist from the Library temporarily shows that playlist's tracks; switching tabs clears the override so the Playlist tab always reflects the *currently playing* playlist.
  - Track selection: routes through `playTrackInContext` / `playUriList` / `playTrackByUri` depending on view. When no Spotify device is active (typical on cold start), Liked Songs and album/playlist plays look up the most-recent device via `getRecentDevice()` and target it explicitly to avoid 404s.

### Album Jacket Interaction (`src/components/AlbumJacket.tsx`)

The album-art "jacket" is the affordance for opening the tracklist panel (`onToggleOpen`), and it signals its clickability differently per input type:

- **Desktop hover "pop-up":** scoped to `@media (hover: hover)` so taps don't leave a stuck hover state. On hover the jacket lifts (`translateY(-6px) scale(1.04)`) with a deeper shadow, and the right-edge `.jacket-slit` widens (4px → 7px) to hint that a record could slide out — reinforcing the vinyl-jacket metaphor. The `:active` press-squash is given matching specificity and placed after the hover rule so pressing still squashes; `:not(.jacket-pressed)` keeps the lift from fighting the open-panel state. The transform transition uses `--jacket-hover-duration` (from `JACKET_HOVER_DURATION` in `config.ts`).
- **Mobile haptic:** an `onPointerDown` handler calls the native **Web Vibration API** (`navigator.vibrate(10)`) for a light tap — no library. It fires only when `pointerType === 'touch'` and is feature-guarded (`'vibrate' in navigator`), so mouse clicks and unsupported browsers (notably iOS Safari, which lacks the API entirely) are silent no-ops.

### Tracklist Panel UI (`src/components/TracklistPanel.tsx`)

A persistent centered tab bar (Library · Album · Playlist · Liked Songs · Queue) sits at the top of the panel; the close button is absolutely positioned in the top-right. Tabs are conditionally hidden when they would be empty: Album requires a current track with a multi-track album, Playlist requires a playlist context, Queue requires a current track. Library renders a 3-column grid of playlist cards (square cover + name); clicking a card opens that playlist in the Playlist tab via the override mechanism. The Liked Songs view auto-opens on cold start when nothing is playing on the user's Spotify account, so the user can pick a song without leaving the app.

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

K-means-style clustering on a downsampled copy of the album art produces:
- `primary` / `secondary` / `accent` / `dark` — drive the `RoomScene` room-background gradient.
- `vibrantAccent` — used to tint the currently-playing track row and the active tab underline in the panel (via `pickTracklistAccentColor`).
- `busyGradient` / `busyDominant` — feed the optional album-art-driven turntable base when `useArtBaseSettings` is enabled.

Called from `MainAppPage` when `track.id` changes.

### Settings (`src/components/ColorCustomizer.tsx`)

A single gear-icon menu in the bottom bar consolidates all user-configurable settings: base/tonearm color pickers, material presets, favorite swatch slots, album-art-driven base toggle, lyrics on/off, lyrics position (flank/right), and logout. Most settings are persisted via the LocalStorage-backed hooks above.
