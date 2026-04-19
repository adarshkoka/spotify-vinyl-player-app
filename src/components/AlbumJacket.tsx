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

  return (
    <div
      className={`album-jacket ${className} ${canOpen ? 'jacket-clickable' : ''} ${isOpen ? 'jacket-pressed' : ''}`}
      onClick={handleClick}
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
