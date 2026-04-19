import React from 'react';
import type { TransitionStage } from '../types/player';
import type { MaterialPreset } from '../hooks/usePlayerColors';

interface TonearmProps {
  transitionStage: TransitionStage;
  isPlaying: boolean;
  tonearmColor?: string;
  tonearmMaterial?: MaterialPreset;
}

function getTonearmClass(stage: TransitionStage): string {
  if (stage === 'playing') return 'tonearm-playing';
  if (stage === 'paused') return 'tonearm-paused';
  return 'tonearm-resting';
}

function darkenHex(hex: string, amount: number): string {
  const cleaned = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return hex;
  const r = Math.max(0, parseInt(cleaned.slice(0, 2), 16) - amount);
  const g = Math.max(0, parseInt(cleaned.slice(2, 4), 16) - amount);
  const b = Math.max(0, parseInt(cleaned.slice(4, 6), 16) - amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function lightenHex(hex: string, amount: number): string {
  const cleaned = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return hex;
  const r = Math.min(255, parseInt(cleaned.slice(0, 2), 16) + amount);
  const g = Math.min(255, parseInt(cleaned.slice(2, 4), 16) + amount);
  const b = Math.min(255, parseInt(cleaned.slice(4, 6), 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

const Tonearm: React.FC<TonearmProps> = ({
  transitionStage,
  tonearmColor = '#252525',
  tonearmMaterial,
}) => {
  const posClass = getTonearmClass(transitionStage);
  const fill = tonearmColor;
  const fillDark = darkenHex(tonearmColor, 20);
  const fillLight = lightenHex(tonearmColor, 25);

  return (
    <div className={`tonearm-container ${posClass}`}>
      <svg
        width="28"
        height="200"
        viewBox="0 0 28 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <clipPath id="tonearm-body-clip">
            <rect x="10" y="24" width="8" height="138" />
          </clipPath>
          {/* Plastic / glossy sheen gradient — used when no material preset */}
          <linearGradient id="plastic-sheen" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.12" />
            <stop offset="40%" stopColor="#fff" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.08" />
          </linearGradient>
        </defs>

        {/* === Arm body — thin tube from pivot down to headshell === */}
        <rect x="12" y="24" width="4" height="138" rx="2" fill={fill} />

        {/* Sheen / texture on arm body */}
        {!tonearmMaterial && (
          <rect x="12" y="24" width="4" height="138" rx="2" fill="url(#plastic-sheen)" />
        )}

        {/* Counterweight at top */}
        <rect x="10" y="14" width="8" height="13" rx="3" fill={fillDark} />
        {!tonearmMaterial && (
          <rect x="10" y="14" width="4" height="13" rx="3" fill="rgba(255,255,255,0.06)" />
        )}

        {/* === Headshell — small slim trapezoid === */}
        <path
          d={`M9,162 L19,162 L18,168 L10,168 Z`}
          fill={fill}
        />
        {!tonearmMaterial && (
          <path d="M9,162 L14,162 L13.5,168 L10,168 Z" fill="rgba(255,255,255,0.07)" />
        )}

        {/* Cartridge */}
        <rect x="11" y="168" width="6" height="3" rx="1" fill={fillDark} />

        {/* Stylus */}
        <line
          x1="14" y1="171"
          x2="14" y2="179"
          stroke="rgba(180,180,180,0.7)"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <circle cx="14" cy="180" r="1.3" fill="rgba(160,160,160,0.55)" />

        {/* === Pivot base (drawn last = on top) === */}
        <circle cx="14" cy="12" r="10" fill={fill} />
        <circle cx="14" cy="12" r="6.5" fill={fillDark} />
        <circle cx="14" cy="12" r="10" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" fill="none" />
        {/* Pivot screw */}
        <circle cx="14" cy="12" r="2.2" fill="#777" />
        <line x1="12.7" y1="12" x2="15.3" y2="12" stroke="#555" strokeWidth="0.7" />
        <line x1="14" y1="10.7" x2="14" y2="13.3" stroke="#555" strokeWidth="0.7" />
        {/* Pivot plastic sheen */}
        {!tonearmMaterial && (
          <path d="M5,8 A10,10 0 0,1 18,4" stroke="rgba(255,255,255,0.1)" strokeWidth="1.2" fill="none" />
        )}

        {/* === Material-specific texture overlays === */}

        {/* Wood grain */}
        {tonearmMaterial === 'wood' && (
          <g opacity="0.22" clipPath="url(#tonearm-body-clip)">
            {[28, 42, 56, 70, 84, 98, 112, 126, 140, 154].map(y => (
              <line key={y} x1="11" y1={y} x2="17" y2={y + 5} stroke={fillLight} strokeWidth="0.7" />
            ))}
          </g>
        )}

        {/* Brushed metal (aluminum / silver) */}
        {(tonearmMaterial === 'aluminum' || tonearmMaterial === 'silver') && (
          <g opacity="0.14" clipPath="url(#tonearm-body-clip)">
            {[30, 42, 54, 66, 78, 90, 102, 114, 126, 138, 150].map(y => (
              <line key={y} x1="11" y1={y} x2="17" y2={y} stroke="#fff" strokeWidth="0.5" />
            ))}
          </g>
        )}

        {/* Gold highlight */}
        {tonearmMaterial === 'gold' && (
          <g opacity="0.18" clipPath="url(#tonearm-body-clip)">
            <line x1="13" y1="24" x2="13" y2="162" stroke="#fff" strokeWidth="1.2" />
          </g>
        )}
      </svg>
    </div>
  );
};

export default Tonearm;
