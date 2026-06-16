import React, { useState, useEffect, useRef } from 'react';
import { useSpotifyPlayback } from '../hooks/useSpotifyPlayback';
import { useTrackTransition } from '../hooks/useTrackTransition';
import { usePlayerColors } from '../hooks/usePlayerColors';
import { useTracklistPanel } from '../hooks/useTracklistPanel';
import { useDiscScrub, type LedSkip } from '../hooks/useDiscScrub';
import { useLyrics } from '../hooks/useLyrics';
import { useLyricsSettings } from '../hooks/useLyricsSettings';
import { useArtBaseSettings } from '../hooks/useArtBaseSettings';
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
  const { track, isPlaying, isLoading, error, contextUri, contextType, progressMs, durationMs, togglePlayback, skipNext, skipBack, refetchPlayback } = useSpotifyPlayback({ pollInterval: SPOTIFY_POLL_INTERVAL });
  const { stage, jacketTrack, discTrack, skipToPlatter } = useTrackTransition(track, isPlaying, isLoading);
  const [gradientColors, setGradientColors] = useState<ExtractedColors>(DEFAULT_COLORS);
  const { baseBackground, baseColor, baseMaterial, tonearmColor, tonearmMaterial, baseFavorites, tonearmFavorites, setBaseColor, setTonearmColor, applyMaterialPreset, addFavorite } = usePlayerColors();
  const { enabled: lyricsEnabled, position: lyricsPosition, setEnabled: setLyricsEnabled, setPosition: setLyricsPosition } = useLyricsSettings();
  const { lines: lyricLines } = useLyrics(track, lyricsEnabled);
  const { baseEnabled: artBaseEnabled, armEnabled: artArmEnabled, setBaseEnabled: setArtBaseEnabled, setArmEnabled: setArtArmEnabled } = useArtBaseSettings();

  const effectiveBaseBackground = artBaseEnabled ? gradientColors.busyGradient : baseBackground;
  const effectiveBaseColor = artBaseEnabled ? gradientColors.busyDominant : baseColor;
  const effectiveBaseMaterial = artBaseEnabled ? null : baseMaterial;
  const effectiveTonearmColor = artArmEnabled ? gradientColors.busyDominant : tonearmColor;
  const effectiveTonearmMaterial = artArmEnabled ? null : tonearmMaterial;

  const handleSetBaseColor = (color: string) => {
    setArtBaseEnabled(false);
    setBaseColor(color);
  };
  const handleSetTonearmColor = (color: string) => {
    setArtArmEnabled(false);
    setTonearmColor(color);
  };
  const handleApplyMaterialPreset = (target: 'base' | 'tonearm', preset: 'wood' | 'aluminum' | 'silver' | 'gold') => {
    if (target === 'base') setArtBaseEnabled(false);
    else setArtArmEnabled(false);
    applyMaterialPreset(target, preset);
  };
  const { isOpen: isTracklistOpen, isLoading: isTracklistLoading, tracks: tracklistTracks, selectedTrackUri, panelView, isSupportedContext, savedTrackUris, isLoadingMoreLiked, likedHasMore, libraryPlaylists, isLoadingLibrary, toggleOpen: toggleTracklist, close: closeTracklist, selectTrack, showAlbum, showLibrary, showPlaylist, showQueue, showLikedSongs, loadMoreLikedSongs, addToQueue, saveTrack } = useTracklistPanel(contextUri, contextType, track?.album ?? null, track?.uri, refetchPlayback);

  const handleToggleTracklist = () => {
    skipToPlatter();
    toggleTracklist();
  };

  // A single click on the empty room background dismisses the tracklist panel.
  // Clicks that land on an interactive surface (the player and its panel, the
  // transport controls, the song info, or the settings bar) are ignored. The
  // settings panel handles its own outside-click dismissal in ColorCustomizer.
  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (!isTracklistOpen) return;
    // When nothing is playing the panel is the only way to pick a song, so it
    // must stay open (mirrors the hidden close button in that state).
    if (!track) return;
    if ((e.target as HTMLElement).closest('.record-player, .player-controls, .song-info, .bottom-bar')) return;
    closeTracklist();
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

  // Briefly flash the skip-prev / skip-next LED when the user clicks the
  // player-control buttons (the disc-scrub gesture already flashes its own LED).
  const [controlsLedSkip, setControlsLedSkip] = useState<LedSkip>('none');
  const controlsLedBlinkRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashControlsLedSkip = (direction: 'skip-next' | 'skip-prev') => {
    setControlsLedSkip(direction);
    if (controlsLedBlinkRef.current) clearTimeout(controlsLedBlinkRef.current);
    controlsLedBlinkRef.current = setTimeout(() => setControlsLedSkip('none'), 400);
  };
  useEffect(() => () => {
    if (controlsLedBlinkRef.current) clearTimeout(controlsLedBlinkRef.current);
  }, []);
  const handleSkipNextControls = () => { flashControlsLedSkip('skip-next'); skipNext(); };
  const handleSkipBackControls = () => { flashControlsLedSkip('skip-prev'); skipBack(); };

  // Combine the disc-scrub LED with the controls LED — either source can light
  // the same physical light on the player.
  const effectiveLedSkip: LedSkip = ledSkip !== 'none' ? ledSkip : controlsLedSkip;
  // Pause LED stays on as long as the player is in the paused steady-state.
  const ledPause = stage === 'paused';

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

  // Auto-open Liked Songs on first load if no song is currently playing on the
  // user's Spotify account — so the user can start a song without leaving the app.
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current) return;
    if (isLoading) return;
    autoOpenedRef.current = true;
    if (!track) {
      showLikedSongs();
    }
  }, [isLoading, track, showLikedSongs]);

  return (
    <RoomScene gradientColors={gradientColors} onDoubleClick={skipToPlatter} onClick={handleBackgroundClick}>
      <div className="bottom-bar">
        <ColorCustomizer
          baseColor={baseColor}
          tonearmColor={tonearmColor}
          baseMaterial={effectiveBaseMaterial}
          tonearmMaterial={effectiveTonearmMaterial}
          baseFavorites={baseFavorites}
          tonearmFavorites={tonearmFavorites}
          lyricsEnabled={lyricsEnabled}
          lyricsPosition={lyricsPosition}
          artBaseEnabled={artBaseEnabled}
          artArmEnabled={artArmEnabled}
          artBaseGradient={gradientColors.busyGradient}
          artArmColor={gradientColors.busyDominant}
          onSetBaseColor={handleSetBaseColor}
          onSetTonearmColor={handleSetTonearmColor}
          onApplyMaterialPreset={handleApplyMaterialPreset}
          onAddFavorite={addFavorite}
          onSetLyricsEnabled={setLyricsEnabled}
          onSetLyricsPosition={setLyricsPosition}
          onSetArtBaseEnabled={setArtBaseEnabled}
          onSetArtArmEnabled={setArtArmEnabled}
          onLogout={onLogout}
        />
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
            baseBackground={effectiveBaseBackground}
            baseColor={effectiveBaseColor}
            baseMaterial={effectiveBaseMaterial}
            tonearmColor={effectiveTonearmColor}
            tonearmMaterial={effectiveTonearmMaterial}
            isScrubbing={isScrubbing}
            scrubAngle={scrubAngle}
            onDiscPointerDown={scrubHandlers.onPointerDown}
            scrubDirection={scrubDirection}
            ledSkip={effectiveLedSkip}
            ledPause={ledPause}
            isTracklistOpen={isTracklistOpen}
            isTracklistLoading={isTracklistLoading}
            tracklistTracks={tracklistTracks}
            currentTrackUri={selectedTrackUri ?? track?.uri ?? null}
            panelView={panelView}
            isPlaylist={isSupportedContext && contextType === 'playlist'}
            albumTrackCount={track?.album?.total_tracks}
            hasCurrentTrack={!!track}
            onToggleTracklist={handleToggleTracklist}
            onCloseTracklist={closeTracklist}
            onSelectTrack={selectTrack}
            onShowAlbum={() => { if (track?.album) showAlbum(track.album.id, track.album.uri); }}
            onShowLibrary={showLibrary}
            onShowPlaylist={showPlaylist}
            onShowQueue={showQueue}
            onShowLikedSongs={showLikedSongs}
            onLoadMoreLikedSongs={loadMoreLikedSongs}
            isLoadingMoreLiked={isLoadingMoreLiked}
            likedHasMore={likedHasMore}
            libraryPlaylists={libraryPlaylists}
            isLoadingLibrary={isLoadingLibrary}
            onAddToQueue={addToQueue}
            savedTrackUris={savedTrackUris}
            onSaveTrack={saveTrack}
            tracklistAvailable={tracklistAvailable}
            tracklistAccentColor={tracklistAccentColor}
            lyricsPosition={lyricsPosition}
            lyricsOverlay={
              <LyricsDisplay
                lines={lyricLines}
                progressMs={progressMs}
                isPlaying={isPlaying}
                position={lyricsPosition}
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
              onSkipNext={handleSkipNextControls}
              onSkipBack={handleSkipBackControls}
            />
          </div>
        )}

      </div>
    </RoomScene>
  );
};

export default MainAppPage;
