import React from 'react';

interface VinylDiscProps {
  albumArtUrl: string | null;
  isSpinning: boolean;
  className?: string;
  onClick?: () => void;
}

const VinylDisc: React.FC<VinylDiscProps> = ({ albumArtUrl, isSpinning, className = '', onClick }) => {
  return (
    <div
      className={`vinyl-disc ${isSpinning ? 'vinyl-spinning' : 'vinyl-paused'} ${className}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
      aria-label={isSpinning ? 'Pause playback' : 'Resume playback'}
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
