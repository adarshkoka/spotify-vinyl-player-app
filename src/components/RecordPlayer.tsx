import React from 'react';
import VinylDisc from './VinylDisc';
import AlbumJacket from './AlbumJacket';
import type { TransitionStage } from '../types/player';
import type { SpotifyTrack } from '../services/spotifyService';

interface RecordPlayerProps {
  track: SpotifyTrack | null;
  jacketTrack: SpotifyTrack | null;
  discTrack: SpotifyTrack | null;
  isPlaying: boolean;
  transitionStage: TransitionStage;
  onTogglePlayback: () => void;
}

function getAlbumArtUrl(track: SpotifyTrack | null): string | null {
  return track?.album?.images?.[0]?.url ?? null;
}

const RecordPlayer: React.FC<RecordPlayerProps> = ({
  jacketTrack,
  discTrack,
  transitionStage,
  onTogglePlayback,
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
      <div className="turntable-base">
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
    </div>
  );
};

export default RecordPlayer;
