// Pre-saves buildings + open spaces around stations, so the "Critical areas" demo works offline
// and has good building coverage.
//
// Sources:
//   1. OpenStreetMap (Overpass API): buildings with type and name, parks, school/industrial grounds.
//   2. Microsoft Global ML Building Footprints: roofs detected from satellite images (ODbL).
//      OSM has few buildings mapped in parts of Vizag, so these fill the gaps.
//      A satellite building is skipped if it overlaps a building that OSM already has.
//
// Output: src/data/areas/<stationId>.json (compact format, see src/lib/osm.ts).
//
// Run: bun run data:buildings          (skips areas already saved)
//      bun run data:buildings --force  (fetch all again)
//      bun run data:buildings --all    (also stations on the "watch" list)

import seed from "../src/data/seed.json";
import { buildViews, groupReadings } from "../src/lib/analysis";
import {
  AREA_RADIUS_M,
  centroidOf,
  classifyByZones,
  MIN_BUILDING_M2,
  OVERPASS_ENDPOINTS,
  overpassQuery,
  parseOverpassRaw,
  pointInRing,
  readOverpassJson,
  ringAreaM2,
  toCompact,
  type AreaFeature,
} from "../src/lib/osm";
import type { Reading, Station } from "../src/lib/types";
import { existsSync, mkdirSync, readFileSync } from "node:fs";

// Microsoft footprints tile (quadkey 123310330) that covers all of Visakhapatnam.
const FOOTPRINTS_URL =
  "https://minedbuildings.z5.web.core.windows.net/global-buildings/2026-02-03/global-buildings.geojsonl/RegionName=India/quadkey=123310330/part-00089-4feead82-d499-422b-94cb-c036c212127a.c000.csv.gz";

const force = process.argv.includes("--force");
const outDir = new URL("../src/data/areas/", import.meta.url);
const cacheDir = new URL("./.cache/", import.meta.url);
mkdirSync(outDir, { recursive: true });
mkdirSync(cacheDir, { recursive: true });

// Stations in the critical list today. Other areas still work: the app loads them live.
// Pass --all to also save "watch" stations (slow: OSM servers are often busy).
const views = buildViews(seed.stations as Station[], groupReadings(seed.readings as Reading[]), { kind: "latest" });
const targets = views
  .filter((v) => v.status === "critical" || v.status === "atrisk" || (process.argv.includes("--all") && v.status === "watch"))
  .sort((a, b) => b.score - a.score);
console.log(`${targets.length} areas: ${targets.map((v) => v.station.id).join(", ")}`);

// ---------- Satellite footprints ----------
const fpFile = new URL("ms-footprints-123310330.csv.gz", cacheDir);
if (!existsSync(fpFile)) {
  console.log("Downloading Microsoft building footprints for Vizag (~12 MB)…");
  const res = await fetch(FOOTPRINTS_URL);
  if (!res.ok) throw new Error(`Footprints download failed: HTTP ${res.status}`);
  await Bun.write(fpFile, await res.arrayBuffer());
}
interface Footprint {
  id: number;
  ring: [number, number][];
  c: [number, number];
  area: number;
}
const footprints: Footprint[] = [];
{
  const text = new TextDecoder().decode(Bun.gunzipSync(readFileSync(fpFile)));
  let i = 0;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    i++;
    const g = JSON.parse(line).geometry;
    if (g?.type !== "Polygon") continue;
    const ring: [number, number][] = (g.coordinates[0] as [number, number][]).map(([lng, lat]) => [lat, lng]);
    ring.pop(); // closing point
    const area = ringAreaM2(ring);
    if (area < MIN_BUILDING_M2) continue;
    footprints.push({ id: -i, ring, c: centroidOf(ring), area });
  }
  console.log(`${footprints.length} satellite footprints loaded`);
}

const metres = (lat1: number, lng1: number, lat2: number, lng2: number) =>
  Math.hypot((lng2 - lng1) * 111320 * Math.cos((lat1 * Math.PI) / 180), (lat2 - lat1) * 110540);

function addSatellite(osm: AreaFeature[], lat: number, lng: number, radius: number): { features: AreaFeature[]; added: number } {
  const osmBuildings = osm.filter((f) => f.kind === "building").map((f) => ({ f, c: centroidOf(f.ring) }));
  let added = 0;
  const out = [...osm];
  for (const fp of footprints) {
    if (Math.abs(fp.c[0] - lat) > 0.007 || Math.abs(fp.c[1] - lng) > 0.007) continue;
    if (metres(lat, lng, fp.c[0], fp.c[1]) > radius) continue;
    const overlaps = osmBuildings.some(
      ({ f, c }) => Math.abs(c[0] - fp.c[0]) < 0.002 && Math.abs(c[1] - fp.c[1]) < 0.002 && (pointInRing(fp.c[0], fp.c[1], f.ring) || pointInRing(c[0], c[1], fp.ring)),
    );
    if (overlaps) continue;
    out.push({ id: fp.id, kind: "building", tag: "yes", ring: fp.ring, area: fp.area });
    added++;
  }
  return { features: out, added };
}

// ---------- OSM ----------
// The main server is not reachable from every network, so try the others first here.
const endpoints = [...OVERPASS_ENDPOINTS].reverse();

async function fetchOsm(lat: number, lng: number): Promise<AreaFeature[] | null> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const url = endpoints[attempt % endpoints.length];
    try {
      const res = await fetch(url, {
        method: "POST",
        body: "data=" + encodeURIComponent(overpassQuery(lat, lng)),
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "jal-drishti-student-project/0.1" },
        signal: AbortSignal.timeout(50_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = readOverpassJson(await res.text());
      // A city area with no OSM data at all is very unlikely; treat it as a failed answer and try again.
      if (!json.elements?.length) throw new Error("empty answer");
      return parseOverpassRaw(json);
    } catch (e) {
      console.log(`    attempt ${attempt + 1} failed (${(e as Error).message}), retrying...`);
      await Bun.sleep(5000);
    }
  }
  return null;
}

async function save(station: Station, osm: AreaFeature[] | null) {
  const { features, added } = addSatellite(osm ?? [], station.lat, station.lng, AREA_RADIUS_M);
  const final = classifyByZones(features);
  await Bun.write(
    new URL(`${station.id}.json`, outDir),
    JSON.stringify({
      stationId: station.id,
      radius: AREA_RADIUS_M,
      fetchedAt: new Date().toISOString().slice(0, 10),
      sources: { osm: final.length - added, satellite: added },
      osmMissing: osm === null || undefined,
      attribution: "© OpenStreetMap contributors (ODbL); Microsoft Global ML Building Footprints (ODbL)",
      features: final.map(toCompact),
    }),
  );
  console.log(`saved ${station.id}: ${final.length - added} OSM + ${added} satellite${osm === null ? " (no OSM yet)" : ""}`);
}

const needsOsm = (id: string) => {
  const file = new URL(`${id}.json`, outDir);
  if (force || !existsSync(file)) return true;
  const old = JSON.parse(readFileSync(file, "utf8"));
  return !old.sources || !!old.osmMissing;
};

// Pass 1 (fast, offline): every area gets at least the satellite roofs.
for (const { station } of targets) {
  if (!existsSync(new URL(`${station.id}.json`, outDir))) await save(station, null);
}

// Pass 2 (slow): add OSM buildings, names, types and parks.
for (const { station } of targets) {
  if (!needsOsm(station.id)) {
    console.log(`skip ${station.id} (already has OSM)`);
    continue;
  }
  const osm = await fetchOsm(station.lat, station.lng);
  if (osm) await save(station, osm);
  else console.log(`FAILED ${station.id}: OSM still missing, run again later`);
  await Bun.sleep(2000);
}
