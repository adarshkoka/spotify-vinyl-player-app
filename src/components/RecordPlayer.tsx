import React from 'react';
import VinylDisc from './VinylDisc';
import AlbumJacket from './AlbumJacket';
import TracklistPanel from './TracklistPanel';
import Tonearm from './Tonearm';
import type { TransitionStage } from '../types/player';
import type { SpotifyTrack, ContextTrack, UserPlaylist } from '../services/spotifyService';
import type { MaterialPreset } from '../hooks/usePlayerColors';
import type { PanelView } from '../hooks/useTracklistPanel';
import type { ScrubDirection, LedSkip } from '../hooks/useDiscScrub';

interface RecordPlayerProps {
  jacketTrack: SpotifyTrack | null;
  discTrack: SpotifyTrack | null;
  transitionStage: TransitionStage;
  onTogglePlayback: () => void;
  baseBackground?: string | null;
  baseColor?: string;
  baseMaterial?: MaterialPreset;
  tonearmColor?: string;
  tonearmMaterial?: MaterialPreset;
  // Scrub props
  isScrubbing?: boolean;
  scrubAngle?: number;
  scrubDirection?: ScrubDirection;
  ledSkip?: LedSkip;
  ledPause?: boolean;
  hapticsEnabled?: boolean;
  onDiscPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  // Tracklist panel props
  isTracklistOpen?: boolean;
  isTracklistLoading?: boolean;
  tracklistTracks?: ContextTrack[];
  currentTrackUri?: string | null;
  panelView?: PanelView;
  isPlaylist?: boolean;
  albumTrackCount?: number;
  hasCurrentTrack?: boolean;
  onToggleTracklist?: () => void;
  onSelectTrack?: (trackUri: string) => void;
  onShowAlbum?: () => void;
  onShowLibrary?: () => void;
  onShowPlaylist?: (playlistUri?: string) => void;
  onShowQueue?: () => void;
  onShowLikedSongs?: () => void;
  onShowArtist?: () => void;
  currentArtistName?: string | null;
  onLoadMoreLikedSongs?: () => void;
  isLoadingMoreLiked?: boolean;
  likedHasMore?: boolean;
  libraryPlaylists?: UserPlaylist[];
  isLoadingLibrary?: boolean;
  onAddToQueue?: (trackUri: string) => Promise<void>;
  tracklistAccentColor?: string;
  tracklistAvailable?: boolean;
  savedTrackUris?: Set<string>;
  onSaveTrack?: (trackUri: string) => Promise<void>;
  lyricsOverlay?: React.ReactNode;
  lyricsPosition?: 'flank' | 'right';
}

function getAlbumArtUrl(track: SpotifyTrack | null): string | null {
  return track?.album?.images?.[0]?.url ?? null;
}

function getTextureClass(material: MaterialPreset): string {
  if (material === 'wood') return 'base-texture-wood';
  if (material === 'aluminum') return 'base-texture-aluminum';
  if (material === 'silver') return 'base-texture-silver';
  if (material === 'gold') return 'base-texture-gold';
  return 'base-texture-plastic';
}

const RecordPlayer: React.FC<RecordPlayerProps> = ({
  jacketTrack,
  discTrack,
  transitionStage,
  onTogglePlayback,
  baseBackground,
  baseColor = '#222222',
  baseMaterial,
  tonearmColor,
  tonearmMaterial,
  isScrubbing = false,
  scrubAngle = 0,
  scrubDirection = 'none',
  ledSkip = 'none',
  ledPause = false,
  hapticsEnabled = true,
  onDiscPointerDown,
  isTracklistOpen = false,
  isTracklistLoading = false,
  tracklistTracks = [],
  currentTrackUri = null,
  panelView = 'playlist',
  isPlaylist = false,
  albumTrackCount,
  hasCurrentTrack = false,
  onToggleTracklist,
  onSelectTrack,
  onShowAlbum,
  onShowLibrary,
  onShowPlaylist,
  onShowQueue,
  onShowLikedSongs,
  onShowArtist,
  currentArtistName,
  onLoadMoreLikedSongs,
  isLoadingMoreLiked = false,
  likedHasMore = false,
  libraryPlaylists,
  isLoadingLibrary = false,
  onAddToQueue,
  tracklistAccentColor,
  tracklistAvailable = true,
  savedTrackUris,
  onSaveTrack,
  lyricsOverlay,
  lyricsPosition = 'flank',
}) => {
  const discArt = getAlbumArtUrl(discTrack);
  const jacketArt = getAlbumArtUrl(jacketTrack);

  const showJacket = transitionStage !== 'empty';
  const showDisc = !['empty', 'jacket-enter'].includes(transitionStage);
  const isDiscSpinning = transitionStage === 'playing';
  const isDiscOnPlatter = ['playing', 'paused'].includes(transitionStage);

  return (
    <div className="record-player">
      {/* Turntable base */}
      <div
        className="turntable-base"
        style={baseBackground ? { background: baseBackground } : undefined}
      >
        {/* Texture overlay */}
        <div className={`base-texture-overlay ${getTextureClass(baseMaterial ?? null)}`} />

        {/* Tonearm — absolutely positioned inside the base */}
        <Tonearm
          transitionStage={transitionStage}
          tonearmColor={tonearmColor}
          tonearmMaterial={tonearmMaterial}
          isScrubbing={isScrubbing}
        />

        {/* Platter */}
        <div className="turntable-platter" onClick={onTogglePlayback}>
          {/* Disc on the platter */}
          {showDisc && isDiscOnPlatter && (
            <VinylDisc
              albumArtUrl={discArt}
              isSpinning={isDiscSpinning}
              className="disc-on-platter"
              onClick={onTogglePlayback}
              isScrubbing={isScrubbing}
              scrubAngle={scrubAngle}
              onPointerDown={onDiscPointerDown}
            />
          )}

          {/* Platter center spindle */}
          {!isDiscOnPlatter && <div className="platter-spindle" />}
        </div>

        {/* Transport LED indicators */}
        <div className="transport-leds">
          <span className={`transport-led ${ledSkip === 'skip-prev' ? 'led-active' : ''}`}>
            <svg viewBox="0 0 10 8" fill="currentColor"><rect x="0" y="0" width="1.5" height="8"/><polygon points="9.5,0 2.5,4 9.5,8"/></svg>
          </span>
          <span className={`transport-led ${scrubDirection === 'backward' ? 'led-active' : ''}`}>
            <svg viewBox="0 0 12 8" fill="currentColor"><polygon points="6,0 0,4 6,8"/><polygon points="12,0 6,4 12,8"/></svg>
          </span>
          <span className={`transport-led ${ledPause ? 'led-active' : ''}`}>
            <svg viewBox="0 0 10 8" fill="currentColor"><rect x="1.5" y="0" width="2.5" height="8"/><rect x="6" y="0" width="2.5" height="8"/></svg>
          </span>
          <span className={`transport-led ${scrubDirection === 'forward' ? 'led-active' : ''}`}>
            <svg viewBox="0 0 12 8" fill="currentColor"><polygon points="0,0 6,4 0,8"/><polygon points="6,0 12,4 6,8"/></svg>
          </span>
          <span className={`transport-led ${ledSkip === 'skip-next' ? 'led-active' : ''}`}>
            <svg viewBox="0 0 10 8" fill="currentColor"><polygon points="0,0 7,4 0,8"/><rect x="8.5" y="0" width="1.5" height="8"/></svg>
          </span>
        </div>
      </div>

      {/* Jacket + transitioning disc area */}
      <div className={`transition-area ${transitionStage === 'empty' ? 'transition-area-empty' : ''} ${lyricsPosition === 'right' ? 'transition-area-lyrics-right' : ''}`}>
        {lyricsOverlay}
        {showJacket && (
          <AlbumJacket
            albumArtUrl={jacketArt}
            className={`stage-${transitionStage}`}
            canOpen={transitionStage !== 'jacket-enter' && transitionStage !== 'eject' && tracklistAvailable}
            isOpen={isTracklistOpen}
            hapticsEnabled={hapticsEnabled}
            onToggleOpen={onToggleTracklist}
          />
        )}

        {/* Disc during emergence/rest/placement transition */}
        {showDisc && !isDiscOnPlatter && (
          <VinylDisc
            albumArtUrl={discArt}
            isSpinning={false}
            className={`disc-transitioning stage-${transitionStage}`}
          />
        )}
      </div>

      {/* Tracklist panel — expands below transition area */}
      <TracklistPanel
        isOpen={isTracklistOpen}
        isLoading={isTracklistLoading}
        tracks={tracklistTracks}
        currentTrackUri={currentTrackUri}
        accentColor={tracklistAccentColor ?? baseColor}
        panelView={panelView}
        isPlaylist={isPlaylist}
        albumTrackCount={albumTrackCount}
        hasCurrentTrack={hasCurrentTrack}
        onSelectTrack={onSelectTrack ?? (() => {})}
        onShowAlbum={onShowAlbum}
        onShowLibrary={onShowLibrary}
        onShowPlaylist={onShowPlaylist}
        onShowQueue={onShowQueue}
        onShowLikedSongs={onShowLikedSongs}
        onShowArtist={onShowArtist}
        currentArtistName={currentArtistName}
        onLoadMoreLikedSongs={onLoadMoreLikedSongs}
        isLoadingMoreLiked={isLoadingMoreLiked}
        likedHasMore={likedHasMore}
        libraryPlaylists={libraryPlaylists}
        isLoadingLibrary={isLoadingLibrary}
        onAddToQueue={onAddToQueue}
        savedTrackUris={savedTrackUris}
        onSaveTrack={onSaveTrack}
      />
    </div>
  );
};

export default RecordPlayer;
