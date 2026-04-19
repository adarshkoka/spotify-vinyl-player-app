// src/pages/MainAppPage.tsx
import React from 'react';
import { useSpotifyPlayback } from '../hooks/useSpotifyPlayback';
import { useTrackTransition } from '../hooks/useTrackTransition';
import RoomScene from '../components/RoomScene';
import RecordPlayer from '../components/RecordPlayer';

interface MainAppPageProps {
  onLogout: () => void;
}

const MainAppPage: React.FC<MainAppPageProps> = ({ onLogout }) => {
  const { track, isPlaying, isLoading, error, togglePlayback } = useSpotifyPlayback();
  const { stage, jacketTrack, discTrack } = useTrackTransition(track, isPlaying);

  return (
    <RoomScene>
      {/* Loading state */}
      {isLoading && (
        <p className="text-spotify-text-subdued text-sm">Connecting to Spotify...</p>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <p className="text-red-400 text-sm">Error: {error}</p>
      )}

      {/* No song playing */}
      {!isLoading && !error && !track && (
        <p className="text-spotify-text-subdued text-sm">
          No song is currently playing. Start playing on Spotify and it will appear here.
        </p>
      )}

      {/* Record player */}
      <RecordPlayer
        track={track}
        jacketTrack={jacketTrack}
        discTrack={discTrack}
        isPlaying={isPlaying}
        transitionStage={stage}
        onTogglePlayback={togglePlayback}
      />

      {/* Song info */}
      {track && (
        <div className="song-info">
          <p className="song-title" title={track.name}>{track.name}</p>
          <p className="song-artist" title={track.artists.map(a => a.name).join(', ')}>
            {track.artists.map(a => a.name).join(', ')}
          </p>
          {isPlaying && <p className="playback-status mt-1">♫ Playing</p>}
        </div>
      )}

      {/* Logout */}
      <button onClick={onLogout} className="btn-logout mt-4">
        Logout
      </button>
    </RoomScene>
  );
};

export default MainAppPage;
