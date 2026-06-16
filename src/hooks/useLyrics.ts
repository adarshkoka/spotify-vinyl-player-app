import { useEffect, useState } from 'react';
import { parseLrc, type LyricLine } from '../utils/lrcParser';
import type { SpotifyTrack } from '../services/spotifyService';

interface LrclibResponse {
  syncedLyrics?: string | null;
  instrumental?: boolean;
}

/** Minimal track info needed to look up lyrics. Lets non-SpotifyTrack callers
 *  (e.g. panel rows, which lack album data) prefetch. */
export interface LyricLookup {
  id: string; // cache key (track id)
  trackName: string;
  artistName: string; // first artist only
  albumName?: string; // panel rows lack this — falls back to /search
  durationSec?: number;
}

// Per-track-id results cache. `[]` is stored on a miss so we don't refetch.
const cache = new Map<string, LyricLine[]>();
// In-flight loads, so a prefetch and the hook's own fetch for the same id
// share a single network request instead of racing.
const inflight = new Map<string, Promise<LyricLine[]>>();

export function toLyricLookup(track: SpotifyTrack): LyricLookup {
  return {
    id: track.id,
    trackName: track.name,
    artistName: track.artists[0]?.name ?? '',
    albumName: track.album?.name,
    durationSec: Math.round(track.duration_ms / 1000),
  };
}

async function fetchGet(info: LyricLookup): Promise<LyricLine[]> {
  const params = new URLSearchParams({
    artist_name: info.artistName,
    track_name: info.trackName,
    album_name: info.albumName ?? '',
    duration: String(info.durationSec ?? 0),
  });
  const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`);
  if (!res.ok) return [];
  const data = (await res.json()) as LrclibResponse;
  if (!data.syncedLyrics) return [];
  return parseLrc(data.syncedLyrics);
}

async function fetchSearch(info: LyricLookup): Promise<LyricLine[]> {
  const params = new URLSearchParams({
    track_name: info.trackName,
    artist_name: info.artistName,
  });
  const res = await fetch(`https://lrclib.net/api/search?${params.toString()}`);
  if (!res.ok) return [];
  const data = (await res.json()) as LrclibResponse[];
  const hit = Array.isArray(data) ? data.find(d => d.syncedLyrics) : undefined;
  return hit?.syncedLyrics ? parseLrc(hit.syncedLyrics) : [];
}

/** Try the exact /get match (when album + duration are known), then fall back
 *  to a fuzzy /search by track + artist. */
async function lrclibLookup(info: LyricLookup): Promise<LyricLine[]> {
  if (info.albumName && info.durationSec) {
    const exact = await fetchGet(info);
    if (exact.length) return exact;
  }
  return fetchSearch(info);
}

/** Cache-aware, deduped loader. Resolves from cache, an in-flight request, or a
 *  fresh lookup (whose result is cached, `[]` included, to prevent refetch). */
export function loadLyrics(info: LyricLookup): Promise<LyricLine[]> {
  const cached = cache.get(info.id);
  if (cached) return Promise.resolve(cached);

  const existing = inflight.get(info.id);
  if (existing) return existing;

  const promise = lrclibLookup(info)
    .catch(() => [])
    .then(lines => {
      cache.set(info.id, lines);
      inflight.delete(info.id);
      return lines;
    });
  inflight.set(info.id, promise);
  return promise;
}

/** Warm the cache for a track before it becomes current. No-op if we already
 *  have (or are fetching) its lyrics. */
export function prefetchLyrics(info: LyricLookup | null): void {
  if (!info?.id) return;
  if (cache.has(info.id) || inflight.has(info.id)) return;
  void loadLyrics(info);
}

export function useLyrics(track: SpotifyTrack | null, enabled: boolean) {
  const [lines, setLines] = useState<LyricLine[]>([]);

  useEffect(() => {
    if (!enabled || !track) {
      setLines([]);
      return;
    }

    const info = toLyricLookup(track);
    const cached = cache.get(info.id);
    if (cached) {
      setLines(cached);
      return;
    }

    let active = true;
    setLines([]);
    loadLyrics(info).then(result => {
      if (active) setLines(result);
    });

    return () => { active = false; };
  }, [track?.id, enabled]);

  return { lines };
}
