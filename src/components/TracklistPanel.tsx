import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { ContextTrack, UserPlaylist } from '../services/spotifyService';
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
  hasCurrentTrack?: boolean;
  isLoadingMoreLiked?: boolean;
  likedHasMore?: boolean;
  libraryPlaylists?: UserPlaylist[];
  isLoadingLibrary?: boolean;
  onSelectTrack: (trackUri: string) => void;
  onShowAlbum?: () => void;
  onShowLibrary?: () => void;
  onShowPlaylist?: (playlistUri?: string) => void;
  onShowQueue?: () => void;
  onShowLikedSongs?: () => void;
  onShowArtist?: () => void;
  currentArtistName?: string | null;
  onLoadMoreLikedSongs?: () => void;
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
  hasCurrentTrack = false,
  isLoadingMoreLiked = false,
  likedHasMore = false,
  libraryPlaylists = [],
  isLoadingLibrary = false,
  onSelectTrack,
  onShowAlbum,
  onShowLibrary,
  onShowPlaylist,
  onShowQueue,
  onShowLikedSongs,
  onShowArtist,
  currentArtistName,
  onLoadMoreLikedSongs,
  onAddToQueue,
  savedTrackUris,
  onSaveTrack,
}) => {
  const showTrackNumbers = panelView !== 'playlist' && panelView !== 'library';
  // Album tab needs a real, multi-track album to be useful. When nothing is
  // playing (no current track), there's no album to show, so hide the tab.
  const showAlbumTab = hasCurrentTrack && (albumTrackCount ?? 0) > 1;
  const showPlaylistTab = isPlaylist;
  // Queue is meaningless when nothing is playing.
  const showQueueTab = hasCurrentTrack;
  // Artist tab needs a now-playing artist to be about.
  const showArtistTab = hasCurrentTrack && !!currentArtistName;

  const scrollRef = useRef<HTMLDivElement>(null);

  // Position the active track in view whenever tracks finish loading or the panel
  // opens. We jump instantly (`behavior: 'auto'`) rather than smooth-scrolling so the
  // panel simply appears already scrolled to the current song — the user doesn't have
  // to watch the list travel.
  useEffect(() => {
    if (!isOpen || isLoading || !currentTrackUri || !scrollRef.current) return;
    // Skip auto-scroll while we're in the liked-songs view — the active track is
    // probably outside the loaded page and would force an unwanted jump to the top.
    if (panelView === 'liked') return;
    const active = scrollRef.current.querySelector<HTMLElement>('.tracklist-item-active');
    if (active) {
      active.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }, [isOpen, isLoading, tracks, currentTrackUri, panelView]);

  // Reset the panel's scroll position to the top whenever the user enters the
  // Liked Songs or Library view. The scroll container is shared across panel tabs,
  // so without this the previous tab's scroll offset is preserved — Library would
  // open part-way down, and for Liked the browser clamps the stale scrollTop and
  // fires a scroll event near the bottom, triggering a phantom load-more that
  // races the initial fetch and duplicates the first page.
  useEffect(() => {
    if ((panelView === 'liked' || panelView === 'library') && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [panelView]);

  // Infinite scroll: load the next page of Liked Songs when the user nears the bottom.
  useEffect(() => {
    if (panelView !== 'liked' || !onLoadMoreLikedSongs) return;
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      if (!likedHasMore || isLoadingMoreLiked) return;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
        onLoadMoreLikedSongs();
      }
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [panelView, likedHasMore, isLoadingMoreLiked, onLoadMoreLikedSongs]);

  return (
    <div className={`tracklist-panel ${isOpen ? 'tracklist-panel-open' : ''}`}>
      <div className="tracklist-panel-inner">
        {/* Tab bar */}
        <div className="tracklist-header-btns">
          <div className="tracklist-tabs">
            <button
              className={`tracklist-tab ${panelView === 'library' ? 'tracklist-tab-active' : ''}`}
              style={panelView === 'library' ? { color: accentColor, borderBottomColor: accentColor } : undefined}
              onClick={onShowLibrary}
            >
              Library
            </button>
            {showArtistTab && (
              <button
                className={`tracklist-tab tracklist-tab-artist ${panelView === 'artist' ? 'tracklist-tab-active' : ''}`}
                style={panelView === 'artist' ? { color: accentColor, borderBottomColor: accentColor } : undefined}
                onClick={onShowArtist}
                title={currentArtistName ?? undefined}
              >
                {currentArtistName}
              </button>
            )}
            {showAlbumTab && (
              <button
                className={`tracklist-tab ${panelView === 'album' ? 'tracklist-tab-active' : ''}`}
                style={panelView === 'album' ? { color: accentColor, borderBottomColor: accentColor } : undefined}
                onClick={onShowAlbum}
              >
                Album
              </button>
            )}
            {showPlaylistTab && (
              <button
                className={`tracklist-tab ${panelView === 'playlist' ? 'tracklist-tab-active' : ''}`}
                style={panelView === 'playlist' ? { color: accentColor, borderBottomColor: accentColor } : undefined}
                onClick={() => onShowPlaylist?.()}
              >
                Playlist
              </button>
            )}
            <button
              className={`tracklist-tab ${panelView === 'liked' ? 'tracklist-tab-active' : ''}`}
              style={panelView === 'liked' ? { color: accentColor, borderBottomColor: accentColor } : undefined}
              onClick={onShowLikedSongs}
            >
              Liked Songs
            </button>
            {showQueueTab && (
              <button
                className={`tracklist-tab ${panelView === 'queue' ? 'tracklist-tab-active' : ''}`}
                style={panelView === 'queue' ? { color: accentColor, borderBottomColor: accentColor } : undefined}
                onClick={onShowQueue}
              >
                Queue
              </button>
            )}
          </div>
        </div>

        {/* Track list (or Library grid) */}
        <div className="tracklist-scroll" ref={scrollRef}>
          {panelView === 'library' ? (
            isLoadingLibrary ? (
              <div className="library-grid">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="library-card library-card-skeleton">
                    <div className="library-card-cover" />
                    <div className="library-card-name-skeleton" />
                  </div>
                ))}
              </div>
            ) : libraryPlaylists.length === 0 ? (
              <div className="tracklist-library-placeholder">No playlists yet</div>
            ) : (
              <div className="library-grid">
                {libraryPlaylists.map(p => (
                  <button
                    key={p.id}
                    className="library-card"
                    onClick={() => onShowPlaylist?.(p.uri)}
                    title={p.name}
                  >
                    <div
                      className="library-card-cover"
                      style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
                    />
                    <span className="library-card-name">{p.name}</span>
                  </button>
                ))}
              </div>
            )
          ) : isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="tracklist-skeleton-row">
                <div className="tracklist-skeleton-title" />
                <div className="tracklist-skeleton-artist" />
              </div>
            ))
          ) : panelView === 'artist' && tracks.length === 0 ? (
            <div className="tracklist-library-placeholder">
              No liked songs by {currentArtistName}
            </div>
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
          {panelView === 'liked' && isLoadingMoreLiked && (
            <div className="tracklist-skeleton-row">
              <div className="tracklist-skeleton-title" />
              <div className="tracklist-skeleton-artist" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TracklistPanel;
