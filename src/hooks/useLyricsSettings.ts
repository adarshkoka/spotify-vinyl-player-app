import { useCallback, useState } from 'react';

const STORAGE_KEY = 'spotify-vinyl-player-lyrics';

interface StoredLyricsSettings {
  enabled: boolean;
}

const DEFAULTS: StoredLyricsSettings = {
  enabled: false,
};

function load(): StoredLyricsSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function save(settings: StoredLyricsSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage unavailable — silently skip
  }
}

export function useLyricsSettings() {
  const [state, setState] = useState<StoredLyricsSettings>(load);

  const setEnabled = useCallback((enabled: boolean) => {
    setState(prev => {
      const next: StoredLyricsSettings = { ...prev, enabled };
      save(next);
      return next;
    });
  }, []);

  return {
    enabled: state.enabled,
    setEnabled,
  };
}
