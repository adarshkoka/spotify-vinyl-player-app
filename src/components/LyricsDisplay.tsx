import React, { useEffect, useRef, useState } from 'react';
import { findCurrentLine, splitLineHalves, type LyricLine } from '../utils/lrcParser';

interface LyricsDisplayProps {
  lines: LyricLine[];
  progressMs: number;
  isPlaying: boolean;
  position?: 'flank' | 'right';
}

const LyricsDisplay: React.FC<LyricsDisplayProps> = ({ lines, progressMs, isPlaying, position = 'flank' }) => {
  const [currentText, setCurrentText] = useState<string>('');
  const pollRef = useRef({ progressMs, wallMs: performance.now() });

  useEffect(() => {
    pollRef.current = { progressMs, wallMs: performance.now() };
  }, [progressMs]);

  useEffect(() => {
    if (!lines.length) {
      setCurrentText('');
      return;
    }

    let rafId = 0;
    let lastText = '';

    const tick = () => {
      const { progressMs: base, wallMs } = pollRef.current;
      const elapsed = isPlaying ? performance.now() - wallMs : 0;
      const effective = base + elapsed;
      const line = findCurrentLine(lines, effective);
      const nextText = line?.text ?? '';
      if (nextText !== lastText) {
        lastText = nextText;
        setCurrentText(nextText);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [lines, isPlaying]);

  // In 'flank' mode the line splits around the centered album art (left half +
  // right half). In 'right' mode the album art is anchored to the left of the
  // row and the FULL line renders in the right-hand panel.
  const halves = splitLineHalves(currentText);
  const left = position === 'right' ? '' : halves.left;
  const right = position === 'right' ? currentText : halves.right;
  const visible = currentText.length > 0;

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
};

export default LyricsDisplay;
