import { useCallback, useState } from 'react';

const STORAGE_KEY = 'spotify-vinyl-player-lyrics';

export type LyricsPosition = 'flank' | 'right';

interface StoredLyricsSettings {
  enabled: boolean;
  position: LyricsPosition;
  colorful: boolean;
}

const DEFAULTS: StoredLyricsSettings = {
  enabled: false,
  position: 'right',
  colorful: true,
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
      // Turning lyrics on auto-enables its dependent sub-settings (lyrics on the
      // right + colorful), filling in their radios; turning off just disables.
      const next: StoredLyricsSettings = enabled
        ? { enabled: true, position: 'right', colorful: true }
        : { ...prev, enabled: false };
      save(next);
      return next;
    });
  }, []);

  const setPosition = useCallback((position: LyricsPosition) => {
    setState(prev => {
      const next: StoredLyricsSettings = { ...prev, position };
      save(next);
      return next;
    });
  }, []);

  const setColorful = useCallback((colorful: boolean) => {
    setState(prev => {
      const next: StoredLyricsSettings = { ...prev, colorful };
      save(next);
      return next;
    });
  }, []);

  return {
    enabled: state.enabled,
    position: state.position,
    colorful: state.colorful,
    setEnabled,
    setPosition,
    setColorful,
  };
}
