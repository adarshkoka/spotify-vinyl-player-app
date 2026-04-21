import React, { useState } from 'react';
import type { ContextTrack } from '../services/spotifyService';
import type { PanelView } from '../hooks/useTracklistPanel';

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

interface TracklistPanelProps {
  isOpen: boolean;
  tracks: ContextTrack[];
  currentTrackUri: string | null;
  accentColor: string;
  panelView: PanelView;
  isPlaylist: boolean;
  albumTrackCount?: number;
  onSelectTrack: (trackUri: string) => void;
  onClose: () => void;
  onShowAlbum?: () => void;
  onShowPlaylist?: () => void;
  onShowQueue?: () => void;
  onGoBack?: () => void;
  onAddToQueue?: (trackUri: string) => Promise<void>;
}

const AddToQueueButton: React.FC<{
  trackUri: string;
  onAdd: (uri: string) => Promise<void>;
}> = ({ trackUri, onAdd }) => {
  const [added, setAdded] = useState(false);

  if (added) {
    return <span className="add-to-queue-btn add-to-queue-done">✓</span>;
  }
  return (
    <button
      className="add-to-queue-btn"
      onClick={(e) => { e.stopPropagation(); setAdded(true); onAdd(trackUri); }}
      title="Add to queue"
    >+</button>
  );
};

const TracklistPanel: React.FC<TracklistPanelProps> = ({
  isOpen,
  tracks,
  currentTrackUri,
  accentColor,
  panelView,
  isPlaylist,
  albumTrackCount,
  onSelectTrack,
  onClose,
  onShowAlbum,
  onShowPlaylist,
  onShowQueue,
  onGoBack,
  onAddToQueue,
}) => {
  const showTrackNumbers = panelView !== 'playlist';
  const showAlbumBtn = isPlaylist && (!albumTrackCount || albumTrackCount > 1);
  const panelTitle = panelView === 'playlist' ? 'Playlist' : panelView === 'album' ? 'Album' : 'Queue';

  return (
    <div className={`tracklist-panel ${isOpen ? 'tracklist-panel-open' : ''}`}>
      <div className="tracklist-panel-inner">
        {/* Header buttons */}
        <div className="tracklist-header-btns">
          {/* Left navigation button */}
          <div className="tracklist-nav-left">
            {panelView === 'playlist' && showAlbumBtn && (
              <button className="tracklist-toggle-btn" onClick={onShowAlbum}>← Album</button>
            )}
            {panelView === 'queue' && (
              <button className="tracklist-toggle-btn" onClick={onGoBack}>← Playlist</button>
            )}
          </div>

          {/* Centered panel title */}
          <span className="tracklist-panel-title">{panelTitle}</span>

          {/* Right: next panel + close */}
          <div className="tracklist-nav-right">
            {panelView === 'playlist' && (
              <button className="tracklist-toggle-btn" onClick={onShowQueue}>Queue →</button>
            )}
            {panelView === 'album' && isPlaylist && (
              <button className="tracklist-toggle-btn" onClick={onShowPlaylist}>Playlist →</button>
            )}
            <button className="tracklist-close-btn" onClick={onClose} aria-label="Close tracklist">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Track list */}
        <div className="tracklist-scroll">
          {tracks.map((t) => (
            <button
              key={`${t.uri}-${t.track_number}`}
              className={`tracklist-item ${t.uri === currentTrackUri ? 'tracklist-item-active' : ''}`}
              style={t.uri === currentTrackUri ? { borderLeftColor: accentColor } as React.CSSProperties : undefined}
              onClick={() => onSelectTrack(t.uri)}
            >
              {showTrackNumbers && (
                <span className="tracklist-num">{t.track_number}</span>
              )}
              <span className="tracklist-info">
                <span
                  className="tracklist-name"
                  style={t.uri === currentTrackUri ? { color: accentColor } : undefined}
                >
                  {t.name}
                </span>
                <span className="tracklist-artist">{t.artists}</span>
              </span>
              {onAddToQueue && (
                <AddToQueueButton
                  trackUri={t.uri}
                  onAdd={onAddToQueue}
                />
              )}
              <span className="tracklist-dur">{formatDuration(t.duration_ms)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TracklistPanel;
