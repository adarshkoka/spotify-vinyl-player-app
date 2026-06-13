# Project Plan: Spotify Record Player App

**Objective:** Develop a Single Page Application (SPA) that allows users to authenticate with Spotify and fetch their currently playing song. The application be built using Vite, React, and TypeScript, employing the Spotify API Authorization Code with PKCE Flow.

The website will feature a dynamic, interactive "Lofi-style" music visualizer synced with the Spotify Web API. 

Core Functional Requirements:

Dynamic Graphics Engine: Construct a central visual component representing a vinyl record player. The system must programmatically inject the current song's album art onto the center section of the spinning disc.

Bi-Directional Playback Sync: The graphic’s rotation must reflect the real-time playback state (spinning when active, halted when paused).

Controller: The graphic must be a primary interface; clicking/touching the record player should toggle the global playback state (Play/Pause).

Architecture for Future Expansion:

Environmental Layering: The application must utilize a layered rendering approach. The record player should exist as a close-up object within a broader "room" scene, allowing for independent backgrounds to be integrated later.

Component Extensibility: Define the record player as an isolated, modular component with an open event-handling system. This ensures that future physical interactions—like "fast-forward or rewind", or "vinyl swapping" — can be added without refactoring the core rendering logic.

Song Switching Logic (The "Slide & Drop" Sequence):
The application must handle "New Track" events through a multi-stage transition lifecycle rather than a simple image swap:

Stage 1 (The Jacket): Upon a song change, the new album art is rendered as a stationary square "sleeve" or "jacket."

Stage 2 (The Emergence): The circular vinyl disc (containing the same album art as its center label) must programmatically slide out from within the jacket graphic.

Stage 3 (The Placement): The disc must follow a defined motion path to seat itself onto the record player spindle, at which point the rotation and playback synchronization begin.

Structural Requirements for Animation:

Entity Separation: The "Jacket" and the "Disc" must be defined as distinct visual layers to allow for independent translation and rotation.

Z-Index Management: The system must support depth-layering so the disc appears to "emerge" from the interior of the sleeve before moving to the foreground layer of the player.

State-Driven Transitions: Transition triggers must be tied to Spotify’s track_id state. A change in ID should automatically fire the "Eject/Load" sequence, ensuring the visual representation stays in lockstep with the audio stream.
----------------------------

## Phase 1: Core — Authentication, Playback & Controls

- Spotify OAuth login using the Authorization Code with PKCE flow (code verifier, challenge, token exchange)
- Login landing page with "Login with Spotify" button; logout button in-app
- Polling the Spotify Web API for the currently playing track and playback state, with automatic refetch on tab visibility change
- Display of current track info: song name, artist(s), album name, and album art
- Play/pause toggle, skip forward, and skip back controls
- Spotify API service layer handling token refresh, pagination, and error states
- Main app page orchestrating all hooks and components together

----------------------------

## Phase 2: Visual Polish — Animations, Room Scene & Customization

- Multi-stage track transition animation state machine:
  - Jacket slides in from the left
  - Vinyl disc emerges from behind the jacket
  - Disc slides to center, rests briefly, then lifts and scales up onto the platter
  - Quick fade-out eject when a track is removed with no replacement
- All animation durations centralized in a config file and injected as CSS custom properties so JS and CSS stay in sync automatically
- Spinning vinyl disc on the platter synced to playback state (spins when playing, stops when paused)
- Tonearm that moves between resting and playing positions
- Fullscreen room scene with a dynamic gradient background extracted from the current album art using k-means color clustering
- Smooth crossfade transition between gradients when the track changes
- Customizable record player base and tonearm colors with material presets (Wood, Aluminum, Silver, Gold) and a hex color picker
- Color/material selections persisted to localStorage
- Layout spacing variables centralized in config with safe-range clamping

----------------------------

## Phase 3: Tracklist Panel — Track Browsing, Context Switching & Playback

- Clickable album jacket that opens an expandable tracklist panel below the record player using a CSS grid collapse animation
- Each track in the panel displays track number, name, artist, and formatted duration
- Currently playing track highlighted with the user's chosen accent color
- Clicking a track in the panel plays it within its context (album or playlist) via the Spotify API
- Panel stays open after selecting a track for continued browsing
- Album/Playlist toggle button when listening from a playlist: switch to the album's tracks or back to the playlist
- Smart context fallback: when the playback context is not a standard album or playlist (e.g. Liked Songs, radio), the panel automatically shows the current track's album instead, with the toggle button hidden
- Track data cached per context URI to avoid redundant API calls
- Jacket becomes clickable as soon as it finishes entering, without waiting for the full disc animation to complete
- Song info hidden while the tracklist panel is open to save vertical space

----------------------------

## Phase 4A: Queue Panel, Song-Info Links, Add-to-Queue & Panel Polish

- Song-info hyperlinks: artist name and album name are clickable links that open in Spotify (new browser tab via target="_blank") using open.spotify.com URLs
- Queue panel accessible via [Queue →] button from any panel view; shows currently playing track at position 1 plus upcoming queued tracks, always fetched fresh (not cached)
- Three-panel navigation model replacing the old album/playlist toggle:
  - Playlist panel (default for playlist context): [← Album] left, [Queue →] right
  - Album panel (default for album/artist context): [← Playlist] left (only if playlist context), [Queue →] right
  - Queue panel: [← Back] left (returns to previous panel)
  - Queue button always visible regardless of track count
- Panel never opens empty: tracks are fetched before the panel opens; cached data opens instantly, fetch failure keeps panel closed
- Track numbers hidden on playlist panel, shown on album (album track #) and queue (queue position #)
- Per-track add-to-queue button (+ icon) shown to the left of duration in all panel views; feedback: + → "Added to Queue" → ✓ checkmark (persists until panel closes/reopens)
- Disc spindle visual improvement: flat gray circle replaced with metallic radial gradient and subtle ring for depth

----------------------------

## Phase 4B: Disc Scrubbing & Rotation

- Click-and-drag (mouse) or touch-and-drag (mobile) on the spinning disc to scrub/seek through the track in real-time
- Disc visually follows the user's rotation with tactile effects: subtle radial blur + slight scale pulse while dragging
- Coast effect on release: disc continues rotating with decreasing velocity before snapping back to playback speed
- Tonearm wobbles subtly (±2-3°) during scrubbing and settles smoothly on release
- Full rotation right skips to next track; full rotation left restarts current or goes to previous based on progress
- Tunable config variables: seconds-per-degree, full-rotation threshold, coast duration, coast friction
- Seek calls throttled to avoid Spotify API rate limits

----------------------------