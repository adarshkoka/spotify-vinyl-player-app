import { useCallback, useState } from 'react';

const STORAGE_KEY = 'spotify-vinyl-player-playlist-recency';

// Cap the stored map so it can't grow without bound for users who cycle through
// many playlists over time. On write we keep the most-recent MAX_ENTRIES.
const MAX_ENTRIES = 200;

// Map of playlist URI -> epoch-ms timestamp of when it was last seen playing.
// URI (not id) is the key because the playback `contextUri` is a URI and
// `UserPlaylist.uri` matches it directly.
type RecencyMap = Record<string, number>;

function load(): RecencyMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as RecencyMap) : {};
  } catch {
    return {};
  }
}

function save(map: RecencyMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage unavailable — silently skip
  }
}

function prune(map: RecencyMap): RecencyMap {
  const entries = Object.entries(map);
  if (entries.length <= MAX_ENTRIES) return map;
  entries.sort((a, b) => b[1] - a[1]); // newest first
  return Object.fromEntries(entries.slice(0, MAX_ENTRIES));
}

export function usePlaylistRecency() {
  const [recency, setRecency] = useState<RecencyMap>(load);

  const recordPlay = useCallback((playlistUri: string) => {
    setRecency(prev => {
      const next = prune({ ...prev, [playlistUri]: Date.now() });
      save(next);
      return next;
    });
  }, []);

  return { recency, recordPlay };
}
