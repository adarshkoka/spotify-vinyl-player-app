import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { ContextTrack } from '../services/spotifyService';
import type { PanelView } from '../hooks/useTracklistPanel';

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

interface TracklistPanelProps {
  isOpen: boolean;
  isLoading?: boolean;
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
  savedTrackUris?: Set<string>;
  onSaveTrack?: (trackUri: string) => Promise<void>;
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
    >
      <svg width="8" height="6.4" viewBox="0 0 10 8" fill="currentColor">
        <rect x="0" y="0" width="10" height="1.5" rx="0.75"/>
        <rect x="0" y="3.25" width="10" height="1.5" rx="0.75"/>
        <rect x="0" y="6.5" width="10" height="1.5" rx="0.75"/>
      </svg>
    </button>
  );
};

const HeartSvg: React.FC<{ filled: boolean }> = ({ filled }) => (
  <svg width="8" height="8" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
  </svg>
);

const HeartButton: React.FC<{
  trackUri: string;
  isSaved: boolean;
  onSave: (uri: string) => Promise<void>;
}> = ({ trackUri, isSaved, onSave }) => {
  const [saved, setSaved] = useState(isSaved);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (isSaved) setSaved(true);
  }, [isSaved]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (saved) return;
    setSaved(true);
    setAnimating(true);
    onSave(trackUri);
    setTimeout(() => setAnimating(false), 700);
  }, [saved, onSave, trackUri]);

  return (
    <button
      className={`heart-btn ${saved ? 'heart-btn-saved' : ''}`}
      onClick={handleClick}
      title="Save to library"
    >
      {animating && (
        <>
          <span className="heart-float"><HeartSvg filled /></span>
          <span className="heart-float"><HeartSvg filled /></span>
        </>
      )}
      <HeartSvg filled={saved} />
    </button>
  );
};

const TracklistPanel: React.FC<TracklistPanelProps> = ({
  isOpen,
  isLoading = false,
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
  savedTrackUris,
  onSaveTrack,
}) => {
  const showTrackNumbers = panelView !== 'playlist';
  const showAlbumBtn = isPlaylist && (!albumTrackCount || albumTrackCount > 1);
  const panelTitle = panelView === 'playlist' ? 'Playlist' : panelView === 'album' ? 'Album' : 'Queue';

  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll the active track into view whenever tracks finish loading or the panel opens
  useEffect(() => {
    if (!isOpen || isLoading || !currentTrackUri || !scrollRef.current) return;
    const active = scrollRef.current.querySelector<HTMLElement>('.tracklist-item-active');
    if (active) {
      active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isOpen, isLoading, tracks, currentTrackUri]);

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
            {panelView === 'album' && isPlaylist && (
              <button className="tracklist-toggle-btn" onClick={onShowPlaylist}>← Playlist</button>
            )}
            {panelView === 'queue' && (
              <button className="tracklist-toggle-btn" onClick={onGoBack}>← Back</button>
            )}
          </div>

          {/* Centered panel title */}
          <span className="tracklist-panel-title">{panelTitle}</span>

          {/* Right: next panel + close */}
          <div className="tracklist-nav-right">
            {panelView === 'playlist' && (
              <button className="tracklist-toggle-btn" onClick={onShowQueue}>Queue →</button>
            )}
            {panelView === 'album' && (
              <button className="tracklist-toggle-btn" onClick={onShowQueue}>Queue →</button>
            )}
            <button className="tracklist-close-btn" onClick={onClose} aria-label="Close tracklist">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Track list */}
        <div className="tracklist-scroll" ref={scrollRef}>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="tracklist-skeleton-row">
                <div className="tracklist-skeleton-title" />
                <div className="tracklist-skeleton-artist" />
              </div>
            ))
          ) : (
            tracks.map((t) => (
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
              {onSaveTrack && (
                <HeartButton
                  trackUri={t.uri}
                  isSaved={savedTrackUris?.has(t.uri) ?? false}
                  onSave={onSaveTrack}
                />
              )}
              <span className="tracklist-dur">{formatDuration(t.duration_ms)}</span>
            </button>
          ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TracklistPanel;
