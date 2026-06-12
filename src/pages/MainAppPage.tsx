import React, { useState, useEffect } from 'react';
import { useSpotifyPlayback } from '../hooks/useSpotifyPlayback';
import { useTrackTransition } from '../hooks/useTrackTransition';
import { usePlayerColors } from '../hooks/usePlayerColors';
import { useTracklistPanel } from '../hooks/useTracklistPanel';
import { useDiscScrub } from '../hooks/useDiscScrub';
import { useLyrics } from '../hooks/useLyrics';
import { useLyricsSettings } from '../hooks/useLyricsSettings';
import RoomScene from '../components/RoomScene';
import RecordPlayer from '../components/RecordPlayer';
import PlayerControls from '../components/PlayerControls';
import ColorCustomizer from '../components/ColorCustomizer';
import LyricsDisplay from '../components/LyricsDisplay';
import { extractColors, DEFAULT_COLORS, pickTracklistAccentColor, type ExtractedColors } from '../utils/colorExtractor';
import { SPOTIFY_POLL_INTERVAL } from '../config';

interface MainAppPageProps {
  onLogout: () => void;
}

const MainAppPage: React.FC<MainAppPageProps> = ({ onLogout }) => {
  const { track, isPlaying, isLoading, error, contextUri, contextType, progressMs, durationMs, togglePlayback, skipNext, skipBack } = useSpotifyPlayback({ pollInterval: SPOTIFY_POLL_INTERVAL });
  const { stage, jacketTrack, discTrack, skipToPlatter } = useTrackTransition(track, isPlaying);
  const [gradientColors, setGradientColors] = useState<ExtractedColors>(DEFAULT_COLORS);
  const { baseBackground, baseColor, baseMaterial, tonearmColor, tonearmMaterial, baseFavorites, tonearmFavorites, setBaseColor, setTonearmColor, applyMaterialPreset, addFavorite } = usePlayerColors();
  const { enabled: lyricsEnabled, setEnabled: setLyricsEnabled } = useLyricsSettings();
  const { lines: lyricLines } = useLyrics(track, lyricsEnabled);
  const { isOpen: isTracklistOpen, isLoading: isTracklistLoading, tracks: tracklistTracks, selectedTrackUri, panelView, isSupportedContext, savedTrackUris, toggleOpen: toggleTracklist, close: closeTracklist, selectTrack, showAlbum, showPlaylist, showQueue, goBack, addToQueue, saveTrack } = useTracklistPanel(contextUri, contextType, track?.album ?? null, track?.uri);

  const handleToggleTracklist = () => {
    skipToPlatter();
    toggleTracklist();
  };

  const canScrub = stage === 'playing' || stage === 'paused';
  const { isScrubbing, scrubAngle, scrubDirection, ledSkip, handlers: scrubHandlers } = useDiscScrub({
    progressMs,
    durationMs,
    isPlaying,
    canScrub,
    onSkipNext: skipNext,
    onSkipBack: skipBack,
  });

  const tracklistAccentColor = pickTracklistAccentColor(baseColor, tonearmColor, gradientColors.vibrantAccent);
  const tracklistAvailable = contextType === 'playlist' || (track?.album?.total_tracks ?? 0) > 1;

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
    <RoomScene gradientColors={gradientColors} onDoubleClick={skipToPlatter}>
      <div className="bottom-bar">
        <ColorCustomizer
          baseColor={baseColor}
          tonearmColor={tonearmColor}
          baseMaterial={baseMaterial}
          tonearmMaterial={tonearmMaterial}
          baseFavorites={baseFavorites}
          tonearmFavorites={tonearmFavorites}
          lyricsEnabled={lyricsEnabled}
          onSetBaseColor={setBaseColor}
          onSetTonearmColor={setTonearmColor}
          onApplyMaterialPreset={applyMaterialPreset}
          onAddFavorite={addFavorite}
          onSetLyricsEnabled={setLyricsEnabled}
        />
        <button onClick={onLogout} className="btn-logout">
          Logout
        </button>
      </div>

      <div className="flex flex-col items-center w-full" style={{ gap: 'var(--gap-player-to-song, 16px)' }}>

        {/* Loading/Error states */}
        {isLoading && <p className="text-spotify-text-subdued text-sm">Connecting...</p>}
        {error && !isLoading && <p className="text-red-400 text-sm">Error: {error}</p>}

        {/* Record player */}
        <div className="relative w-full flex justify-center">
          <RecordPlayer
            jacketTrack={jacketTrack}
            discTrack={discTrack}
            transitionStage={stage}
            onTogglePlayback={togglePlayback}
            baseBackground={baseBackground}
            baseColor={baseColor}
            baseMaterial={baseMaterial}
            tonearmColor={tonearmColor}
            tonearmMaterial={tonearmMaterial}
            isScrubbing={isScrubbing}
            scrubAngle={scrubAngle}
            onDiscPointerDown={scrubHandlers.onPointerDown}
            scrubDirection={scrubDirection}
            ledSkip={ledSkip}
            isTracklistOpen={isTracklistOpen}
            isTracklistLoading={isTracklistLoading}
            tracklistTracks={tracklistTracks}
            currentTrackUri={selectedTrackUri ?? track?.uri ?? null}
            panelView={panelView}
            isPlaylist={isSupportedContext && contextType === 'playlist'}
            albumTrackCount={track?.album?.total_tracks}
            onToggleTracklist={handleToggleTracklist}
            onCloseTracklist={closeTracklist}
            onSelectTrack={selectTrack}
            onShowAlbum={() => { if (track?.album) showAlbum(track.album.id, track.album.uri); }}
            onShowPlaylist={showPlaylist}
            onShowQueue={showQueue}
            onGoBack={goBack}
            onAddToQueue={addToQueue}
            savedTrackUris={savedTrackUris}
            onSaveTrack={saveTrack}
            tracklistAvailable={tracklistAvailable}
            tracklistAccentColor={tracklistAccentColor}
            lyricsOverlay={
              <LyricsDisplay
                lines={lyricLines}
                progressMs={progressMs}
                isPlaying={isPlaying}
              />
            }
          />
        </div>

        {/* Song info + controls grouped tightly */}
        {track && (
          <div className="flex flex-col items-center w-full" style={{ gap: 'var(--gap-song-to-controls, 8px)' }}>
            {!isTracklistOpen && (
              <div className="song-info text-center">
                <p className="song-title text-xl font-bold" title={track.name}>{track.name}</p>
                <p className="song-artist text-spotify-text-subdued" title={track.artists.map(a => a.name).join(', ')}>
                  {track.artists.map((a, i) => (
                    <span key={a.id}>
                      {i > 0 && ', '}
                      <a
                        href={`https://open.spotify.com/artist/${a.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="song-link"
                      >
                        {a.name}
                      </a>
                    </span>
                  ))}
                </p>
                <p className="song-album" title={track.album.name}>
                  <a
                    href={`https://open.spotify.com/album/${track.album.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="song-link"
                  >
                    {track.album.name}
                  </a>
                </p>
              </div>
            )}

            <PlayerControls
              isPlaying={isPlaying}
              onTogglePlayback={togglePlayback}
              onSkipNext={skipNext}
              onSkipBack={skipBack}
            />
          </div>
        )}

      </div>
    </RoomScene>
  );
};

export default MainAppPage;
