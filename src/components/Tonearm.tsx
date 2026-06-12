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

function darkenHex(hex: string, factor: number): string {
  const cleaned = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return hex;
  const r = Math.round(parseInt(cleaned.slice(0, 2), 16) * factor);
  const g = Math.round(parseInt(cleaned.slice(2, 4), 16) * factor);
  const b = Math.round(parseInt(cleaned.slice(4, 6), 16) * factor);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/* Per-section flat colours for each material — gives distinct "sections" without
   competing diagonal gradients.  light = body/headshell/pivot-outer,
   dark = counterweight/pivot-inner/cartridge, edge = highlight arc. */
const MATERIAL_PALETTE: Record<string, { light: string; dark: string; edge: string }> = {
  wood:     { light: '#7a2e1a', dark: '#40120c', edge: 'rgba(255,210,160,0.18)' },
  aluminum: { light: '#a8b0b8', dark: '#353c43', edge: 'rgba(210,222,232,0.22)' },
  silver:   { light: '#eef2f6', dark: '#6b737c', edge: 'rgba(255,255,255,0.32)' },
  gold:     { light: '#ffd76e', dark: '#a87010', edge: 'rgba(255,245,200,0.32)' },
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
  const fillDark  = palette?.dark  ?? darkenHex(tonearmColor, 0.4);
  const edgeColor = palette?.edge  ?? 'rgba(255,255,255,0.1)';

  /* Which sheen gradient to use on the arm body tube */
  const sheenId =
    tonearmMaterial === 'wood'       ? 'wood-sheen'
    : tonearmMaterial === 'gold'     ? 'gold-sheen'
    : tonearmMaterial === 'silver'   ? 'silver-sheen'
    : tonearmMaterial === 'aluminum' ? 'aluminum-sheen'
    :                                  'plastic-sheen';

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
            <stop offset="0%"   stopColor="#fff" stopOpacity="0.13" />
            <stop offset="40%"  stopColor="#fff" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.08" />
          </linearGradient>
          {/* Wood — cherry highlight, subtle warm gloss */}
          <linearGradient id="wood-sheen" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#f2b07a" stopOpacity="0.16" />
            <stop offset="38%"  stopColor="#e07a2e" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#000"    stopOpacity="0.07" />
          </linearGradient>
          {/* Brushed aluminum — cool, subdued highlight with mid brushed band */}
          <linearGradient id="aluminum-sheen" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#f0f4f8" stopOpacity="0.14" />
            <stop offset="28%"  stopColor="#cdd3d9" stopOpacity="0.03" />
            <stop offset="60%"  stopColor="#b8c0c8" stopOpacity="0.12" />
            <stop offset="72%"  stopColor="#b8c0c8" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#000"    stopOpacity="0.08" />
          </linearGradient>
          {/* Polished silver — mirror-polish with bright peak and secondary reflection */}
          <linearGradient id="silver-sheen" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.30" />
            <stop offset="38%"  stopColor="#ffffff" stopOpacity="0.02" />
            <stop offset="58%"  stopColor="#ffffff" stopOpacity="0.02" />
            <stop offset="72%"  stopColor="#e8edf2" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#000"    stopOpacity="0.06" />
          </linearGradient>
          {/* Gold — broad, luminous highlight */}
          <linearGradient id="gold-sheen" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#fff8c8" stopOpacity="0.32" />
            <stop offset="32%"  stopColor="#ffe48a" stopOpacity="0.12" />
            <stop offset="60%"  stopColor="#ffd76e" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#a87010" stopOpacity="0.10" />
          </linearGradient>
          {/* Top-edge specular stripe — thin bright catch along the top of the arm tube */}
          <linearGradient id="top-edge-sheen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* === Arm body — thin tube from pivot down to headshell === */}
        <rect x="12" y="24" width="4" height="138" rx="2" fill={fill} />
        {/* Cylinder sheen overlay on body */}
        <rect x="12" y="24" width="4" height="138" rx="2" fill={`url(#${sheenId})`} />
        {/* Top-edge specular stripe — wood + metals only (skip plastic for softer look) */}
        {tonearmMaterial && (
          <rect x="12.3" y="24" width="1" height="138" rx="0.5" fill="url(#top-edge-sheen)" />
        )}

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
