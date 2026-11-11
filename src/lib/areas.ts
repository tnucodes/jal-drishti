// Loads buildings + open spaces for an area:
// 1. pre-saved file shipped with the app (works offline), else
// 2. copy saved earlier in this browser, else
// 3. live from OpenStreetMap (then saved in this browser).

import { AREA_RADIUS_M, fetchAreaFeatures, fromCompact, toCompact, type AreaFeature, type CompactFeature } from "./osm";

interface AreaFile {
  stationId: string;
  radius: number;
  fetchedAt: string;
  features: CompactFeature[];
}

const bundled = import.meta.glob<AreaFile>("../data/areas/*.json", { import: "default" });

export interface AreaData {
  features: AreaFeature[];
  radius: number;
  source: "bundled" | "browser" | "live";
  fetchedAt: string;
}

const memory = new Map<string, AreaData>();
const cacheKey = (stationId: string, lat: number, lng: number) => `jaldrishti:area:${stationId}:${lat.toFixed(4)},${lng.toFixed(4)}`;

export function hasBundledArea(stationId: string): boolean {
  return `../data/areas/${stationId}.json` in bundled;
}

export async function loadArea(stationId: string, lat: number, lng: number, signal?: AbortSignal): Promise<AreaData> {
  const mem = memory.get(stationId);
  if (mem) return mem;

  const loader = bundled[`../data/areas/${stationId}.json`];
  if (loader) {
    const file = await loader();
    const data: AreaData = { features: file.features.map(fromCompact), radius: file.radius, source: "bundled", fetchedAt: file.fetchedAt };
    memory.set(stationId, data);
    return data;
  }

  const key = cacheKey(stationId, lat, lng);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const file = JSON.parse(raw) as AreaFile;
      const data: AreaData = { features: file.features.map(fromCompact), radius: file.radius, source: "browser", fetchedAt: file.fetchedAt };
      memory.set(stationId, data);
      return data;
    }
  } catch {
    // ignore broken cache
  }

  const features = await fetchAreaFeatures(lat, lng, AREA_RADIUS_M, signal);
  const fetchedAt = new Date().toISOString().slice(0, 10);
  const data: AreaData = { features, radius: AREA_RADIUS_M, source: "live", fetchedAt };
  memory.set(stationId, data);
  try {
    const file: AreaFile = { stationId, radius: AREA_RADIUS_M, fetchedAt, features: features.map(toCompact) };
    localStorage.setItem(key, JSON.stringify(file));
  } catch {
    // Browser storage full: keep it in memory only.
  }
  return data;
}
