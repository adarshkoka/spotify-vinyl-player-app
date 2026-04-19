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

interface UseSpotifyPlaybackReturn {
  track: SpotifyTrack | null;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  contextUri: string | null;
  contextType: string | null;
  togglePlayback: () => Promise<void>;
  skipNext: () => Promise<void>;
  skipBack: () => Promise<void>;
}

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
      setTimeout(fetchPlayback, 300);
    } catch (err) {
      console.error('Failed to skip to next:', err);
    }
  }, [fetchPlayback]);

  const skipBack = useCallback(async () => {
    try {
      await skipToPrevious();
      setTimeout(fetchPlayback, 300);
    } catch (err) {
      console.error('Failed to skip to previous:', err);
    }
  }, [fetchPlayback]);

  return {
    track: playbackData?.item ?? null,
    isPlaying: playbackData?.is_playing ?? false,
    isLoading,
    error,
    contextUri: playbackData?.context?.uri ?? null,
    contextType: playbackData?.context?.type ?? null,
    togglePlayback,
    skipNext,
    skipBack,
  };
}
