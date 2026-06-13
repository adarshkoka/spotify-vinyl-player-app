import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getCurrentlyPlayingSong,
  pausePlayback,
  resumePlayback,
  skipToNext,
  skipToPrevious,
  type SpotifyTrack,
  type CurrentlyPlayingResponse,
} from '../services/spotifyService';

interface UseSpotifyPlaybackOptions {
  pollInterval?: number;
  onTrackChange?: (newTrack: SpotifyTrack | null, oldTrackId: string | null) => void;
}

export interface RefetchPlaybackOptions {
  untilTrackChanges?: boolean;
}

interface UseSpotifyPlaybackReturn {
  track: SpotifyTrack | null;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  contextUri: string | null;
  contextType: string | null;
  progressMs: number;
  durationMs: number;
  togglePlayback: () => Promise<void>;
  skipNext: () => Promise<void>;
  skipBack: () => Promise<void>;
  refetchPlayback: (options?: RefetchPlaybackOptions) => Promise<void>;
}

const RETRY_DELAYS_MS = [200, 300, 400, 500, 600, 800];

export function useSpotifyPlayback(
  options: UseSpotifyPlaybackOptions = {}
): UseSpotifyPlaybackReturn {
  const { pollInterval = 5000, onTrackChange } = options;

  const [playbackData, setPlaybackData] = useState<CurrentlyPlayingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const previousTrackIdRef = useRef<string | null>(null);
  const onTrackChangeRef = useRef(onTrackChange);
  onTrackChangeRef.current = onTrackChange;
  const retryTokenRef = useRef(0);
  const playbackDataRef = useRef<CurrentlyPlayingResponse | null>(null);

  // Mirror playbackData to a ref so retry loops always read the latest
  // pre-change track id without re-creating the refetch callback.
  useEffect(() => { playbackDataRef.current = playbackData; }, [playbackData]);

  const fetchPlayback = useCallback(async () => {
    try {
      const data = await getCurrentlyPlayingSong();
      setPlaybackData(data);
      setError(null);

      const newTrackId = data?.item?.id ?? null;
      const oldTrackId = previousTrackIdRef.current;

      if (newTrackId !== oldTrackId) {
        previousTrackIdRef.current = newTrackId;
        onTrackChangeRef.current?.(data?.item ?? null, oldTrackId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch playback state.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchPlayback();
  }, [fetchPlayback]);

  // Polling interval
  useEffect(() => {
    const id = setInterval(fetchPlayback, pollInterval);
    return () => clearInterval(id);
  }, [fetchPlayback, pollInterval]);

  // Refetch on visibility change
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchPlayback();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchPlayback]);

  const refetchPlayback = useCallback(async (options: RefetchPlaybackOptions = {}): Promise<void> => {
    const { untilTrackChanges } = options;
    const token = ++retryTokenRef.current;
    const preChangeTrackId = playbackDataRef.current?.item?.id ?? null;
    const isStale = () => token !== retryTokenRef.current;

    if (!untilTrackChanges) {
      await fetchPlayback();
      return;
    }

    for (const delay of RETRY_DELAYS_MS) {
      await new Promise<void>(resolve => setTimeout(resolve, delay));
      if (isStale()) return;
      try {
        const data = await getCurrentlyPlayingSong();
        if (isStale()) return;
        const newTrackId = data?.item?.id ?? null;
        if (newTrackId !== preChangeTrackId) {
          setPlaybackData(data);
          setError(null);
          if (newTrackId !== previousTrackIdRef.current) {
            previousTrackIdRef.current = newTrackId;
            onTrackChangeRef.current?.(data?.item ?? null, preChangeTrackId);
          }
          return;
        }
      } catch (err) {
        if (isStale()) return;
        console.warn('refetchPlayback retry failed:', err);
      }
    }
    // All attempts exhausted — the regular 3000ms poll will catch up.
  }, [fetchPlayback]);

  // Cancel any in-flight retry loops on unmount.
  useEffect(() => {
    return () => { retryTokenRef.current++; };
  }, []);

  const togglePlayback = useCallback(async () => {
    try {
      if (playbackData?.is_playing) {
        await pausePlayback();
        setPlaybackData((prev) => (prev ? { ...prev, is_playing: false } : prev));
      } else {
        await resumePlayback();
        setPlaybackData((prev) => (prev ? { ...prev, is_playing: true } : prev));
      }
    } catch (err) {
      console.error('Failed to toggle playback:', err);
      // Refetch to get actual state
      fetchPlayback();
    }
  }, [playbackData?.is_playing, fetchPlayback]);

  const skipNext = useCallback(async () => {
    try {
      await skipToNext();
      await refetchPlayback({ untilTrackChanges: true });
    } catch (err) {
      console.error('Failed to skip to next:', err);
    }
  }, [refetchPlayback]);

  const skipBack = useCallback(async () => {
    try {
      await skipToPrevious();
      await refetchPlayback({ untilTrackChanges: true });
    } catch (err) {
      console.error('Failed to skip to previous:', err);
    }
  }, [refetchPlayback]);

  return {
    track: playbackData?.item ?? null,
    isPlaying: playbackData?.is_playing ?? false,
    isLoading,
    error,
    contextUri: playbackData?.context?.uri ?? null,
    contextType: playbackData?.context?.type ?? null,
    progressMs: playbackData?.progress_ms ?? 0,
    durationMs: playbackData?.item?.duration_ms ?? 0,
    togglePlayback,
    skipNext,
    skipBack,
    refetchPlayback,
  };
}
