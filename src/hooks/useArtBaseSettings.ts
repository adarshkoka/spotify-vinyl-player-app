import { useCallback, useState } from 'react';

const STORAGE_KEY = 'spotify-vinyl-player-art-base';

interface StoredArtBaseSettings {
  /** Album-art-driven turntable base. */
  baseEnabled: boolean;
  /** Album-art-driven tonearm color. */
  armEnabled: boolean;
}

const DEFAULTS: StoredArtBaseSettings = {
  baseEnabled: false,
  armEnabled: false,
};

function load(): StoredArtBaseSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    // Migrate the legacy single-flag shape ({ enabled }) to the base toggle.
    if (typeof parsed.enabled === 'boolean' && parsed.baseEnabled === undefined) {
      return { ...DEFAULTS, baseEnabled: parsed.enabled };
    }
    return { ...DEFAULTS, ...parsed };
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

  const setBaseEnabled = useCallback((enabled: boolean) => {
    setState(prev => {
      if (prev.baseEnabled === enabled) return prev;
      const next: StoredArtBaseSettings = { ...prev, baseEnabled: enabled };
      save(next);
      return next;
    });
  }, []);

  const setArmEnabled = useCallback((enabled: boolean) => {
    setState(prev => {
      if (prev.armEnabled === enabled) return prev;
      const next: StoredArtBaseSettings = { ...prev, armEnabled: enabled };
      save(next);
      return next;
    });
  }, []);

  return {
    baseEnabled: state.baseEnabled,
    armEnabled: state.armEnabled,
    setBaseEnabled,
    setArmEnabled,
  };
}
