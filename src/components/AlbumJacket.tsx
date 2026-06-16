import React from 'react';

interface AlbumJacketProps {
  albumArtUrl: string | null;
  className?: string;
  canOpen?: boolean;
  isOpen?: boolean;
  onToggleOpen?: () => void;
}

const AlbumJacket: React.FC<AlbumJacketProps> = ({
  albumArtUrl,
  className = '',
  canOpen = false,
  isOpen = false,
  onToggleOpen,
}) => {
  const handleClick = () => {
    if (!canOpen) return;
    onToggleOpen?.();
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!canOpen) return;
    // Light haptic confirmation on touch taps (no-op on mouse / unsupported browsers like iOS Safari).
    if (e.pointerType === 'touch' && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
  };

  return (
    <div
      className={`album-jacket ${className} ${canOpen ? 'jacket-clickable' : ''} ${isOpen ? 'jacket-pressed' : ''}`}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
    >
      {/* Album art face */}
      <div
        className="jacket-face"
        style={
          albumArtUrl
            ? { backgroundImage: `url(${albumArtUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : undefined
        }
      />
      {/* Dark slit opening on the right edge */}
      <div className="jacket-slit" />
    </div>
  );
};

export default AlbumJacket;
