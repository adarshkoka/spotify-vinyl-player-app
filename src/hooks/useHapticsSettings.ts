import { useCallback, useState } from 'react';

const STORAGE_KEY = 'spotify-vinyl-player-haptics';

interface StoredHapticsSettings {
  enabled: boolean;
}

const DEFAULTS: StoredHapticsSettings = {
  enabled: true,
};

function load(): StoredHapticsSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function save(settings: StoredHapticsSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage unavailable — silently skip
  }
}

export function useHapticsSettings() {
  const [state, setState] = useState<StoredHapticsSettings>(load);

  const setEnabled = useCallback((enabled: boolean) => {
    const next: StoredHapticsSettings = { enabled };
    save(next);
    setState(next);
  }, []);

  return {
    enabled: state.enabled,
    setEnabled,
  };
}
