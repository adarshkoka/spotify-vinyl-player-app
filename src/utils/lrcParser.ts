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
