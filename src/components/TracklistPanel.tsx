import React from 'react';
import type { ContextTrack } from '../services/spotifyService';

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

interface TracklistPanelProps {
  isOpen: boolean;
  tracks: ContextTrack[];
  isLoading: boolean;
  currentTrackUri: string | null;
  accentColor: string;
  isPlaylist: boolean;
  isShowingAlbum: boolean;
  onSelectTrack: (trackUri: string) => void;
  onClose: () => void;
  onShowAlbum?: () => void;
  onShowContext?: () => void;
}

const TracklistPanel: React.FC<TracklistPanelProps> = ({
  isOpen,
  tracks,
  isLoading,
  currentTrackUri,
  accentColor,
  isPlaylist,
  isShowingAlbum,
  onSelectTrack,
  onClose,
  onShowAlbum,
  onShowContext,
}) => {
  return (
    <div className={`tracklist-panel ${isOpen ? 'tracklist-panel-open' : ''}`}>
      <div className="tracklist-panel-inner">
        {/* Header buttons */}
        <div className="tracklist-header-btns">
          {isPlaylist && (
            <button
              className={`tracklist-toggle-btn ${isShowingAlbum ? 'tracklist-toggle-active' : ''}`}
              onClick={isShowingAlbum ? onShowContext : onShowAlbum}
            >
              {isShowingAlbum ? '← Playlist' : '→ Album'}
            </button>
          )}
          <button className="tracklist-close-btn" onClick={onClose} aria-label="Close tracklist">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Track list */}
        <div className="tracklist-scroll">
          {isLoading && (
            <div className="tracklist-loading">Loading tracks...</div>
          )}
          {!isLoading && tracks.map((t) => (
            <button
              key={t.uri}
              className={`tracklist-item ${t.uri === currentTrackUri ? 'tracklist-item-active' : ''}`}
              style={t.uri === currentTrackUri ? { borderLeftColor: accentColor } as React.CSSProperties : undefined}
              onClick={() => onSelectTrack(t.uri)}
            >
              <span className="tracklist-num">{t.track_number}</span>
              <span className="tracklist-info">
                <span
                  className="tracklist-name"
                  style={t.uri === currentTrackUri ? { color: accentColor } : undefined}
                >
                  {t.name}
                </span>
                <span className="tracklist-artist">{t.artists}</span>
              </span>
              <span className="tracklist-dur">{formatDuration(t.duration_ms)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TracklistPanel;
