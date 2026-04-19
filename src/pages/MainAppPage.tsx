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
      {/* RoomScene content goes here */}
      <div className="flex flex-col items-center gap-8 w-full">
        
        {/* Loading/Error states */}
        {isLoading && <p className="...">Connecting...</p>}
        {error && !isLoading && <p className="...">Error: {error}</p>}

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
            <p className="song-artist text-spotify-text-subdued" title="...">
              {track.artists.map(a => a.name).join(', ')}
            </p>
            {isPlaying && <p className="playback-status mt-2 text-green-400">♫ PLAYING</p>}
          </div>
        )}

        {/* Logout */}
        {/* <button onClick={onLogout} className="btn-logout">
          Logout
        </button> */}
      </div>
    </RoomScene>
  );
};

export default MainAppPage;
