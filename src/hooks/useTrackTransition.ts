import { useState, useEffect, useRef, useCallback } from 'react';
import type { TransitionStage } from '../types/player';
import type { SpotifyTrack } from '../services/spotifyService';
import {
  JACKET_ENTER_DURATION,
  DISC_EMERGE_DURATION,
  DISC_CENTER_DURATION,
  DISC_REST_DURATION,
  DISC_PLACE_DURATION,
  EJECT_DURATION,
} from '../config';

const STAGE_DURATIONS: Partial<Record<TransitionStage, number>> = {
  'eject': EJECT_DURATION,
  'jacket-enter': JACKET_ENTER_DURATION,
  'disc-emerge': DISC_EMERGE_DURATION,
  'disc-center': DISC_CENTER_DURATION,
  'disc-rest': DISC_REST_DURATION,
  'disc-place': DISC_PLACE_DURATION,
};

const IN_FLIGHT_STAGES: TransitionStage[] = [
  'jacket-enter', 'disc-emerge', 'disc-center', 'disc-rest', 'disc-place',
];

interface UseTrackTransitionReturn {
  stage: TransitionStage;
  jacketTrack: SpotifyTrack | null;
  discTrack: SpotifyTrack | null;
  skipToPlatter: () => void;
}

export function useTrackTransition(
  currentTrack: SpotifyTrack | null,
  isPlaying: boolean,
  isLoading: boolean
): UseTrackTransitionReturn {
  const [stage, setStage] = useState<TransitionStage>('empty');
  const [jacketTrack, setJacketTrack] = useState<SpotifyTrack | null>(null);
  const [discTrack, setDiscTrack] = useState<SpotifyTrack | null>(null);

  const loadedTrackIdRef = useRef<string | null>(null);
  const loadedAlbumUriRef = useRef<string | null>(null);
  // True until the first track has been loaded. Lets us detect a "cold start"
  // (the app opening with a track already on the user's account) so we can skip
  // the entrance animation and show the disc already on the platter.
  const hasLoadedOnceRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const stageRef = useRef<TransitionStage>('empty');
  stageRef.current = stage;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // React to track changes
  useEffect(() => {
    const newTrackId = currentTrack?.id ?? null;
    const oldTrackId = loadedTrackIdRef.current;

    // No change
    if (newTrackId === oldTrackId) return;

    clearTimer();

    // Track removed
    if (!newTrackId) {
      loadedTrackIdRef.current = null;
      loadedAlbumUriRef.current = null;
      if (oldTrackId) {
        // Had a disc loaded → quick fade then empty
        setStage('eject');
        timerRef.current = setTimeout(() => {
          setJacketTrack(null);
          setDiscTrack(null);
          setStage('empty');
        }, STAGE_DURATIONS['eject']!);
      } else {
        setStage('empty');
        setJacketTrack(null);
        setDiscTrack(null);
      }
      return;
    }

    // New track arriving
    loadedTrackIdRef.current = newTrackId;

    // Cold start — the app just opened with a track already loaded on the user's
    // account. Skip the jacket+disc entrance animation and drop the disc straight
    // onto the platter so it appears already spinning (or resting, if paused).
    if (!hasLoadedOnceRef.current) {
      hasLoadedOnceRef.current = true;
      loadedAlbumUriRef.current = currentTrack!.album.uri;
      setJacketTrack(currentTrack!);
      setDiscTrack(currentTrack!);
      setStage(isPlaying ? 'playing' : 'paused');
      return;
    }

    // Same album — skip the full animation, just swap the track reference in place
    if (
      currentTrack!.album.uri === loadedAlbumUriRef.current &&
      (stage === 'playing' || stage === 'paused')
    ) {
      setJacketTrack(currentTrack!);
      setDiscTrack(currentTrack!);
      setStage(isPlaying ? 'playing' : 'paused');
      return;
    }

    // Different album — run the full jacket+disc animation
    loadedAlbumUriRef.current = currentTrack!.album.uri;
    setJacketTrack(currentTrack!);
    setDiscTrack(currentTrack!);
    setStage('jacket-enter');

    timerRef.current = setTimeout(() => {
      setStage('disc-emerge');

      timerRef.current = setTimeout(() => {
        setStage('disc-center');

        timerRef.current = setTimeout(() => {
          setStage('disc-rest');

          timerRef.current = setTimeout(() => {
            setStage('disc-place');

            timerRef.current = setTimeout(() => {
              setStage(isPlayingRef.current ? 'playing' : 'paused');
            }, STAGE_DURATIONS['disc-place']!);
          }, STAGE_DURATIONS['disc-rest']!);
        }, STAGE_DURATIONS['disc-center']!);
      }, STAGE_DURATIONS['disc-emerge']!);
    }, STAGE_DURATIONS['jacket-enter']!);

    return () => clearTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id]);

  // Close the cold-start window once the initial playback poll resolves with
  // nothing playing. Without this, the first track the user manually picks would
  // be mistaken for a cold start and skip its entrance animation. (When the first
  // poll *does* return a track, the track-change effect above consumes the cold
  // start in the same render, so this never fires for that case.)
  useEffect(() => {
    if (!isLoading && !currentTrack && !hasLoadedOnceRef.current) {
      hasLoadedOnceRef.current = true;
    }
  }, [isLoading, currentTrack]);

  // React to isPlaying changes when settled on the platter
  useEffect(() => {
    if (stage === 'playing' || stage === 'paused') {
      setStage(isPlaying ? 'playing' : 'paused');
    }
  }, [isPlaying, stage]);

  const skipToPlatter = useCallback(() => {
    if (!IN_FLIGHT_STAGES.includes(stageRef.current)) return;
    clearTimer();
    setStage(isPlayingRef.current ? 'playing' : 'paused');
  }, [clearTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  return { stage, jacketTrack, discTrack, skipToPlatter };
}
