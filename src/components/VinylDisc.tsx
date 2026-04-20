import React from 'react';

interface VinylDiscProps {
  albumArtUrl: string | null;
  isSpinning: boolean;
  className?: string;
  onClick?: () => void;
  isScrubbing?: boolean;
  scrubAngle?: number;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
}

const VinylDisc: React.FC<VinylDiscProps> = ({
  albumArtUrl,
  isSpinning,
  className = '',
  onClick,
  isScrubbing = false,
  scrubAngle = 0,
  onPointerDown,
}) => {
  const extraRotation = isScrubbing ? scrubAngle : 0;
  const scrubClass = isScrubbing ? 'vinyl-scrubbing' : '';

  const handleClick = () => {
    if (isScrubbing) return;
    onClick?.();
  };

  return (
    <div
      className={`vinyl-disc ${isSpinning && !isScrubbing ? 'vinyl-spinning' : 'vinyl-paused'} ${scrubClass} ${className}`}
      onClick={handleClick}
      onPointerDown={onPointerDown}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
      aria-label={isSpinning ? 'Pause playback' : 'Resume playback'}
      style={extraRotation !== 0 ? { '--scrub-rotation': `${extraRotation}deg` } as React.CSSProperties : undefined}
    >
      {/* Vinyl grooves layer */}
      <div className="vinyl-grooves" />

      {/* Center label with album art */}
      <div
        className="vinyl-label"
        style={
          albumArtUrl
            ? { backgroundImage: `url(${albumArtUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : undefined
        }
      />

      {/* Spindle hole */}
      <div className="vinyl-spindle" />
    </div>
  );
};

export default VinylDisc;
