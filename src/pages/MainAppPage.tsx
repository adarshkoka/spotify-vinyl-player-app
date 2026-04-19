// src/pages/MainAppPage.tsx
import React, { useState, useEffect } from 'react';
import { useSpotifyPlayback } from '../hooks/useSpotifyPlayback';
import { useTrackTransition } from '../hooks/useTrackTransition';
import RoomScene from '../components/RoomScene';
import RecordPlayer from '../components/RecordPlayer';
import PlayerControls from '../components/PlayerControls';
import { extractColors, DEFAULT_COLORS, type ExtractedColors } from '../utils/colorExtractor';

interface MainAppPageProps {
  onLogout: () => void;
}

const MainAppPage: React.FC<MainAppPageProps> = ({ onLogout }) => {
  const { track, isPlaying, isLoading, error, togglePlayback, skipNext, skipBack } = useSpotifyPlayback();
  const { stage, jacketTrack, discTrack } = useTrackTransition(track, isPlaying);
  const [gradientColors, setGradientColors] = useState<ExtractedColors>(DEFAULT_COLORS);

  // Extract colors when track changes
  useEffect(() => {
    const imageUrl = track?.album?.images?.[0]?.url;
    if (imageUrl) {
      extractColors(imageUrl).then(setGradientColors);
    } else {
      setGradientColors(DEFAULT_COLORS);
    }
  }, [track?.id]);

  return (
    <RoomScene gradientColors={gradientColors}>
      <button onClick={onLogout} className="btn-logout">
        Logout
      </button>

      <div className="flex flex-col items-center gap-6 w-full">

        {/* Loading/Error states */}
        {isLoading && <p className="text-spotify-text-subdued text-sm">Connecting...</p>}
        {error && !isLoading && <p className="text-red-400 text-sm">Error: {error}</p>}

        {/* Record player */}
        <div className="relative w-full flex justify-center">
          <RecordPlayer
            track={track}
            jacketTrack={jacketTrack}
            discTrack={discTrack}
            isPlaying={isPlaying}
            transitionStage={stage}
            onTogglePlayback={togglePlayback}
          />
        </div>

        {/* Song info */}
        {track && (
          <div className="song-info text-center">
            <p className="song-title text-xl font-bold" title={track.name}>{track.name}</p>
            <p className="song-artist text-spotify-text-subdued" title={track.artists.map(a => a.name).join(', ')}>
              {track.artists.map(a => a.name).join(', ')}
            </p>
            <p className="song-album" title={track.album.name}>{track.album.name}</p>
          </div>
        )}

        {/* Player controls */}
        {track && (
          <PlayerControls
            isPlaying={isPlaying}
            onTogglePlayback={togglePlayback}
            onSkipNext={skipNext}
            onSkipBack={skipBack}
          />
        )}

      </div>
    </RoomScene>
  );
};

export default MainAppPage;
