// Heatmap by IDW (Inverse Distance Weighting).
//
// For every small cell on the map we estimate the water depth from the stations around it:
//     estimate = Σ (value_i / d_i^p) / Σ (1 / d_i^p)
// where d_i is the distance to station i and p = 2. Nearer stations count more.
//
// Cells far from every station are faded out, because the estimate there is mostly a guess.

import { LUT_BANDS, LUT_MAX, LUT_SMOOTH, LUT_STEPS } from "./bands";

export interface HeatPoint {
  lat: number;
  lng: number;
  value: number;
}

export const IDW_POWER = 2;
/** Full colour up to this distance from the nearest station (km). */
export const FADE_START_KM = 1.5;
/** No colour beyond this distance (km). */
export const FADE_END_KM = 3.5;

const KM_PER_DEG_LAT = 110.57;

export interface Estimate {
  value: number;
  nearestKm: number;
  /** 0–1 */
  confidence: number;
  used: number;
}

export function confidenceFor(nearestKm: number): number {
  if (nearestKm <= FADE_START_KM) return 1;
  if (nearestKm >= FADE_END_KM) return 0;
  return 1 - (nearestKm - FADE_START_KM) / (FADE_END_KM - FADE_START_KM);
}

/** Estimate at one place (used when someone taps the map). */
export function estimateAt(points: HeatPoint[], lat: number, lng: number): Estimate | null {
  if (points.length === 0) return null;
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180);
  let num = 0, den = 0, nearest = Infinity;
  for (const p of points) {
    const dx = (lng - p.lng) * kx;
    const dy = (lat - p.lat) * KM_PER_DEG_LAT;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < nearest) nearest = d;
    if (d < 0.02) return { value: p.value, nearestKm: d, confidence: 1, used: 1 };
    const w = 1 / Math.pow(d, IDW_POWER);
    num += w * p.value;
    den += w;
  }
  return { value: num / den, nearestKm: nearest, confidence: confidenceFor(nearest), used: points.length };
}

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const invMercY = (y: number) => ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;

export interface HeatImage {
  url: string;
  /** [[south, west], [north, east]] */
  bounds: [[number, number], [number, number]];
}

export interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export function bboxOf(ring: [number, number][]): BBox {
  let south = 90, north = -90, west = 180, east = -180;
  for (const [lng, lat] of ring) {
    if (lat < south) south = lat;
    if (lat > north) north = lat;
    if (lng < west) west = lng;
    if (lng > east) east = lng;
  }
  return { south, west, north, east };
}

/**
 * Draws the heatmap into a PNG and returns it with its map bounds (for a Leaflet image overlay).
 * Rows are spaced in Web Mercator, the same projection the map uses, so the image lines up exactly.
 * @param boundary city outline as [lng, lat]; the heatmap is cut to this shape.
 */
export function renderHeatImage(points: HeatPoint[], boundary: [number, number][], smooth: boolean, gridWidth = 300): HeatImage | null {
  if (points.length === 0 || typeof document === "undefined") return null;
  const box = bboxOf(boundary);
  const W = gridWidth;
  const yN = mercY(box.north), yS = mercY(box.south);
  const xRange = ((box.east - box.west) * Math.PI) / 180;
  const H = Math.max(1, Math.round((W * (yN - yS)) / xRange));

  const lut = smooth ? LUT_SMOOTH : LUT_BANDS;
  const grid = document.createElement("canvas");
  grid.width = W;
  grid.height = H;
  const gctx = grid.getContext("2d")!;
  const img = gctx.createImageData(W, H);
  const data = img.data;

  const lats = new Float64Array(H);
  for (let y = 0; y < H; y++) lats[y] = invMercY(yN - ((y + 0.5) / H) * (yN - yS));
  const kx = 111.32 * Math.cos((((box.north + box.south) / 2) * Math.PI) / 180);
  const n = points.length;
  const px = new Float64Array(n), py = new Float64Array(n), pv = new Float64Array(n);
  points.forEach((p, i) => {
    px[i] = p.lng * kx;
    py[i] = p.lat * KM_PER_DEG_LAT;
    pv[i] = p.value;
  });

  for (let y = 0; y < H; y++) {
    const cy = lats[y] * KM_PER_DEG_LAT;
    for (let x = 0; x < W; x++) {
      const cx = (box.west + ((x + 0.5) / W) * (box.east - box.west)) * kx;
      let num = 0, den = 0, nearest2 = Infinity, exact = -1;
      for (let i = 0; i < n; i++) {
        const dx = cx - px[i], dy = cy - py[i];
        const d2 = dx * dx + dy * dy;
        if (d2 < nearest2) nearest2 = d2;
        if (d2 < 1e-6) { exact = i; break; }
        const w = 1 / d2; // p = 2, so 1/d^2 needs no square root
        num += w * pv[i];
        den += w;
      }
      const value = exact >= 0 ? pv[exact] : num / den;
      const conf = confidenceFor(Math.sqrt(nearest2));
      const k = Math.min(LUT_STEPS - 1, Math.max(0, Math.round((value / LUT_MAX) * (LUT_STEPS - 1))));
      const o = (y * W + x) * 4;
      data[o] = lut[k * 3];
      data[o + 1] = lut[k * 3 + 1];
      data[o + 2] = lut[k * 3 + 2];
      data[o + 3] = Math.round(255 * conf);
    }
  }
  gctx.putImageData(img, 0, 0);

  // Draw at 2× with smoothing, cut to the city outline (smooth edges).
  const scale = 2;
  const out = document.createElement("canvas");
  out.width = W * scale;
  out.height = H * scale;
  const ctx = out.getContext("2d")!;
  ctx.beginPath();
  boundary.forEach(([lng, lat], i) => {
    const x = ((lng - box.west) / (box.east - box.west)) * out.width;
    const y = ((yN - mercY(lat)) / (yN - yS)) * out.height;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(grid, 0, 0, out.width, out.height);

  return { url: out.toDataURL("image/png"), bounds: [[box.south, box.west], [box.north, box.east]] };
}
