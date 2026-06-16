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
  - The `panelView` tab state: `'album' | 'library' | 'playlist' | 'queue' | 'liked' | 'artist'`.
  - Per-context track fetching with a per-URI cache (album, playlist). Queue and Liked Songs are never cached.
  - Liked Songs infinite-scroll paging (50 at a time).
  - The **Artist** view (`'artist'`): your liked songs by the *primary* artist (`track.artists[0]`) of the now-playing song. Backed by separate `artistTracks` state (isolated like `likedTracks` so async writes can't leak into another view), a per-artist session cache (`artistCacheRef`, keyed by artist id), and a session stale-guard (`artistSessionRef`) since the artist can change mid-fetch. `showArtist()` serves from cache or calls `getLikedSongsByArtist(artistId)`; an effect refetches when `currentArtistId` changes while the tab is open. Loaded tracks are merged into `savedTrackUris` so their hearts render filled. **Critically, this does NOT scan the user's library** (`/me/tracks` has no artist filter and can be 10K+ songs) — see Liked-Songs-by-Artist below.
  - User-owned playlists for the Library view, fetched once and cached in a ref.
  - An `overrideUri`/`overrideType` mechanism so picking a playlist from the Library temporarily shows that playlist's tracks; switching tabs clears the override so the Playlist tab always reflects the *currently playing* playlist.
  - Track selection: routes through `playTrackInContext` / `playUriList` / `playTrackByUri` depending on view. When no Spotify device is active (typical on cold start), Liked Songs, Artist, and album/playlist plays look up the most-recent device via `getRecentDevice()` and target it explicitly to avoid 404s. The Artist view plays as a `playUriList` window (like Liked Songs, since its tracks span many albums with no shared context) but without forced shuffle.

### Album Jacket Interaction (`src/components/AlbumJacket.tsx`)

The album-art "jacket" is the affordance for opening the tracklist panel (`onToggleOpen`), and it signals its clickability differently per input type:

- **Desktop hover "pop-up":** scoped to `@media (hover: hover)` so taps don't leave a stuck hover state. On hover the jacket lifts (`translateY(-6px) scale(1.04)`) with a deeper shadow, and the right-edge `.jacket-slit` widens (4px → 7px) to hint that a record could slide out — reinforcing the vinyl-jacket metaphor. The `:active` press-squash is given matching specificity and placed after the hover rule so pressing still squashes; `:not(.jacket-pressed)` keeps the lift from fighting the open-panel state. The transform transition uses `--jacket-hover-duration` (from `JACKET_HOVER_DURATION` in `config.ts`).
- **Mobile haptic:** an `onPointerDown` handler calls the native **Web Vibration API** (`navigator.vibrate(10)`) for a light tap — no library. It fires only when `pointerType === 'touch'` and is feature-guarded (`'vibrate' in navigator`), so mouse clicks and unsupported browsers (notably iOS Safari, which lacks the API entirely) are silent no-ops.

### Tracklist Panel UI (`src/components/TracklistPanel.tsx`)

A persistent centered tab bar (Library · {Artist} · Album · Playlist · Liked Songs · Queue) sits at the top of the panel. There is no close button — the panel is dismissed by clicking the album jacket again (toggle) or by clicking the background outside the player (`handleBackgroundClick` in `MainAppPage`, which no-ops while nothing is playing so the panel stays available as the only way to pick a song). Tabs are conditionally hidden when they would be empty: Artist requires a current track with a primary artist, Album requires a current track with a multi-track album, Playlist requires a playlist context, Queue requires a current track. The **Artist** tab is **labeled with the primary artist's name** (`currentArtistName` = `track.artists[0].name`, never featured artists); a long name is capped + ellipsized via `.tracklist-tab-artist` (`max-width` + `min-width:0` so the flex item shrinks), with the full name in the button's `title` tooltip and the whole bar scrolling (`.tracklist-tabs` `overflow-x`) as a last resort. It shows the empty state "No liked songs by {artist}" when none are found. Library renders a 3-column grid of playlist cards (square cover + name); clicking a card opens that playlist in the Playlist tab via the override mechanism. The Liked Songs view auto-opens on cold start when nothing is playing on the user's Spotify account, so the user can pick a song without leaving the app. The add-to-queue and like (♥) per-row buttons and the scroll-to-current-track effect are view-agnostic (the scroll effect only skips `'liked'`, whose active track is usually outside the loaded page), so the Artist view gets them for free.

### Liked Songs by Artist (`src/services/spotifyService.ts`)

`getLikedSongsByArtist(artistId)` computes "your liked songs by this artist" **without scanning the Liked Songs library**. Spotify has no server-side artist filter on `/me/tracks`, and a library can be 10K+ songs, so instead of scanning the (huge) library we scan the artist's **bounded catalog** and ask Spotify which of those are saved:

1. `getArtistTopTracks` (`/artists/{id}/top-tracks`) + `getArtistAlbumIds` (`/artists/{id}/albums` with `include_groups=album,single,compilation,appears_on` — `appears_on` is what catches features), paginated up to `MAX_ARTIST_ALBUM_PAGES`.
2. `getAlbumsTracks` batches album track listings via `/albums?ids=` (20/request, bounded concurrency).
3. Merge + dedupe by track id, **filter by artist ID** (`artists.some(a => a.id === artistId)` — needed because `appears_on`/compilation albums contain *other* artists' tracks; matches the "any appearance: lead or featured" intent and is robust vs. name collisions), cap at `MAX_CANDIDATE_TRACKS`.
4. `checkSavedTracks` (existing, `/me/tracks/contains`, 50 ids/request) in chunks; keep only saved tracks, returned as `ContextTrack[]` with a running 1..N `track_number`.

Cost scales with the **artist's catalog**, never the library. Tradeoff: results are only as complete as the catalog we fetch (a liked deep-cut on an unrelated compilation we don't pull can be missed) and capped for hyper-prolific artists. Uses `market=from_token`; needs no new OAuth scope (`user-library-read`, already granted by Liked Songs, covers check-saved).

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
- `lyricColors` — palette for Colorful Lyrics, built from the same k-means clusters as `busyGradient`. Two paths: a **colorful album** (has saturated clusters) gets a diverse palette brightened (`brighten` helper) so hues pop and stay legible; a **grayscale album** (no saturated clusters) gets a single monochrome color — **black** by default to match the mostly-dark art, but **white** when the whole cover is essentially black (lightest cluster `brightness < 70`), since the app background is then black too and black-on-black lyrics would be invisible. Falls back to `DEFAULT_COLORS.lyricColors` only if the art yields no clusters.

Called from `MainAppPage` when `track.id` changes.

### Colorful Lyrics (`src/components/LyricsDisplay.tsx`)

When `useLyricsSettings`' `colorful` toggle is on, the active lyric line renders word-by-word with a karaoke **progressive reveal** instead of a single white string:
- Each word is a `<span class="lyric-word">` colored from `gradientColors.lyricColors` (cycled by index). State classes drive the reveal: `--sung` (full color), `--current` (brightest + glow + slight scale), `--upcoming` (dimmed white).
- Because LRCLIB has no per-word timing, the active word is **interpolated**: `lrcParser.findCurrentLineWindow` returns the line's `[startMs, endMs)`, and each word is given a natural sung duration from a **syllable + punctuation** estimate (`countSyllables` via vowel-groups; a punctuation pause for tokens ending in `, . ; : ! ? — -`). `wordStartOffsets` turns those durations into per-word start times, **compressed to fit a short (fast) window but never stretched** across a long (slow) one — so slow songs no longer lag. The active word is the last one whose start has passed (`activeIndexFromElapsed`), updated in the `requestAnimationFrame` loop, only setting state when it changes. Because there's no threshold past the final word, it stays the glowing `current` word until the line changes — a built-in "sustain" for held final notes.
- Timing tuning (all in `config.ts`): `LYRIC_WORD_LEAD_MS` is a global look-ahead (raise if words light up late); `LYRIC_MS_PER_SYLLABLE` + `LYRIC_WORD_BASE_MS` set the per-word pace (raise per-syllable if reveals feel too early on slow songs); `LYRIC_PUNCT_PAUSE_MS` controls the comma/period hold; `LYRIC_PAREN_TIME_SCALE` (default 0) scales the timing weight of parenthetical backing-vocal words like "(bizarre)" — 0 excludes them from pacing so the main lyric isn't distorted (`markParenthetical` flags them, tracking paren depth across multi-word groups). Parenthetical words are still displayed/colored normally.
- Typography: `LYRIC_FONT_FAMILY`, `LYRIC_FONT_SIZE` (px), and `LYRIC_BOLD` (boolean → font-weight 700/400) in `config.ts` drive the lyrics overlay font (applies to both plain and colorful modes), injected as `--lyric-font-family` / `--lyric-font-size` / `--lyric-font-weight` and consumed by `.lyric-panel`.
- All words of a panel are wrapped in a single `.lyric-line` span so the flex-based `.lyric-panel` sees one flex item — preserving inter-word spaces and wrapping (rendering raw word `<span>`s directly into the flex panel makes each word/space its own flex item, which collapses spaces and overlaps words).
- Flank mode splits the word array at the word boundary nearest the line's character midpoint; right mode renders all words in the right panel. The non-colorful path is unchanged.
- The word color/glow transition uses `--lyric-word-fade-duration` (from `LYRIC_WORD_FADE_DURATION` in `config.ts`).

### Settings (`src/components/ColorCustomizer.tsx`)

A single gear-icon menu in the bottom bar consolidates all user-configurable settings: base/tonearm color pickers, material presets, favorite swatch slots, album-art-driven toggles (an "Album Art" preset tile shown in **both** the Base and Arm pickers), lyrics on/off, lyrics position (flank/right), Colorful Lyrics on/off, and logout. Most settings are persisted via the LocalStorage-backed hooks above.
