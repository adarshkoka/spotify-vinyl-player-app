import React from 'react';
import type { TransitionStage } from '../types/player';
import type { MaterialPreset } from '../hooks/usePlayerColors';

interface TonearmProps {
  transitionStage: TransitionStage;
  tonearmColor?: string;
  tonearmMaterial?: MaterialPreset;
  isScrubbing?: boolean;
}

function getTonearmClass(stage: TransitionStage): string {
  if (stage === 'playing') return 'tonearm-playing';
  if (stage === 'paused') return 'tonearm-paused';
  return 'tonearm-resting';
}

function adjustHex(hex: string, amount: number): string {
  const cleaned = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return hex;
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp(parseInt(cleaned.slice(0, 2), 16) + amount);
  const g = clamp(parseInt(cleaned.slice(2, 4), 16) + amount);
  const b = clamp(parseInt(cleaned.slice(4, 6), 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/* Per-section flat colours for each material — gives distinct "sections" without
   competing diagonal gradients.  light = body/headshell/pivot-outer,
   dark = counterweight/pivot-inner/cartridge, edge = highlight arc. */
const MATERIAL_PALETTE: Record<string, { light: string; dark: string; edge: string }> = {
  wood:     { light: '#5c3317', dark: '#331808', edge: 'rgba(255,215,160,0.22)' },
  aluminum: { light: '#6d7880', dark: '#3a4248', edge: 'rgba(210,220,230,0.18)' },
  silver:   { light: '#a8b0b8', dark: '#5e666e', edge: 'rgba(245,248,252,0.25)' },
  gold:     { light: '#c99520', dark: '#6e4804', edge: 'rgba(255,235,160,0.3)' },
};

const Tonearm: React.FC<TonearmProps> = ({
  transitionStage,
  tonearmColor = '#252525',
  tonearmMaterial,
  isScrubbing = false,
}) => {
  const posClass = getTonearmClass(transitionStage);

  const palette = tonearmMaterial ? MATERIAL_PALETTE[tonearmMaterial] : null;
  const fill      = palette?.light ?? tonearmColor;
  const fillDark  = palette?.dark  ?? adjustHex(tonearmColor, -20);
  const edgeColor = palette?.edge  ?? 'rgba(255,255,255,0.1)';

  /* Which sheen gradient to use on the arm body tube */
  const sheenId =
    tonearmMaterial === 'wood'     ? 'wood-sheen'
    : tonearmMaterial === 'gold'   ? 'gold-sheen'
    : tonearmMaterial               ? 'metal-sheen'
    :                                 'plastic-sheen';

  return (
    <div className={`tonearm-container ${posClass} ${isScrubbing ? 'tonearm-wobble' : ''}`}>
      <svg
        width="28"
        height="200"
        viewBox="0 0 28 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          {/* Plastic / glossy cylinder sheen */}
          <linearGradient id="plastic-sheen" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#fff" stopOpacity="0.12" />
            <stop offset="40%"  stopColor="#fff" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.08" />
          </linearGradient>
          {/* Wood — warm left-to-right cylinder highlight */}
          <linearGradient id="wood-sheen" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#d4a060" stopOpacity="0.18" />
            <stop offset="45%"  stopColor="#c08040" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#000"    stopOpacity="0.08" />
          </linearGradient>
          {/* Brushed metal — left-to-right highlight bands */}
          <linearGradient id="metal-sheen" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#fff" stopOpacity="0.14" />
            <stop offset="30%"  stopColor="#fff" stopOpacity="0.02" />
            <stop offset="60%"  stopColor="#fff" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.06" />
          </linearGradient>
          {/* Gold — warm left-to-right highlight */}
          <linearGradient id="gold-sheen" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#ffd76e" stopOpacity="0.22" />
            <stop offset="40%"  stopColor="#ffbf30" stopOpacity="0.04" />
            <stop offset="70%"  stopColor="#ffd76e" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#000"    stopOpacity="0.06" />
          </linearGradient>
        </defs>

        {/* === Arm body — thin tube from pivot down to headshell === */}
        <rect x="12" y="24" width="4" height="138" rx="2" fill={fill} />
        {/* Cylinder sheen overlay on body */}
        <rect x="12" y="24" width="4" height="138" rx="2" fill={`url(#${sheenId})`} />

        {/* Counterweight at top */}
        <rect x="10" y="14" width="8" height="13" rx="3" fill={fillDark} />
        {/* Left-edge highlight on counterweight */}
        <rect x="10" y="14" width="3" height="13" rx="3" fill="rgba(255,255,255,0.06)" />

        {/* === Headshell — small slim trapezoid === */}
        <path d="M9,162 L19,162 L18,168 L10,168 Z" fill={fill} />
        {/* Left-edge highlight */}
        <path d="M9,162 L14,162 L13.5,168 L10,168 Z" fill="rgba(255,255,255,0.06)" />

        {/* Cartridge */}
        <rect x="11" y="168" width="6" height="3" rx="1" fill={fillDark} />

        {/* Stylus */}
        <line x1="14" y1="171" x2="14" y2="179" stroke="rgba(180,180,180,0.7)" strokeWidth="1" strokeLinecap="round" />
        <circle cx="14" cy="180" r="1.3" fill="rgba(160,160,160,0.55)" />

        {/* === Pivot base (drawn last = on top) === */}
        <circle cx="14" cy="12" r="10" fill={fill} />
        <circle cx="14" cy="12" r="6.5" fill={fillDark} />
        <circle cx="14" cy="12" r="10" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" fill="none" />
        {/* Pivot screw */}
        <circle cx="14" cy="12" r="2.2" fill="#777" />
        <line x1="12.7" y1="12" x2="15.3" y2="12" stroke="#555" strokeWidth="0.7" />
        <line x1="14" y1="10.7" x2="14" y2="13.3" stroke="#555" strokeWidth="0.7" />
        {/* Light-catch arc on pivot */}
        <path d="M5,8 A10,10 0 0,1 18,4" stroke={edgeColor} strokeWidth="1.2" fill="none" />
      </svg>
    </div>
  );
};

export default Tonearm;
