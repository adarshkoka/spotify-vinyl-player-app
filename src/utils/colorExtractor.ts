export interface ExtractedColors {
  primary: string;
  secondary: string;
  accent: string;
  dark: string;
  vibrantAccent: string;
  /** Busier, less-darkened gradient derived from the same clusters — used for the player base. */
  busyGradient: string;
  /** Dominant cluster color, darkened for use as the solid baseColor when ART is on. */
  busyDominant: string;
  /** Diverse, brightened-for-legibility palette (1–5 colors) used for Colorful Lyrics. */
  lyricColors: string[];
}

const DEFAULT_BUSY_GRADIENT = 'linear-gradient(135deg, #2e2e2e 0%, #222 35%, #1a1a1a 70%, #151515 100%)';

const DEFAULT_COLORS: ExtractedColors = {
  primary: '#1a1a2e',
  secondary: '#16213e',
  accent: '#0f3460',
  dark: '#0a0a1a',
  vibrantAccent: '#1DB954',
  busyGradient: DEFAULT_BUSY_GRADIENT,
  busyDominant: '#222222',
  lyricColors: ['#7ec8ff', '#ff9ecb', '#9affc4', '#ffd76e', '#c9a8ff'],
};

/**
 * Extracts diverse dominant colors from an image by k-means-style clustering.
 * Returns 4 colors (dark, primary, secondary, accent) for rich gradients.
 */
export function extractColors(imageUrl: string): Promise<ExtractedColors> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 64;
      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        resolve(DEFAULT_COLORS);
        return;
      }

      ctx.drawImage(img, 0, 0, size, size);
      const imageData = ctx.getImageData(0, 0, size, size).data;

      // Collect all opaque pixels
      const pixels: [number, number, number][] = [];
      for (let i = 0; i < imageData.length; i += 4) {
        if (imageData[i + 3] < 128) continue;
        pixels.push([imageData[i], imageData[i + 1], imageData[i + 2]]);
      }

      if (pixels.length < 10) {
        resolve(DEFAULT_COLORS);
        return;
      }

      // Simple k-means with 5 clusters to find diverse colors
      const clusters = kMeans(pixels, 5, 10);

      // Sort clusters by population (largest first), then pick diverse ones
      clusters.sort((a, b) => b.count - a.count);

      // Get the top colors, ensuring diversity by filtering near-duplicates
      const diverse = selectDiverse(clusters.map(c => c.center), 4);

      // Sort by brightness: darkest first
      diverse.sort((a, b) => brightness(a) - brightness(b));

      // Brightest undarkened color — used for foreground accents
      const brightestRaw = diverse[diverse.length - 1];

      // Darken all colors to be suitable as backgrounds
      const colors = diverse.map(c => darken(c, 0.35));

      // Build the "busy" base gradient using all kMeans clusters by population.
      // Less darkening (0.6 vs 0.35) keeps it vivid against the dark background,
      // and a different angle (135 vs 160) and more stops add visual distinction.
      const busyRaw = clusters.map(c => c.center);
      const busyDarkened = busyRaw.map(c => darken(c, 0.6));
      const busyStops = busyDarkened.length >= 5
        ? [0, 22, 48, 74, 100]
        : busyDarkened.length === 4
          ? [0, 30, 65, 100]
          : busyDarkened.length === 3
            ? [0, 50, 100]
            : busyDarkened.length === 2
              ? [0, 100]
              : [0];
      const busyGradient = `linear-gradient(135deg, ${busyDarkened
        .map((c, i) => `${toRgb(c)} ${busyStops[i]}%`)
        .join(', ')})`;
      const busyDominant = toRgb(busyDarkened[0] ?? [34, 34, 34]);

      // Colorful-lyrics palette, built from the same clusters as the gradient.
      const colorfulRaw = busyRaw.filter(c => saturation(c) >= 0.2);
      let lyricColors: string[];
      if (colorfulRaw.length) {
        // Colorful album — vivid, deduped palette, brightened so the hues pop
        // and stay legible on the dark overlay.
        lyricColors = selectDiverse(colorfulRaw, 5).map(c => toRgb(brighten(c, 150)));
      } else {
        // Grayscale album — monochrome lyrics. Default to black to match the
        // mostly-dark art, but if the whole cover is essentially black (even its
        // lightest tone is near-black), the app background is black too, so use
        // white instead — otherwise black-on-black lyrics would be invisible.
        const maxBrightness = Math.max(...busyRaw.map(brightness));
        const allBlack = maxBrightness < 70;
        lyricColors = [allBlack ? '#ffffff' : '#000000'];
      }

      resolve({
        dark: toRgb(colors[0]),
        primary: toRgb(colors[1] || colors[0]),
        secondary: toRgb(colors[2] || colors[1] || colors[0]),
        accent: toRgb(colors[3] || colors[2] || colors[1] || colors[0]),
        vibrantAccent: toRgb(brightestRaw || colors[3] || colors[0]),
        busyGradient,
        busyDominant,
        lyricColors: lyricColors.length ? lyricColors : DEFAULT_COLORS.lyricColors,
      });
    };

    img.onerror = () => resolve(DEFAULT_COLORS);
    img.src = imageUrl;
  });
}

interface Cluster {
  center: [number, number, number];
  count: number;
}

function kMeans(
  pixels: [number, number, number][],
  k: number,
  iterations: number
): Cluster[] {
  // Initialize centers by sampling evenly spaced pixels
  const step = Math.max(1, Math.floor(pixels.length / k));
  let centers: [number, number, number][] = [];
  for (let i = 0; i < k; i++) {
    centers.push([...pixels[Math.min(i * step, pixels.length - 1)]]);
  }

  let assignments = new Array(pixels.length).fill(0);

  for (let iter = 0; iter < iterations; iter++) {
    // Assign pixels to nearest center
    for (let i = 0; i < pixels.length; i++) {
      let minDist = Infinity;
      let bestCluster = 0;
      for (let c = 0; c < centers.length; c++) {
        const d = colorDist(pixels[i], centers[c]);
        if (d < minDist) {
          minDist = d;
          bestCluster = c;
        }
      }
      assignments[i] = bestCluster;
    }

    // Recalculate centers
    const sums: [number, number, number][] = Array.from({ length: k }, () => [0, 0, 0]);
    const counts = new Array(k).fill(0);

    for (let i = 0; i < pixels.length; i++) {
      const c = assignments[i];
      sums[c][0] += pixels[i][0];
      sums[c][1] += pixels[i][1];
      sums[c][2] += pixels[i][2];
      counts[c]++;
    }

    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) {
        centers[c] = [
          Math.round(sums[c][0] / counts[c]),
          Math.round(sums[c][1] / counts[c]),
          Math.round(sums[c][2] / counts[c]),
        ];
      }
    }
  }

  // Build final clusters
  const counts = new Array(k).fill(0);
  for (let i = 0; i < assignments.length; i++) {
    counts[assignments[i]]++;
  }

  return centers.map((center, i) => ({ center, count: counts[i] }));
}

function selectDiverse(
  colors: [number, number, number][],
  count: number
): [number, number, number][] {
  if (colors.length <= count) return colors;

  const result: [number, number, number][] = [colors[0]]; // Start with most popular

  while (result.length < count) {
    let bestColor: [number, number, number] | null = null;
    let bestMinDist = -1;

    for (const color of colors) {
      // Skip if already selected
      if (result.some(r => colorDist(r, color) < 30)) continue;

      // Find min distance to any already-selected color
      const minDist = Math.min(...result.map(r => colorDist(r, color)));
      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        bestColor = color;
      }
    }

    if (bestColor) {
      result.push(bestColor);
    } else {
      break;
    }
  }

  return result;
}

function colorDist(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function brightness([r, g, b]: [number, number, number]): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function darken([r, g, b]: [number, number, number], factor: number): [number, number, number] {
  return [Math.round(r * factor), Math.round(g * factor), Math.round(b * factor)];
}

/**
 * Scale a color up toward a minimum perceived brightness so it stays legible on
 * a dark background, preserving hue. Colors already brighter than the floor are
 * returned unchanged. Channels are clamped to 255.
 */
function brighten(color: [number, number, number], minBrightness: number): [number, number, number] {
  const b = brightness(color);
  if (b >= minBrightness || b === 0) return color;
  const factor = minBrightness / b;
  return [
    Math.min(255, Math.round(color[0] * factor)),
    Math.min(255, Math.round(color[1] * factor)),
    Math.min(255, Math.round(color[2] * factor)),
  ];
}

function toRgb([r, g, b]: [number, number, number]): string {
  return `rgb(${r}, ${g}, ${b})`;
}

/** Parse any CSS color string (#hex, rgb(...)) into [r, g, b] or null. */
function parseColor(color: string): [number, number, number] | null {
  const hex = color.trim();
  if (hex.startsWith('#')) {
    const full = hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;
    const r = parseInt(full.slice(1, 3), 16);
    const g = parseInt(full.slice(3, 5), 16);
    const b = parseInt(full.slice(5, 7), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return [r, g, b];
  }
  const m = hex.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (m) return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
  return null;
}

const SPOTIFY_GREEN = '#1DB954';

/** Returns the saturation (0-1) of an RGB color to detect grays. */
function saturation([r, g, b]: [number, number, number]): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

/**
 * Returns true if a color is unsuitable as a highlight on a dark background.
 * Filters: near-blacks, very dark colors, and desaturated grays/silvers.
 */
function isProblematic(parsed: [number, number, number]): boolean {
  const b = brightness(parsed);
  const s = saturation(parsed);
  // Very dark — unreadable on the dark panel
  if (b < 50) return true;
  // Medium brightness but no color — gray/silver look disabled
  if (b < 140 && s < 0.2) return true;
  return false;
}

/**
 * Pick the best highlight color for the tracklist panel from a priority list.
 * Priority: vibrantAccent (from album art) → baseColor → tonearmColor → Spotify green
 */
export function pickTracklistAccentColor(
  baseColor: string,
  tonearmColor: string,
  vibrantAccent: string,
): string {
  const candidates = [vibrantAccent, baseColor, tonearmColor];

  for (const c of candidates) {
    const parsed = parseColor(c);
    if (parsed && !isProblematic(parsed)) {
      return c;
    }
  }

  return SPOTIFY_GREEN;
}

export { DEFAULT_COLORS };
