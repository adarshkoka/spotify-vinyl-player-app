import React from 'react';

interface AlbumJacketProps {
  albumArtUrl: string | null;
  className?: string;
}

const AlbumJacket: React.FC<AlbumJacketProps> = ({ albumArtUrl, className = '' }) => {
  return (
    <div className={`album-jacket ${className}`}>
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
