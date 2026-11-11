// Depth classes follow the ones the Central Ground Water Board (CGWB) uses on its depth-to-water maps.
// The names ("Good", "Stressed", ...) are our own plain-language labels for this prototype.

export interface Band {
  min: number;
  max: number;
  range: string;
  name: string;
  hint: string;
  /** Strong colour for the map and legend. */
  color: string;
  /** Soft background + text colour for chips. */
  soft: string;
  text: string;
}

export const BANDS: Band[] = [
  { min: 0, max: 2, range: "0–2 m", name: "Very shallow", hint: "Water close to surface. Risk of waterlogging.", color: "#1e40af", soft: "#dbe4ff", text: "#1e3a8a" },
  { min: 2, max: 5, range: "2–5 m", name: "Good", hint: "Healthy level.", color: "#3b82f6", soft: "#dbeafe", text: "#1d4ed8" },
  { min: 5, max: 10, range: "5–10 m", name: "Moderate", hint: "Fine, but watch the trend.", color: "#22c55e", soft: "#dcfce7", text: "#15803d" },
  { min: 10, max: 20, range: "10–20 m", name: "Stressed", hint: "Wells start to go dry in summer.", color: "#facc15", soft: "#fef9c3", text: "#854d0e" },
  { min: 20, max: 40, range: "20–40 m", name: "Critical", hint: "Deep water. Recharge needed.", color: "#f97316", soft: "#ffedd5", text: "#c2410c" },
  { min: 40, max: Infinity, range: "> 40 m", name: "Severe", hint: "Very deep. Urgent action.", color: "#b91c1c", soft: "#fee2e2", text: "#b91c1c" },
];

export const CRITICAL_DEPTH = 20;

export function bandIndex(level: number): number {
  for (let i = 0; i < BANDS.length; i++) if (level < BANDS[i].max) return i;
  return BANDS.length - 1;
}

export function bandFor(level: number): Band {
  return BANDS[bandIndex(level)];
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Colour stops for the smooth heatmap: one stop in the middle of each band.
const SMOOTH_STOPS: [number, string][] = [
  [0.8, "#1e40af"],
  [3.5, "#3b82f6"],
  [7.5, "#22c55e"],
  [15, "#facc15"],
  [30, "#f97316"],
  [46, "#b91c1c"],
];

/** Max depth (m) covered by the colour lookup tables. Deeper values use the last colour. */
export const LUT_MAX = 50;
export const LUT_STEPS = 500;

function buildLut(smooth: boolean): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(LUT_STEPS * 3);
  const stops = SMOOTH_STOPS.map(([d, c]) => [d, hexToRgb(c)] as const);
  for (let i = 0; i < LUT_STEPS; i++) {
    const d = (i / (LUT_STEPS - 1)) * LUT_MAX;
    let rgb: readonly number[];
    if (!smooth) {
      rgb = hexToRgb(bandFor(d).color);
    } else if (d <= stops[0][0]) {
      rgb = stops[0][1];
    } else if (d >= stops[stops.length - 1][0]) {
      rgb = stops[stops.length - 1][1];
    } else {
      let k = 0;
      while (d > stops[k + 1][0]) k++;
      const [d0, c0] = stops[k];
      const [d1, c1] = stops[k + 1];
      const t = (d - d0) / (d1 - d0);
      rgb = [0, 1, 2].map((j) => c0[j] + (c1[j] - c0[j]) * t);
    }
    lut[i * 3] = rgb[0];
    lut[i * 3 + 1] = rgb[1];
    lut[i * 3 + 2] = rgb[2];
  }
  return lut;
}

export const LUT_SMOOTH = buildLut(true);
export const LUT_BANDS = buildLut(false);

/** CSS gradient for the smooth legend bar (0 → LUT_MAX m). */
export const SMOOTH_GRADIENT = `linear-gradient(to right, ${SMOOTH_STOPS.map(([d, c]) => `${c} ${((d / LUT_MAX) * 100).toFixed(1)}%`).join(", ")})`;
