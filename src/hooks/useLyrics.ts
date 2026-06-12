import { useEffect, useState } from 'react';
import { parseLrc, type LyricLine } from '../utils/lrcParser';
import type { SpotifyTrack } from '../services/spotifyService';

interface LrclibResponse {
  syncedLyrics?: string | null;
  instrumental?: boolean;
}

const cache = new Map<string, LyricLine[]>();

async function fetchLines(track: SpotifyTrack, signal: AbortSignal): Promise<LyricLine[]> {
  const params = new URLSearchParams({
    artist_name: track.artists[0]?.name ?? '',
    track_name: track.name,
    album_name: track.album?.name ?? '',
    duration: String(Math.round(track.duration_ms / 1000)),
  });
  const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`, { signal });
  if (!res.ok) return [];
  const data = (await res.json()) as LrclibResponse;
  if (!data.syncedLyrics) return [];
  return parseLrc(data.syncedLyrics);
}

export function useLyrics(track: SpotifyTrack | null, enabled: boolean) {
  const [lines, setLines] = useState<LyricLine[]>([]);

  useEffect(() => {
    if (!enabled || !track) {
      setLines([]);
      return;
    }

    const cached = cache.get(track.id);
    if (cached) {
      setLines(cached);
      return;
    }

    const controller = new AbortController();
    setLines([]);
    fetchLines(track, controller.signal)
      .then(result => {
        cache.set(track.id, result);
        setLines(result);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        cache.set(track.id, []);
        setLines([]);
      });

    return () => controller.abort();
  }, [track?.id, enabled]);

  return { lines };
}
