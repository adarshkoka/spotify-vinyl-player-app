import { useState, useEffect, useRef, useCallback } from 'react';
import type { TransitionStage } from '../types/player';
import type { SpotifyTrack } from '../services/spotifyService';

const STAGE_DURATIONS: Partial<Record<TransitionStage, number>> = {
  'eject': 600,
  'jacket-enter': 800,
  'disc-emerge': 700,
  'disc-place': 600,
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const advanceAfter = useCallback(
    (nextStage: TransitionStage, duration: number) => {
      clearTimer();
      timerRef.current = setTimeout(() => {
        setStage(nextStage);
      }, duration);
    },
    [clearTimer]
  );

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
      if (oldTrackId) {
        // Had a disc loaded → eject
        setStage('eject');
        advanceAfter('empty', STAGE_DURATIONS['eject']!);
        // Clear tracks after eject
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

    if (oldTrackId) {
      // Eject old disc first, then load new
      setStage('eject');
      timerRef.current = setTimeout(() => {
        startLoadSequence(currentTrack!);
      }, STAGE_DURATIONS['eject']!);
    } else {
      // No old disc, start loading directly
      startLoadSequence(currentTrack!);
    }

    function startLoadSequence(track: SpotifyTrack) {
      setJacketTrack(track);
      setDiscTrack(track);
      setStage('jacket-enter');

      timerRef.current = setTimeout(() => {
        setStage('disc-emerge');

        timerRef.current = setTimeout(() => {
          setStage('disc-place');

          timerRef.current = setTimeout(() => {
            setStage(isPlaying ? 'playing' : 'paused');
          }, STAGE_DURATIONS['disc-place']!);
        }, STAGE_DURATIONS['disc-emerge']!);
      }, STAGE_DURATIONS['jacket-enter']!);
    }

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
