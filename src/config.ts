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

/** Colorful-lyrics word color/glow fade as the karaoke reveal advances. */
export const LYRIC_WORD_FADE_DURATION = 250;

/**
 * Karaoke look-ahead (ms) for Colorful Lyrics. Because LRCLIB only timestamps
 * whole lines, each word's "sung" moment is interpolated within the line; this
 * offset shifts the whole reveal earlier so a word lights up slightly *before*
 * it's sung rather than after. Increase if words feel late, decrease (or go
 * negative) if they feel early. Reasonable range: 0–400.
 */
export const LYRIC_WORD_LEAD_MS = 200;

/**
 * Estimated sung time (ms) per syllable for Colorful Lyrics. Each word's natural
 * duration is `LYRIC_WORD_BASE_MS + syllables * LYRIC_MS_PER_SYLLABLE` (plus a
 * punctuation pause), and the line's words are paced by these durations
 * (compressed to fit fast lines, never stretched across slow trailing gaps).
 * Raise if words feel too early on slow songs; lower if they feel late.
 */
export const LYRIC_MS_PER_SYLLABLE = 220;

/** Flat per-word floor (ms) for Colorful Lyrics — covers consonant onset / very short words. */
export const LYRIC_WORD_BASE_MS = 120;

/**
 * Extra hold (ms) added to a word that ends in punctuation (, . ; : ! ? — -),
 * so the highlight lingers where a singer would naturally pause or breathe.
 */
export const LYRIC_PUNCT_PAUSE_MS = 200;

/**
 * Timing weight (0–1) for words inside parentheses — typically backing vocals /
 * ad-libs like "(bizarre)" or "(ah)". `0` ignores them in the karaoke timing so
 * they don't steal pacing from the main lyric (they light up with their
 * neighbor); raise toward `1` to give them normal timing weight. They are always
 * displayed and colored normally regardless of this value.
 */
export const LYRIC_PAREN_TIME_SCALE = 0;

// ─── Lyrics typography ──────────────────────────────────────────────────────

/**
 * Font family for the lyrics overlay. Any valid CSS `font-family` value
 * (include fallbacks), e.g. `'Georgia, serif'` or `'"Courier New", monospace'`.
 */
export const LYRIC_FONT_FAMILY = 'Arial, Helvetica, sans-serif';

/** Font size (px) for the lyrics overlay. */
export const LYRIC_FONT_SIZE = 14;

/** Whether the lyrics render bold. Works with whatever LYRIC_FONT_FAMILY is set. */
export const LYRIC_BOLD = true;

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

/**
 * Minimum band width (in %) each color gets in the proportion-weighted room
 * background gradient. The gradient sizes every album-art color by how much of
 * the cover it actually covers, so a dominant color fills most of the screen;
 * this floor keeps a minority color visible as a thin edge accent instead of
 * vanishing entirely. Higher = minority colors show more. (See colorExtractor.)
 */
export const BG_GRADIENT_MIN_BAND = 6;

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

// ─── Haptics (Web Vibration API, Android) ───────────────────────────────────
//
// The only broadly available haptic API on Android browsers is the Web
// Vibration API (navigator.vibrate), which is coarse: motor on/off durations or
// [buzz, pause, buzz, …] patterns only, no amplitude. iOS Safari has no API at
// all (silent no-op). Distinct "feelings" are expressed as distinct durations /
// patterns. Each value is a single ms duration or a pattern array.

/** Light "groove tick" emitted while scrubbing the disc to seek (forward/rewind). */
export const HAPTIC_SCRUB_TICK_MS: number | number[] = 4;

/**
 * Degrees of disc rotation between scrub ticks. Ticks are distance-quantized
 * (not time-throttled) off the same rotation accumulator that drives seeking,
 * so the cadence tracks how far the disc is moved. Lower = more frequent ticks.
 */
export const HAPTIC_SCRUB_TICK_DEGREES = 25;

/** Heavy "ka-chunk" when a two-rotation scrub skips to the next/previous track. */
export const HAPTIC_SKIP_MS: number | number[] = [25, 40, 25];

/** Light pulse when tapping the disc to pause — the tonearm lifts off. */
export const HAPTIC_PAUSE_MS: number | number[] = 10;

/** Needle-drop "thud" when tapping the disc to play — the tonearm lands. */
export const HAPTIC_PLAY_MS: number | number[] = [10, 6, 22];

/** Light confirmation tap when the album jacket is tapped to open the panel. */
export const HAPTIC_JACKET_TAP_MS: number | number[] = 10;

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
  root.style.setProperty('--lyric-word-fade-duration', `${LYRIC_WORD_FADE_DURATION}ms`);
  root.style.setProperty('--lyric-font-family', LYRIC_FONT_FAMILY);
  root.style.setProperty('--lyric-font-size', `${LYRIC_FONT_SIZE}px`);
  root.style.setProperty('--lyric-font-weight', LYRIC_BOLD ? '700' : '400');
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
