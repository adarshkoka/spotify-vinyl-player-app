import { useState, useCallback } from 'react';

const STORAGE_KEY = 'spotify-vinyl-player-colors';

export type MaterialPreset = 'wood' | 'aluminum' | 'silver' | 'gold' | null;

export interface MaterialPresetDef {
  id: NonNullable<MaterialPreset>;
  label: string;
  color: string;
  gradient: string;
}

export const MATERIAL_PRESETS: MaterialPresetDef[] = [
  {
    id: 'wood',
    label: 'Wood',
    color: '#4a1410',
    gradient: 'linear-gradient(145deg, #7a2e1a 0%, #5c1e12 34%, #40120c 64%, #260805 100%)',
  },
  {
    id: 'aluminum',
    label: 'Alum.',
    color: '#3f474e',
    gradient: 'linear-gradient(145deg, #8a949d 0%, #555f68 24%, #3f474e 58%, #2a3035 100%)',
  },
  {
    id: 'silver',
    label: 'Silver',
    color: '#818892',
    gradient: 'linear-gradient(145deg, #e8edf2 0%, #a6aeb6 22%, #818892 56%, #565d66 100%)',
  },
  {
    id: 'gold',
    label: 'Gold',
    color: '#8c5e08',
    gradient: 'linear-gradient(145deg, #c89018 0%, #a87010 22%, #7c4c06 58%, #4e2e02 100%)',
  },
];

export const MAX_FAVORITES = 8;

const DEFAULT_FAVORITES: string[] = [
  '#ff0000',
  '#0000ff',
  '#00ff00',
  '#ffff00',
  '#ff00ff',
  '#000000',
];

interface StoredColors {
  baseBackground: string | null;
  baseColor: string;
  baseMaterial: MaterialPreset;
  tonearmColor: string;
  tonearmMaterial: MaterialPreset;
  baseFavorites: string[];
  tonearmFavorites: string[];
}

const DEFAULTS: StoredColors = {
  baseBackground: null,
  baseColor: '#222222',
  baseMaterial: null,
  tonearmColor: '#252525',
  tonearmMaterial: null,
  baseFavorites: DEFAULT_FAVORITES,
  tonearmFavorites: DEFAULT_FAVORITES,
};

function load(): StoredColors {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function save(colors: StoredColors): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
  } catch {
    // localStorage unavailable — silently skip
  }
}

export function usePlayerColors() {
  const [state, setState] = useState<StoredColors>(load);

  const setBaseColor = useCallback((color: string) => {
    setState(prev => {
      const next: StoredColors = { ...prev, baseBackground: color, baseColor: color, baseMaterial: null };
      save(next);
      return next;
    });
  }, []);

  const setTonearmColor = useCallback((color: string) => {
    setState(prev => {
      const next: StoredColors = { ...prev, tonearmColor: color, tonearmMaterial: null };
      save(next);
      return next;
    });
  }, []);

  const addFavorite = useCallback((target: 'base' | 'tonearm', color: string) => {
    const normalized = color.toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(normalized)) return;
    if (MATERIAL_PRESETS.some(p => p.color.toLowerCase() === normalized)) return;
    setState(prev => {
      const key = target === 'base' ? 'baseFavorites' : 'tonearmFavorites';
      const existing = prev[key];
      const filtered = existing.filter(c => c.toLowerCase() !== normalized);
      const nextList = [normalized, ...filtered].slice(0, MAX_FAVORITES);
      const next: StoredColors = { ...prev, [key]: nextList };
      save(next);
      return next;
    });
  }, []);

  const applyMaterialPreset = useCallback((target: 'base' | 'tonearm', presetId: NonNullable<MaterialPreset>) => {
    const preset = MATERIAL_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    setState(prev => {
      const next: StoredColors = target === 'base'
        ? { ...prev, baseBackground: preset.gradient, baseColor: preset.color, baseMaterial: presetId }
        : { ...prev, tonearmColor: preset.color, tonearmMaterial: presetId };
      save(next);
      return next;
    });
  }, []);

  return {
    baseBackground: state.baseBackground,
    baseColor: state.baseColor,
    baseMaterial: state.baseMaterial,
    tonearmColor: state.tonearmColor,
    tonearmMaterial: state.tonearmMaterial,
    baseFavorites: state.baseFavorites,
    tonearmFavorites: state.tonearmFavorites,
    setBaseColor,
    setTonearmColor,
    applyMaterialPreset,
    addFavorite,
  };
}
