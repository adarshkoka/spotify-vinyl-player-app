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
  artBaseEnabled: boolean;
  artBaseGradient: string;
  onSetBaseColor: (color: string) => void;
  onSetTonearmColor: (color: string) => void;
  onApplyMaterialPreset: (target: 'base' | 'tonearm', preset: NonNullable<MaterialPreset>) => void;
  onAddFavorite: (target: 'base' | 'tonearm', color: string) => void;
  onSetLyricsEnabled: (enabled: boolean) => void;
  onSetArtBaseEnabled: (enabled: boolean) => void;
}

type ActivePicker = 'base' | 'tonearm' | null;

const PRESET_COLORS_LOWER = new Set(MATERIAL_PRESETS.map(p => p.color.toLowerCase()));

const ColorCustomizer: React.FC<ColorCustomizerProps> = ({
  baseColor,
  tonearmColor,
  baseMaterial,
  tonearmMaterial,
  baseFavorites,
  tonearmFavorites,
  lyricsEnabled,
  artBaseEnabled,
  artBaseGradient,
  onSetBaseColor,
  onSetTonearmColor,
  onApplyMaterialPreset,
  onAddFavorite,
  onSetLyricsEnabled,
  onSetArtBaseEnabled,
}) => {
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);
  const [hexInput, setHexInput] = useState('');
  const [hsv, setHsv] = useState<Hsv>({ h: 0, s: 0, v: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const currentColor = activePicker === 'base' ? baseColor : tonearmColor;
  const setCurrentColor = activePicker === 'base' ? onSetBaseColor : onSetTonearmColor;
  const activeMaterial = activePicker === 'base' ? baseMaterial : tonearmMaterial;
  const activeFavorites = activePicker === 'base' ? baseFavorites : tonearmFavorites;

  // Initialize HSV + hex from current color whenever the picker opens or switches target.
  useEffect(() => {
    if (!activePicker) return;
    const color = activePicker === 'base' ? baseColor : tonearmColor;
    setHsv(hexToHsv(color));
    setHexInput(color);
    // intentionally omitting baseColor/tonearmColor — they update during slider drags
    // and we don't want to override the local HSV mid-drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePicker]);

  const closeWithSave = useCallback(() => {
    if (activePicker) {
      const target = activePicker;
      const color = (target === 'base' ? baseColor : tonearmColor).toLowerCase();
      const list = target === 'base' ? baseFavorites : tonearmFavorites;
      const isPreset = PRESET_COLORS_LOWER.has(color);
      const isInFavorites = list.some(c => c.toLowerCase() === color);
      if (!isPreset && !isInFavorites && /^#[0-9a-f]{6}$/.test(color)) {
        onAddFavorite(target, color);
      }
    }
    setActivePicker(null);
  }, [activePicker, baseColor, tonearmColor, baseFavorites, tonearmFavorites, onAddFavorite]);

  // Close on outside click
  useEffect(() => {
    if (!activePicker) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeWithSave();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activePicker, closeWithSave]);

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
    if (!activePicker) return;
    onApplyMaterialPreset(activePicker, presetId);
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

  const togglePicker = (picker: NonNullable<ActivePicker>) => {
    if (activePicker === picker) {
      closeWithSave();
    } else {
      setActivePicker(picker);
    }
  };

  // Dynamic gradient backgrounds for the sliders.
  const satGradient = `linear-gradient(to right, ${hsvToHex({ h: hsv.h, s: 0, v: hsv.v })}, ${hsvToHex({ h: hsv.h, s: 100, v: hsv.v })})`;
  const valGradient = `linear-gradient(to right, #000000, ${hsvToHex({ h: hsv.h, s: hsv.s, v: 100 })})`;

  return (
    <div className="color-customizer" ref={containerRef}>
      {activePicker && (
        <div className="color-popover">
          <p className="color-popover-label">
            {activePicker === 'base' ? 'Player Base' : 'Tonearm'}
          </p>

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

          {/* Material preset tiles */}
          <div className="material-presets-row">
            {MATERIAL_PRESETS.map(preset => (
              <button
                key={preset.id}
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
        </div>
      )}

      {/* Trigger buttons */}
      <div className="color-btns-row">
        <div className="color-btn-group">
          <button
            className={`color-btn${activePicker === 'base' ? ' active' : ''}${artBaseEnabled ? ' art-base-active' : ''}`}
            onClick={() => togglePicker('base')}
            style={artBaseEnabled
              ? { background: artBaseGradient }
              : ({ '--btn-color': baseColor } as React.CSSProperties)}
            aria-label="Customize base color"
            title="Base color"
          />
          <span className="color-btn-label">Base</span>
        </div>
        <div className="color-btn-group">
          <button
            className={`color-btn${activePicker === 'tonearm' ? ' active' : ''}`}
            onClick={() => togglePicker('tonearm')}
            style={{ '--btn-color': tonearmColor } as React.CSSProperties}
            aria-label="Customize tonearm color"
            title="Tonearm color"
          />
          <span className="color-btn-label">Arm</span>
        </div>
        <div className="color-btn-group">
          <button
            className={`color-btn lyr-btn${lyricsEnabled ? ' active' : ''}`}
            onClick={() => onSetLyricsEnabled(!lyricsEnabled)}
            aria-label="Toggle lyrics"
            aria-pressed={lyricsEnabled}
            title="Toggle lyrics"
          />
          <span className="color-btn-label">Lyr</span>
        </div>
        <div className="color-btn-group">
          <button
            className={`color-btn art-btn${artBaseEnabled ? ' active' : ''}`}
            onClick={() => onSetArtBaseEnabled(!artBaseEnabled)}
            style={artBaseEnabled ? { background: artBaseGradient } : undefined}
            aria-label="Toggle album-art base"
            aria-pressed={artBaseEnabled}
            title="Set base to album art gradient"
          />
          <span className="color-btn-label">Art</span>
        </div>
      </div>
    </div>
  );
};

export default ColorCustomizer;
