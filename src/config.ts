/**
 * Application configuration.
 *
 * Animation durations are the single source of truth for both the React
 * transition state machine and the CSS animations — no need to update values
 * in two places. Call applyCssVars() once at startup (done in main.tsx).
 */

// ─── Animation durations (milliseconds) ────────────────────────────────────

/** Jacket slides in from the left when a new song loads. */
export const JACKET_ENTER_DURATION = 800;

/** Disc slides out from behind the jacket to the right. */
export const DISC_EMERGE_DURATION = 750;

/** Disc slides back leftward to the center of the page. */
export const DISC_CENTER_DURATION = 750;

/** Disc rests at center (on top of the jacket) before lifting. */
export const DISC_REST_DURATION = 150;

/** Disc lifts up toward the platter, scaling to full size. */
export const DISC_PLACE_DURATION = 1350;

/** Quick fade when the current track is removed with no replacement. */
export const EJECT_DURATION = 300;

/** Jacket pop-up lift/squash transition on hover and press. */
export const JACKET_HOVER_DURATION = 200;

// ─── Playback polling ───────────────────────────────────────────────────────

/**
 * How often (ms) the app polls the Spotify API for the current track.
 * Lower = more responsive, but uses more API quota.
 * Spotify recommends no faster than 1 request/second; keep above 3000.
 */
export const SPOTIFY_POLL_INTERVAL = 3000;

// ─── Visual speeds ──────────────────────────────────────────────────────────

/** Duration (ms) for the vinyl record to complete one full rotation. */
export const VINYL_SPIN_DURATION = 1800;

/** Duration (ms) for the room background gradient to transition between songs. */
export const GRADIENT_TRANSITION_DURATION = 1500;

// ─── Disc scrubbing ─────────────────────────────────────────────────────────

/** How many milliseconds of track time one degree of disc rotation represents. */
export const SCRUB_MS_PER_DEGREE = 80;

/**
 * Degrees of rotation that triggers a full-rotation skip action.
 * >= this value right = skip next, <= negative = skip previous / restart.
 * 330 ≈ 1 rotation, 690 ≈ 2 rotations (slightly less than exact to feel responsive).
 */
export const SCRUB_FULL_ROTATION_THRESHOLD = 690;

/** Minimum interval (ms) between seek API calls to avoid rate limits. */
export const SCRUB_SEEK_THROTTLE_MS = 300;

// ─── Layout spacing (pixels) ────────────────────────────────────────────────

/**
 * Vertical gap between the record player (including transition area) and the
 * song title/artist/album block.
 * Safe range: 0–40px. Above 40px risks pushing controls off screen.
 */
export const GAP_PLAYER_TO_SONG = 0;

/**
 * Vertical gap between the song title/artist/album block and the playback
 * control buttons.
 * Safe range: 0–24px.
 */
export const GAP_SONG_TO_CONTROLS = 4;

/**
 * Vertical gap between the turntable base and the jacket / transition area.
 * Safe range: 0–24px.
 */
export const GAP_BASE_TO_JACKET = 8;

/**
 * Vertical gap between the jacket and the tracklist panel when open.
 * Safe range: 0–16px.
 */
export const GAP_JACKET_TO_PANEL = 4;

/**
 * Top margin above the record player — breathing room from the top of the page.
 * Safe range: 0–48px.
 */
export const RECORD_PLAYER_TOP_MARGIN = 16;

// ─── CSS variable injection ─────────────────────────────────────────────────

/**
 * Writes all duration values as CSS custom properties on :root so that
 * CSS animations stay in sync with the JS state machine automatically.
 * Call this once at app startup.
 */
export function applyCssVars(): void {
  const root = document.documentElement;
  root.style.setProperty('--jacket-enter-duration', `${JACKET_ENTER_DURATION}ms`);
  root.style.setProperty('--disc-emerge-duration', `${DISC_EMERGE_DURATION}ms`);
  root.style.setProperty('--disc-center-duration', `${DISC_CENTER_DURATION}ms`);
  root.style.setProperty('--disc-place-duration', `${DISC_PLACE_DURATION}ms`);
  root.style.setProperty('--eject-duration', `${EJECT_DURATION}ms`);
  root.style.setProperty('--jacket-hover-duration', `${JACKET_HOVER_DURATION}ms`);
  root.style.setProperty('--vinyl-spin-duration', `${VINYL_SPIN_DURATION}ms`);
  root.style.setProperty('--gradient-transition-duration', `${GRADIENT_TRANSITION_DURATION}ms`);

  // Spacing — clamped to safe ranges to prevent overlap or off-screen content
  const gapPlayerToSong = clamp(GAP_PLAYER_TO_SONG, 0, 40, 'GAP_PLAYER_TO_SONG');
  const gapSongToControls = clamp(GAP_SONG_TO_CONTROLS, 0, 24, 'GAP_SONG_TO_CONTROLS');
  const gapBaseToJacket = clamp(GAP_BASE_TO_JACKET, 0, 24, 'GAP_BASE_TO_JACKET');
  const gapJacketToPanel = clamp(GAP_JACKET_TO_PANEL, 0, 16, 'GAP_JACKET_TO_PANEL');
  const recordPlayerTopMargin = clamp(RECORD_PLAYER_TOP_MARGIN, 0, 48, 'RECORD_PLAYER_TOP_MARGIN');

  root.style.setProperty('--gap-player-to-song', `${gapPlayerToSong}px`);
  root.style.setProperty('--gap-song-to-controls', `${gapSongToControls}px`);
  root.style.setProperty('--gap-base-to-jacket', `${gapBaseToJacket}px`);
  root.style.setProperty('--gap-jacket-to-panel', `${gapJacketToPanel}px`);
  root.style.setProperty('--record-player-top-margin', `${recordPlayerTopMargin}px`);
}

function clamp(value: number, min: number, max: number, name: string): number {
  if (value < min || value > max) {
    console.warn(
      `[config] ${name} value ${value} is outside the safe range [${min}, ${max}]. Clamping to prevent layout issues.`
    );
  }
  return Math.min(Math.max(value, min), max);
}
