import React, { useEffect, useMemo, useRef, useState } from 'react';
import { findCurrentLine, findCurrentLineWindow, splitLineHalves, type LyricLine } from '../utils/lrcParser';
import { LYRIC_WORD_LEAD_MS, LYRIC_MS_PER_SYLLABLE, LYRIC_WORD_BASE_MS, LYRIC_PUNCT_PAUSE_MS, LYRIC_PAREN_TIME_SCALE } from '../config';

interface LyricsDisplayProps {
  lines: LyricLine[];
  progressMs: number;
  isPlaying: boolean;
  position?: 'flank' | 'right';
  /** Paint each word a different palette color with a karaoke progressive reveal. */
  colorful?: boolean;
  /** Brightened album-art palette used when `colorful` is on. */
  palette?: string[];
}

/**
 * Estimate a word's syllable count via vowel groups — a far better proxy for
 * sung duration than character length (e.g. "through" → 1, "radioactive" → ~4).
 */
function countSyllables(token: string): number {
  const w = token.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 1;
  let groups = (w.match(/[aeiouy]+/g) ?? []).length;
  if (w.endsWith('e') && groups > 1) groups -= 1; // silent trailing 'e'
  return Math.max(1, groups);
}

const ENDS_WITH_PUNCT = /[,.;:!?—-]$/;

/**
 * Flag tokens that fall inside parentheses — backing vocals / ad-libs like
 * "(bizarre)" or multi-word "(oh my god)". Tracks paren depth across tokens so
 * opening, interior, and closing tokens of a group are all flagged.
 */
function markParenthetical(tokens: string[]): boolean[] {
  const flags: boolean[] = [];
  let depth = 0;
  for (const tok of tokens) {
    const opens = (tok.match(/\(/g) ?? []).length;
    const closes = (tok.match(/\)/g) ?? []).length;
    flags.push(depth > 0 || opens > 0);
    depth = Math.max(0, depth + opens - closes);
  }
  return flags;
}

/**
 * Natural sung duration (ms) per token: base + syllables + a pause after
 * punctuation. Parenthetical (backing-vocal) tokens are scaled down by
 * LYRIC_PAREN_TIME_SCALE so they don't distort the main line's pacing.
 */
function estimateWordDurations(tokens: string[]): number[] {
  const paren = markParenthetical(tokens);
  return tokens.map((tok, i) => {
    const dur =
      LYRIC_WORD_BASE_MS
      + countSyllables(tok) * LYRIC_MS_PER_SYLLABLE
      + (ENDS_WITH_PUNCT.test(tok) ? LYRIC_PUNCT_PAUSE_MS : 0);
    return paren[i] ? dur * LYRIC_PAREN_TIME_SCALE : dur;
  });
}

/**
 * Per-word start offsets (ms from line start). Durations are compressed to fit a
 * shorter window (dense/fast lines) but never stretched to fill a longer one, so
 * a slow line with a trailing gap reveals at a natural pace instead of dragging.
 */
function wordStartOffsets(durations: number[], windowMs: number): number[] {
  const total = durations.reduce((a, b) => a + b, 0) || 1;
  const scale = total > windowMs ? windowMs / total : 1;
  const starts: number[] = [];
  let acc = 0;
  for (const d of durations) {
    starts.push(acc * scale);
    acc += d;
  }
  return starts;
}

/** Index of the word currently being sung — the last word whose start offset has passed. */
function activeIndexFromElapsed(starts: number[], elapsedMs: number): number {
  let idx = 0;
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] <= elapsedMs) idx = i;
    else break;
  }
  return idx;
}

const LyricsDisplay: React.FC<LyricsDisplayProps> = ({
  lines,
  progressMs,
  isPlaying,
  position = 'flank',
  colorful = false,
  palette = [],
}) => {
  const [currentText, setCurrentText] = useState<string>('');
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const pollRef = useRef({ progressMs, wallMs: performance.now() });

  useEffect(() => {
    pollRef.current = { progressMs, wallMs: performance.now() };
  }, [progressMs]);

  useEffect(() => {
    if (!lines.length) {
      setCurrentText('');
      setActiveWordIndex(-1);
      return;
    }

    let rafId = 0;
    let lastText = '';
    let lastIdx = -1;

    const tick = () => {
      const { progressMs: base, wallMs } = pollRef.current;
      const elapsed = isPlaying ? performance.now() - wallMs : 0;
      const effective = base + elapsed;

      if (colorful) {
        const win = findCurrentLineWindow(lines, effective);
        const nextText = win?.text ?? '';
        if (nextText !== lastText) {
          lastText = nextText;
          setCurrentText(nextText);
        }
        // Interpolate the word being sung within the line's [startMs, endMs) window
        // using a syllable/punctuation natural-pace estimate (see config).
        let idx = -1;
        if (win) {
          const dur = Math.max(1, win.endMs - win.startMs);
          const words = nextText.split(/\s+/).filter(Boolean);
          if (words.length) {
            // Look-ahead so words light up slightly before they're sung.
            const elapsed = effective - win.startMs + LYRIC_WORD_LEAD_MS;
            const starts = wordStartOffsets(estimateWordDurations(words), dur);
            idx = activeIndexFromElapsed(starts, elapsed);
          }
        }
        if (idx !== lastIdx) {
          lastIdx = idx;
          setActiveWordIndex(idx);
        }
      } else {
        const line = findCurrentLine(lines, effective);
        const nextText = line?.text ?? '';
        if (nextText !== lastText) {
          lastText = nextText;
          setCurrentText(nextText);
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [lines, isPlaying, colorful]);

  const visible = currentText.length > 0;

  // Words + flank-mode split point computed unconditionally (hooks must not be
  // called behind the non-colorful early return below).
  const words = useMemo(() => currentText.split(/\s+/).filter(Boolean), [currentText]);
  const splitIdx = useMemo(() => {
    if (words.length <= 1) return words.length;
    const totalChars = words.reduce((a, w) => a + w.length, 0);
    let acc = 0;
    let best = words.length;
    let bestDist = Infinity;
    for (let i = 0; i < words.length; i++) {
      acc += words[i].length;
      const d = Math.abs(acc - totalChars / 2);
      if (d < bestDist) {
        bestDist = d;
        best = i + 1;
      }
    }
    return best;
  }, [words]);

  // In 'flank' mode the line splits around the centered album art (left half +
  // right half). In 'right' mode the album art is anchored to the left of the
  // row and the FULL line renders in the right-hand panel.
  if (!colorful) {
    const halves = splitLineHalves(currentText);
    const left = position === 'right' ? '' : halves.left;
    const right = position === 'right' ? currentText : halves.right;
    return (
      <>
        <div className="lyric-panel lyric-panel--left" data-visible={visible && position === 'flank'} aria-hidden={!visible || position === 'right'}>
          {left}
        </div>
        <div className="lyric-panel lyric-panel--right" data-visible={visible} aria-hidden={!visible}>
          {right}
        </div>
      </>
    );
  }

  const renderWord = (word: string, globalIdx: number) => {
    const color = palette.length ? palette[globalIdx % palette.length] : undefined;
    const state =
      globalIdx < activeWordIndex ? 'sung' : globalIdx === activeWordIndex ? 'current' : 'upcoming';
    return (
      <span
        key={globalIdx}
        className={`lyric-word lyric-word--${state}`}
        style={color ? ({ '--word-color': color } as React.CSSProperties) : undefined}
      >
        {word}
      </span>
    );
  };

  const renderGroup = (groupWords: string[], offset: number) =>
    groupWords.map((w, i) => (
      <React.Fragment key={offset + i}>
        {i > 0 && ' '}
        {renderWord(w, offset + i)}
      </React.Fragment>
    ));

  const leftWords = position === 'right' ? [] : words.slice(0, splitIdx);
  const rightWords = position === 'right' ? words : words.slice(splitIdx);
  const rightOffset = position === 'right' ? 0 : splitIdx;

  return (
    <>
      <div className="lyric-panel lyric-panel--left" data-visible={visible && position === 'flank'} aria-hidden={!visible || position === 'right'}>
        <span className="lyric-line">{renderGroup(leftWords, 0)}</span>
      </div>
      <div className="lyric-panel lyric-panel--right" data-visible={visible} aria-hidden={!visible}>
        <span className="lyric-line">{renderGroup(rightWords, rightOffset)}</span>
      </div>
    </>
  );
};

export default LyricsDisplay;
