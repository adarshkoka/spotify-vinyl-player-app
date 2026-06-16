import React, { useEffect, useMemo, useRef, useState } from 'react';
import { findCurrentLine, findCurrentLineWindow, splitLineHalves, type LyricLine } from '../utils/lrcParser';
import { LYRIC_WORD_LEAD_MS } from '../config';

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

/** Cumulative end-fractions of the line duration per word, weighted by word length. */
function wordEndFractions(words: string[]): number[] {
  const weights = words.map(w => Math.max(1, w.length));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const ends: number[] = [];
  let acc = 0;
  for (const w of weights) {
    acc += w;
    ends.push(acc / total);
  }
  return ends;
}

/** Index of the word currently being sung for a given elapsed fraction (0–1) of the line. */
function activeIndexFromFraction(ends: number[], frac: number): number {
  for (let i = 0; i < ends.length; i++) {
    if (frac < ends[i]) return i;
  }
  return ends.length - 1;
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
        // Interpolate the word being sung within the line's [startMs, endMs) window.
        let idx = -1;
        if (win) {
          const dur = Math.max(1, win.endMs - win.startMs);
          // Look-ahead so words light up slightly before they're sung (see config).
          const frac = Math.min(1, Math.max(0, (effective - win.startMs + LYRIC_WORD_LEAD_MS) / dur));
          const words = nextText.split(/\s+/).filter(Boolean);
          if (words.length) idx = activeIndexFromFraction(wordEndFractions(words), frac);
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
