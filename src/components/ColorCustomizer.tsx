import React, { useState, useRef, useEffect } from 'react';
import { MATERIAL_PRESETS } from '../hooks/usePlayerColors';
import type { MaterialPreset } from '../hooks/usePlayerColors';

interface ColorCustomizerProps {
  baseColor: string;
  tonearmColor: string;
  baseMaterial: MaterialPreset;
  tonearmMaterial: MaterialPreset;
  onSetBaseColor: (color: string) => void;
  onSetTonearmColor: (color: string) => void;
  onApplyMaterialPreset: (target: 'base' | 'tonearm', preset: NonNullable<MaterialPreset>) => void;
}

type ActivePicker = 'base' | 'tonearm' | null;

const ColorCustomizer: React.FC<ColorCustomizerProps> = ({
  baseColor,
  tonearmColor,
  baseMaterial,
  tonearmMaterial,
  onSetBaseColor,
  onSetTonearmColor,
  onApplyMaterialPreset,
}) => {
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);
  const [hexInput, setHexInput] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync hex input when picker or colors change
  useEffect(() => {
    setHexInput(activePicker === 'base' ? baseColor : tonearmColor);
  }, [activePicker, baseColor, tonearmColor]);

  // Close on outside click
  useEffect(() => {
    if (!activePicker) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActivePicker(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activePicker]);

  const currentColor = activePicker === 'base' ? baseColor : tonearmColor;
  const setCurrentColor = activePicker === 'base' ? onSetBaseColor : onSetTonearmColor;
  const activeMaterial = activePicker === 'base' ? baseMaterial : tonearmMaterial;

  const handleColorWheelChange = (val: string) => {
    setHexInput(val);
    setCurrentColor(val);
  };

  const handleHexInput = (val: string) => {
    setHexInput(val);
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      setCurrentColor(val);
    }
  };

  const togglePicker = (picker: NonNullable<ActivePicker>) => {
    setActivePicker(prev => (prev === picker ? null : picker));
  };

  return (
    <div className="color-customizer" ref={containerRef}>
      {activePicker && (
        <div className="color-popover">
          <p className="color-popover-label">
            {activePicker === 'base' ? 'Player Base' : 'Tonearm'}
          </p>

          {/* Material preset tiles */}
          <div className="material-presets-row">
            {MATERIAL_PRESETS.map(preset => (
              <button
                key={preset.id}
                className={`material-preset-btn${activeMaterial === preset.id ? ' active' : ''}`}
                onClick={() => onApplyMaterialPreset(activePicker, preset.id)}
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

          {/* Custom color picker */}
          <div className="custom-color-section">
            <div className="color-input-row">
              <input
                type="color"
                value={currentColor}
                onChange={e => handleColorWheelChange(e.target.value)}
                className="color-wheel-input"
                title="Pick a color"
              />
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
            <span className="material-preset-label">Custom</span>
          </div>
        </div>
      )}

      {/* Trigger buttons */}
      <div className="color-btns-row">
        <div className="color-btn-group">
          <button
            className={`color-btn${activePicker === 'base' ? ' active' : ''}`}
            onClick={() => togglePicker('base')}
            style={{ '--btn-color': baseColor } as React.CSSProperties}
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
      </div>
    </div>
  );
};

export default ColorCustomizer;
