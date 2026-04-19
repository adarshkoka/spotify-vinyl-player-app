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
    color: '#3b1f0c',
    gradient: 'linear-gradient(145deg, #5c3317 0%, #3b1f0c 60%, #2a1508 100%)',
  },
  {
    id: 'aluminum',
    label: 'Alum.',
    color: '#22272b',
    gradient: 'linear-gradient(145deg, #3a3f44 0%, #22272b 60%, #1a1e21 100%)',
  },
  {
    id: 'silver',
    label: 'Silver',
    color: '#6b6b6b',
    gradient: 'linear-gradient(145deg, #9e9e9e 0%, #6b6b6b 50%, #4a4a4a 100%)',
  },
  {
    id: 'gold',
    label: 'Gold',
    color: '#8b6310',
    gradient: 'linear-gradient(145deg, #c9922a 0%, #8b6310 50%, #5c3f08 100%)',
  },
];

interface StoredColors {
  baseBackground: string | null;
  baseColor: string;
  baseMaterial: MaterialPreset;
  tonearmBackground: string | null;
  tonearmColor: string;
  tonearmMaterial: MaterialPreset;
}

const DEFAULTS: StoredColors = {
  baseBackground: null,
  baseColor: '#222222',
  baseMaterial: null,
  tonearmBackground: null,
  tonearmColor: '#252525',
  tonearmMaterial: null,
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
      const next: StoredColors = { ...prev, tonearmBackground: color, tonearmColor: color, tonearmMaterial: null };
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
        : { ...prev, tonearmBackground: preset.gradient, tonearmColor: preset.color, tonearmMaterial: presetId };
      save(next);
      return next;
    });
  }, []);

  return {
    baseBackground: state.baseBackground,
    baseColor: state.baseColor,
    baseMaterial: state.baseMaterial,
    tonearmBackground: state.tonearmBackground,
    tonearmColor: state.tonearmColor,
    tonearmMaterial: state.tonearmMaterial,
    setBaseColor,
    setTonearmColor,
    applyMaterialPreset,
  };
}
