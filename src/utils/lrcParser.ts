export interface LyricLine {
  ms: number;
  text: string;
}

const LINE_RE = /\[(\d+):(\d+(?:\.\d+)?)\]\s?(.*)/;

export function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const raw of lrc.split('\n')) {
    const m = raw.match(LINE_RE);
    if (!m) continue;
    const min = Number(m[1]);
    const sec = Number(m[2]);
    if (Number.isNaN(min) || Number.isNaN(sec)) continue;
    lines.push({
      ms: Math.round((min * 60 + sec) * 1000),
      text: m[3].trim(),
    });
  }
  return lines.sort((a, b) => a.ms - b.ms);
}

export function findCurrentLine(lines: LyricLine[], positionMs: number): LyricLine | null {
  if (!lines.length || positionMs < lines[0].ms) return null;
  let lo = 0;
  let hi = lines.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lines[mid].ms <= positionMs) lo = mid;
    else hi = mid - 1;
  }
  const current = lines[lo];
  if (!current.text) return null;
  return current;
}

/** Index of the active line for a playback position, or -1 if before the first line. */
export function findCurrentLineIndex(lines: LyricLine[], positionMs: number): number {
  if (!lines.length || positionMs < lines[0].ms) return -1;
  let lo = 0;
  let hi = lines.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lines[mid].ms <= positionMs) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Fallback display duration (ms) for the final line, which has no following timestamp. */
const LAST_LINE_FALLBACK_MS = 4000;

/**
 * The active line's text and its [startMs, endMs) time window. `endMs` is the
 * next line's timestamp (or a fallback for the last line). Returns null when no
 * line is active or the active line is blank.
 */
export function findCurrentLineWindow(
  lines: LyricLine[],
  positionMs: number,
): { text: string; startMs: number; endMs: number } | null {
  const i = findCurrentLineIndex(lines, positionMs);
  if (i === -1 || !lines[i].text) return null;
  const startMs = lines[i].ms;
  const endMs = i + 1 < lines.length ? lines[i + 1].ms : startMs + LAST_LINE_FALLBACK_MS;
  return { text: lines[i].text, startMs, endMs };
}

export function splitLineHalves(text: string): { left: string; right: string } {
  if (!text) return { left: '', right: '' };
  const mid = text.length / 2;
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ') {
      const d = Math.abs(i - mid);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
  }
  if (best === -1) return { left: text, right: '' };
  return { left: text.slice(0, best), right: text.slice(best + 1) };
}
