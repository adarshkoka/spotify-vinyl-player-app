import React, { useState, useEffect, useRef } from 'react';
import { GRADIENT_TRANSITION_DURATION } from '../config';

interface GradientColors {
  primary: string;
  secondary: string;
  accent: string;
  dark: string;
}

interface RoomSceneProps {
  children: React.ReactNode;
  gradientColors?: GradientColors;
  onDoubleClick?: () => void;
}

function toGradient(c: GradientColors): string {
  return `linear-gradient(160deg, ${c.dark} 0%, ${c.primary} 30%, ${c.secondary} 60%, ${c.accent} 100%)`;
}

const DEFAULT_GRADIENT = 'linear-gradient(160deg, #1a1a2e 0%, #16213e 30%, #0f3460 60%, #0a0a1a 100%)';

const RoomScene: React.FC<RoomSceneProps> = ({ children, gradientColors, onDoubleClick }) => {
  // "current" is the gradient fully visible underneath
  // "next" is the new gradient fading in on top
  const [current, setCurrent] = useState<string>(DEFAULT_GRADIENT);
  const [next, setNext] = useState<string | null>(null);
  const [nextOpacity, setNextOpacity] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!gradientColors) return;
    const newGradient = toGradient(gradientColors);
    if (newGradient === current) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    // Place new gradient on top at opacity 0, then fade it in
    setNext(newGradient);
    setNextOpacity(0);

    // Trigger reflow before starting transition
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setNextOpacity(1);
      });
    });

    // Once fade completes, promote next → current and clear the overlay
    timerRef.current = setTimeout(() => {
      setCurrent(newGradient);
      setNext(null);
      setNextOpacity(0);
    }, GRADIENT_TRANSITION_DURATION + 50);
  }, [gradientColors]);

  return (
    <div className="room-scene" onDoubleClick={onDoubleClick}>
      {/* Base layer — current gradient */}
      <div className="room-background" style={{ background: current }} />

      {/* Overlay layer — new gradient fading in */}
      {next && (
        <div
          className="room-background"
          style={{
            background: next,
            opacity: nextOpacity,
            transition: `opacity ${GRADIENT_TRANSITION_DURATION}ms ease`,
          }}
        />
      )}

      <div className="room-content">
        {children}
      </div>
    </div>
  );
};

export default RoomScene;
