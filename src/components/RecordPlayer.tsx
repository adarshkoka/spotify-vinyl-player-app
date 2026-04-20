import React from 'react';
import VinylDisc from './VinylDisc';
import AlbumJacket from './AlbumJacket';
import TracklistPanel from './TracklistPanel';
import Tonearm from './Tonearm';
import type { TransitionStage } from '../types/player';
import type { SpotifyTrack, ContextTrack } from '../services/spotifyService';
import type { MaterialPreset } from '../hooks/usePlayerColors';

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
  // Tracklist panel props
  isTracklistOpen?: boolean;
  tracklistTracks?: ContextTrack[];
  currentTrackUri?: string | null;
  isPlaylist?: boolean;
  isShowingAlbum?: boolean;
  albumTrackCount?: number;
  onToggleTracklist?: () => void;
  onCloseTracklist?: () => void;
  onSelectTrack?: (trackUri: string) => void;
  onShowAlbum?: () => void;
  onShowContext?: () => void;
  tracklistAccentColor?: string;
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
  isTracklistOpen = false,
  tracklistTracks = [],
  currentTrackUri = null,
  isPlaylist = false,
  isShowingAlbum = false,
  albumTrackCount,
  onToggleTracklist,
  onCloseTracklist,
  onSelectTrack,
  onShowAlbum,
  onShowContext,
  tracklistAccentColor,
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
            />
          )}

          {/* Platter center spindle */}
          {!isDiscOnPlatter && <div className="platter-spindle" />}
        </div>
      </div>

      {/* Jacket + transitioning disc area */}
      <div className="transition-area">
        {showJacket && (
          <AlbumJacket
            albumArtUrl={jacketArt}
            className={`stage-${transitionStage}`}
            canOpen={transitionStage !== 'jacket-enter' && transitionStage !== 'eject'}
            isOpen={isTracklistOpen}
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
        tracks={tracklistTracks}
        currentTrackUri={currentTrackUri}
        accentColor={tracklistAccentColor ?? baseColor}
        isPlaylist={isPlaylist}
        isShowingAlbum={isShowingAlbum}
        albumTrackCount={albumTrackCount}
        onSelectTrack={onSelectTrack ?? (() => {})}
        onClose={onCloseTracklist ?? (() => {})}
        onShowAlbum={onShowAlbum}
        onShowContext={onShowContext}
      />
    </div>
  );
};

export default RecordPlayer;
