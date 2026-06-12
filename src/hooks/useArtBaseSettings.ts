import { useCallback, useState } from 'react';

const STORAGE_KEY = 'spotify-vinyl-player-art-base';

interface StoredArtBaseSettings {
  enabled: boolean;
}

const DEFAULTS: StoredArtBaseSettings = {
  enabled: false,
};

function load(): StoredArtBaseSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function save(settings: StoredArtBaseSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage unavailable — silently skip
  }
}

export function useArtBaseSettings() {
  const [state, setState] = useState<StoredArtBaseSettings>(load);

  const setEnabled = useCallback((enabled: boolean) => {
    setState(prev => {
      if (prev.enabled === enabled) return prev;
      const next: StoredArtBaseSettings = { ...prev, enabled };
      save(next);
      return next;
    });
  }, []);

  return {
    enabled: state.enabled,
    setEnabled,
  };
}
