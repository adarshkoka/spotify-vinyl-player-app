import React from 'react';

interface PlayerControlsProps {
  isPlaying: boolean;
  onTogglePlayback: () => void;
  onSkipNext: () => void;
  onSkipBack: () => void;
}

const PlayerControls: React.FC<PlayerControlsProps> = ({
  isPlaying,
  onTogglePlayback,
  onSkipNext,
  onSkipBack,
}) => {
  return (
    <div className="player-controls">
      {/* Skip Back */}
      <button
        className="control-btn"
        onClick={onSkipBack}
        aria-label="Previous track"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
        </svg>
      </button>

      {/* Play / Pause */}
      <button
        className="control-btn control-btn-main"
        onClick={onTogglePlayback}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Skip Next */}
      <button
        className="control-btn"
        onClick={onSkipNext}
        aria-label="Next track"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
        </svg>
      </button>
    </div>
  );
};

export default PlayerControls;
