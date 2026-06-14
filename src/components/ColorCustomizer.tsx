import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MATERIAL_PRESETS } from '../hooks/usePlayerColors';
import type { MaterialPreset } from '../hooks/usePlayerColors';
import { hexToHsv, hsvToHex, type Hsv } from '../utils/colorConvert';

interface ColorCustomizerProps {
  baseColor: string;
  tonearmColor: string;
  baseMaterial: MaterialPreset;
  tonearmMaterial: MaterialPreset;
  baseFavorites: string[];
  tonearmFavorites: string[];
  lyricsEnabled: boolean;
  lyricsPosition: 'flank' | 'right';
  artBaseEnabled: boolean;
  artBaseGradient: string;
  onSetBaseColor: (color: string) => void;
  onSetTonearmColor: (color: string) => void;
  onApplyMaterialPreset: (target: 'base' | 'tonearm', preset: NonNullable<MaterialPreset>) => void;
  onAddFavorite: (target: 'base' | 'tonearm', color: string) => void;
  onSetLyricsEnabled: (enabled: boolean) => void;
  onSetLyricsPosition: (position: 'flank' | 'right') => void;
  onSetArtBaseEnabled: (enabled: boolean) => void;
  onLogout: () => void;
}

type View = 'main' | 'base' | 'tonearm';

const PRESET_COLORS_LOWER = new Set(MATERIAL_PRESETS.map(p => p.color.toLowerCase()));

const GearIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
  </svg>
);

const ColorCustomizer: React.FC<ColorCustomizerProps> = ({
  baseColor,
  tonearmColor,
  baseMaterial,
  tonearmMaterial,
  baseFavorites,
  tonearmFavorites,
  lyricsEnabled,
  lyricsPosition,
  artBaseEnabled,
  artBaseGradient,
  onSetBaseColor,
  onSetTonearmColor,
  onApplyMaterialPreset,
  onAddFavorite,
  onSetLyricsEnabled,
  onSetLyricsPosition,
  onSetArtBaseEnabled,
  onLogout,
}) => {
  const [panelOpen, setPanelOpen] = useState(false);
  const [view, setView] = useState<View>('main');
  const [hexInput, setHexInput] = useState('');
  const [hsv, setHsv] = useState<Hsv>({ h: 0, s: 0, v: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const isPickerView = view === 'base' || view === 'tonearm';
  const pickerTarget: 'base' | 'tonearm' = view === 'tonearm' ? 'tonearm' : 'base';
  const currentColor = pickerTarget === 'base' ? baseColor : tonearmColor;
  const setCurrentColor = pickerTarget === 'base' ? onSetBaseColor : onSetTonearmColor;
  const activeMaterial = pickerTarget === 'base' ? baseMaterial : tonearmMaterial;
  const activeFavorites = pickerTarget === 'base' ? baseFavorites : tonearmFavorites;

  // Initialize HSV + hex from current color whenever a picker view opens.
  useEffect(() => {
    if (!isPickerView) return;
    const color = pickerTarget === 'base' ? baseColor : tonearmColor;
    setHsv(hexToHsv(color));
    setHexInput(color);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Auto-save current picker color to favorites (if non-preset and new).
  const saveCurrentAsFavorite = useCallback(() => {
    if (!isPickerView) return;
    const color = (pickerTarget === 'base' ? baseColor : tonearmColor).toLowerCase();
    const list = pickerTarget === 'base' ? baseFavorites : tonearmFavorites;
    const isPreset = PRESET_COLORS_LOWER.has(color);
    const isInFavorites = list.some(c => c.toLowerCase() === color);
    if (!isPreset && !isInFavorites && /^#[0-9a-f]{6}$/.test(color)) {
      onAddFavorite(pickerTarget, color);
    }
  }, [isPickerView, pickerTarget, baseColor, tonearmColor, baseFavorites, tonearmFavorites, onAddFavorite]);

  const goBack = useCallback(() => {
    saveCurrentAsFavorite();
    setView('main');
  }, [saveCurrentAsFavorite]);

  const closePanel = useCallback(() => {
    saveCurrentAsFavorite();
    setPanelOpen(false);
    setView('main');
  }, [saveCurrentAsFavorite]);

  // Close on outside click
  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closePanel();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [panelOpen, closePanel]);

  const emitFromHsv = (next: Hsv) => {
    setHsv(next);
    const hex = hsvToHex(next);
    setHexInput(hex);
    setCurrentColor(hex);
  };

  const handleHueChange = (val: number) => emitFromHsv({ ...hsv, h: val });
  const handleSatChange = (val: number) => emitFromHsv({ ...hsv, s: val });
  const handleValChange = (val: number) => emitFromHsv({ ...hsv, v: val });

  const handleHexInput = (val: string) => {
    setHexInput(val);
    if (/^#[0-9a-f]{6}$/i.test(val)) {
      const next = hexToHsv(val);
      setHsv(next);
      setCurrentColor(val.toLowerCase());
    }
  };

  const handlePresetClick = (presetId: NonNullable<MaterialPreset>) => {
    onApplyMaterialPreset(pickerTarget, presetId);
    const preset = MATERIAL_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setHsv(hexToHsv(preset.color));
      setHexInput(preset.color);
    }
  };

  const handleFavoriteClick = (color: string) => {
    setCurrentColor(color);
    setHsv(hexToHsv(color));
    setHexInput(color);
  };

  const toggleGear = () => {
    if (panelOpen) {
      closePanel();
    } else {
      setView('main');
      setPanelOpen(true);
    }
  };

  // Dynamic gradient backgrounds for the sliders.
  const satGradient = `linear-gradient(to right, ${hsvToHex({ h: hsv.h, s: 0, v: hsv.v })}, ${hsvToHex({ h: hsv.h, s: 100, v: hsv.v })})`;
  const valGradient = `linear-gradient(to right, #000000, ${hsvToHex({ h: hsv.h, s: hsv.s, v: 100 })})`;

  return (
    <div className="color-customizer" ref={containerRef}>
      {panelOpen && (
        <div className="settings-panel">
          {view === 'main' && (
            <>
              <p className="settings-title">Settings</p>

              <button
                type="button"
                className="settings-row"
                onClick={() => setView('base')}
              >
                <span
                  className="settings-row-icon color-btn"
                  style={artBaseEnabled
                    ? { background: artBaseGradient }
                    : ({ '--btn-color': baseColor } as React.CSSProperties)}
                  aria-hidden="true"
                />
                <span className="settings-row-label">Base</span>
                <span className="settings-row-chevron" aria-hidden="true">›</span>
              </button>

              <button
                type="button"
                className="settings-row"
                onClick={() => setView('tonearm')}
              >
                <span
                  className="settings-row-icon color-btn"
                  style={{ '--btn-color': tonearmColor } as React.CSSProperties}
                  aria-hidden="true"
                />
                <span className="settings-row-label">Arm</span>
                <span className="settings-row-chevron" aria-hidden="true">›</span>
              </button>

              <button
                type="button"
                className="settings-row"
                onClick={() => onSetLyricsEnabled(!lyricsEnabled)}
                role="switch"
                aria-checked={lyricsEnabled}
              >
                <span
                  className={`lyr-radio${lyricsEnabled ? ' active' : ''}`}
                  aria-hidden="true"
                />
                <span className="settings-row-label">Lyrics</span>
              </button>

              <button
                type="button"
                className="settings-row"
                onClick={() => onSetLyricsPosition(lyricsPosition === 'right' ? 'flank' : 'right')}
                role="switch"
                aria-checked={lyricsPosition === 'right'}
              >
                <span
                  className={`lyr-radio${lyricsPosition === 'right' ? ' active' : ''}`}
                  aria-hidden="true"
                />
                <span className="settings-row-label">Set Lyrics Position to Right Side</span>
              </button>

              <button
                type="button"
                className="settings-logout-btn"
                onClick={onLogout}
              >
                Logout
              </button>
            </>
          )}

          {isPickerView && (
            <>
              <div className="settings-picker-header">
                <button
                  type="button"
                  className="settings-back-btn"
                  onClick={goBack}
                  aria-label="Back"
                >
                  ‹
                </button>
                <p className="color-popover-label">
                  {view === 'base' ? 'Player Base' : 'Tonearm'}
                </p>
              </div>

              {/* Favorites row */}
              {activeFavorites.length > 0 && (
                <div className="favorites-row" aria-label="Saved colors">
                  {activeFavorites.map(color => (
                    <button
                      key={color}
                      type="button"
                      className={`favorite-swatch${color.toLowerCase() === currentColor.toLowerCase() ? ' active' : ''}`}
                      style={{ background: color }}
                      onClick={() => handleFavoriteClick(color)}
                      aria-label={`Use color ${color}`}
                      title={color}
                    />
                  ))}
                </div>
              )}

              {/* Material preset tiles (Album Art prepended for Base only) */}
              <div className="material-presets-row">
                {view === 'base' && (
                  <button
                    type="button"
                    className={`material-preset-btn art-preset${artBaseEnabled ? ' active' : ''}`}
                    onClick={() => onSetArtBaseEnabled(!artBaseEnabled)}
                    title="Album art gradient"
                  >
                    <span
                      className="material-preset-swatch art-preset-swatch"
                      style={{ background: artBaseGradient }}
                    />
                    <span className="material-preset-label">Album Art</span>
                  </button>
                )}
                {MATERIAL_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`material-preset-btn${activeMaterial === preset.id ? ' active' : ''}`}
                    onClick={() => handlePresetClick(preset.id)}
                    title={preset.label}
                  >
                    <span
                      className="material-preset-swatch"
                      style={{ background: preset.gradient }}
                    />
                    <span className="material-preset-label">{preset.label}</span>
                  </button>
                ))}
              </div>

              <div className="color-popover-divider" />

              {/* HSV sliders */}
              <div className="hsv-sliders">
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={1}
                  value={Math.round(hsv.h)}
                  onChange={e => handleHueChange(Number(e.target.value))}
                  className="hsv-slider hsv-slider-hue"
                  aria-label="Hue"
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(hsv.s)}
                  onChange={e => handleSatChange(Number(e.target.value))}
                  className="hsv-slider"
                  style={{ background: satGradient }}
                  aria-label="Saturation"
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(hsv.v)}
                  onChange={e => handleValChange(Number(e.target.value))}
                  className="hsv-slider"
                  style={{ background: valGradient }}
                  aria-label="Value"
                />
              </div>

              <div className="color-hex-row">
                <span className="color-hex-swatch" style={{ background: currentColor }} />
                <input
                  type="text"
                  value={hexInput}
                  onChange={e => handleHexInput(e.target.value)}
                  className="color-hex-input"
                  maxLength={7}
                  spellCheck={false}
                  placeholder="#000000"
                />
              </div>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        className={`gear-button${panelOpen ? ' active' : ''}`}
        onClick={toggleGear}
        aria-label="Settings"
        aria-expanded={panelOpen}
        title="Settings"
      >
        <GearIcon />
      </button>
    </div>
  );
};

export default ColorCustomizer;
