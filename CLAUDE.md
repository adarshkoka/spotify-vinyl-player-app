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
- **`useArtBaseSettings`** — LocalStorage-backed toggles (under one storage key) for two independent "album-art-driven" modes: `baseEnabled` replaces the manually picked `baseColor`/`baseBackground` with a darkened dominant + gradient derived from the current album art; `armEnabled` replaces the manually picked `tonearmColor` with the same art-derived dominant (`busyDominant`). Both null out their respective material preset while active. Picking any color/material/favorite for a target turns its art mode off (handled in `MainAppPage`). Legacy single-flag storage (`{ enabled }`) migrates to `baseEnabled` on load.
- **`useLyrics`** — Fetches time-synced lyrics from [LRCLIB](https://lrclib.net) and parses LRC format via `src/utils/lrcParser.ts`. Results are cached per-track to avoid refetching. LRCLIB data is **line-synced only** (no per-word timestamps).
- **`useLyricsSettings`** — LocalStorage-backed toggle (`enabled`), position (`'flank'` = both sides of the jacket, `'right'` = jacket left-anchored and lyrics fill the right half), and `colorful` (the Colorful Lyrics karaoke mode — see below).
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
- `busyGradient` / `busyDominant` — feed the optional album-art-driven turntable base **and** tonearm when the corresponding `useArtBaseSettings` toggle is enabled. `busyDominant` is emitted as an `rgb(...)` string; `Tonearm.tsx`'s `darkenColor` helper accepts both `#hex` and `rgb()` so the art-driven arm still gets its per-section shading (counterweight/cartridge/pivot-inner darker than the body).
- `lyricColors` — a diverse, brightened-for-legibility palette (1–5 colors) built from the same k-means clusters as `busyGradient`, used by Colorful Lyrics. Saturated clusters are preferred (grays are weak word colors), but a **grayscale album** (no saturated clusters) falls back to the album's *own* gray/silver/white tones — not a generic rainbow — so the lyrics still match the art. Brightening (via the `brighten` helper, hue-preserving brightness floor) keeps words readable on the dark lyric overlay. Only falls back to `DEFAULT_COLORS.lyricColors` if the art yields no clusters at all.

Called from `MainAppPage` when `track.id` changes.

### Colorful Lyrics (`src/components/LyricsDisplay.tsx`)

When `useLyricsSettings`' `colorful` toggle is on, the active lyric line renders word-by-word with a karaoke **progressive reveal** instead of a single white string:
- Each word is a `<span class="lyric-word">` colored from `gradientColors.lyricColors` (cycled by index). State classes drive the reveal: `--sung` (full color), `--current` (brightest + glow + slight scale), `--upcoming` (dimmed white).
- Because LRCLIB has no per-word timing, the active word is **interpolated**: `lrcParser.findCurrentLineWindow` returns the line's `[startMs, endMs)`, and the duration is distributed across words proportional to character length (`wordEndFractions`). The active word index updates in the existing `requestAnimationFrame` loop, only setting state when it changes.
- Timing tuning: `LYRIC_WORD_LEAD_MS` in `config.ts` is a global look-ahead that shifts the whole reveal earlier (raise it if words light up late). The per-word distribution itself is the `wordEndFractions` weighting in `LyricsDisplay.tsx`.
- All words of a panel are wrapped in a single `.lyric-line` span so the flex-based `.lyric-panel` sees one flex item — preserving inter-word spaces and wrapping (rendering raw word `<span>`s directly into the flex panel makes each word/space its own flex item, which collapses spaces and overlaps words).
- Flank mode splits the word array at the word boundary nearest the line's character midpoint; right mode renders all words in the right panel. The non-colorful path is unchanged.
- The word color/glow transition uses `--lyric-word-fade-duration` (from `LYRIC_WORD_FADE_DURATION` in `config.ts`).

### Settings (`src/components/ColorCustomizer.tsx`)

A single gear-icon menu in the bottom bar consolidates all user-configurable settings: base/tonearm color pickers, material presets, favorite swatch slots, album-art-driven toggles (an "Album Art" preset tile shown in **both** the Base and Arm pickers), lyrics on/off, lyrics position (flank/right), Colorful Lyrics on/off, and logout. Most settings are persisted via the LocalStorage-backed hooks above.
