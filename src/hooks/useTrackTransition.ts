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

interface UseTrackTransitionReturn {
  stage: TransitionStage;
  jacketTrack: SpotifyTrack | null;
  discTrack: SpotifyTrack | null;
}

export function useTrackTransition(
  currentTrack: SpotifyTrack | null,
  isPlaying: boolean
): UseTrackTransitionReturn {
  const [stage, setStage] = useState<TransitionStage>('empty');
  const [jacketTrack, setJacketTrack] = useState<SpotifyTrack | null>(null);
  const [discTrack, setDiscTrack] = useState<SpotifyTrack | null>(null);

  const loadedTrackIdRef = useRef<string | null>(null);
  const loadedAlbumUriRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

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

  // React to isPlaying changes when settled on the platter
  useEffect(() => {
    if (stage === 'playing' || stage === 'paused') {
      setStage(isPlaying ? 'playing' : 'paused');
    }
  }, [isPlaying, stage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  return { stage, jacketTrack, discTrack };
}
