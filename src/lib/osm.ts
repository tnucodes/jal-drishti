// Buildings and open spaces for a recharge plan.
//   - OpenStreetMap (© OpenStreetMap contributors, ODbL): buildings with types, parks, and
//     "grounds" (school campus, industrial land, ...) that tell us what an untyped building is.
//   - Microsoft Global ML Building Footprints (ODbL): roofs detected from satellite images.
//     Used by scripts/fetch-buildings.ts to fill gaps where OSM has few buildings mapped.
// Used by the app (live fetch) and by scripts/fetch-buildings.ts (pre-saved areas).

export type FeatureKind = "building" | "open" | "zone";

export interface AreaFeature {
  /** OSM way id. Negative for satellite-detected buildings (they have no OSM id). */
  id: number;
  kind: FeatureKind;
  /** Most useful tag value, e.g. "school", "apartments", "park". */
  tag: string;
  name?: string;
  /** Outline as [lat, lng] points. */
  ring: [number, number][];
  /** Footprint area in m². */
  area: number;
}

/** Compact form for saved files: [id, kind (0 building / 1 open / 2 zone), tag, name, flat lat,lng list]. */
export type CompactFeature = [number, 0 | 1 | 2, string, string, number[]];

export const AREA_RADIUS_M = 600;
export const MIN_BUILDING_M2 = 40;
const MIN_OPEN_M2 = 300;

export const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export const isSatellite = (f: AreaFeature) => f.id < 0;

export function overpassQuery(lat: number, lng: number, radius = AREA_RADIUS_M): string {
  const around = `(around:${radius},${lat},${lng})`;
  return `[out:json][timeout:60];(
way["building"]${around};
way["leisure"~"^(park|playground|pitch|garden)$"]${around};
way["landuse"~"^(grass|recreation_ground|village_green|industrial|commercial|retail)$"]${around};
way["amenity"~"^(school|college|university|kindergarten|hospital|clinic|place_of_worship|marketplace)$"]${around};
way["office"="government"]${around};
);out tags geom;`;
}

/** Footprint area in m² (flat-earth formula; accurate enough at building size). */
export function ringAreaM2(ring: [number, number][]): number {
  if (ring.length < 3) return 0;
  const lat0 = (ring[0][0] * Math.PI) / 180;
  const kx = 111320 * Math.cos(lat0);
  const ky = 110540;
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [la1, ln1] = ring[i];
    const [la2, ln2] = ring[(i + 1) % ring.length];
    sum += ln1 * kx * (la2 * ky) - ln2 * kx * (la1 * ky);
  }
  return Math.abs(sum) / 2;
}

export function centroidOf(ring: [number, number][]): [number, number] {
  let a = 0, b = 0;
  for (const [lat, lng] of ring) {
    a += lat;
    b += lng;
  }
  return [a / ring.length, b / ring.length];
}

/** Ray-casting point-in-polygon test. */
export function pointInRing(lat: number, lng: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i];
    const [yj, xj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const BUILDING_AMENITY = /^(school|college|university|kindergarten|hospital|clinic|townhall|police|fire_station|post_office|library|community_centre|place_of_worship|marketplace|bus_station|courthouse)$/;
const ZONE_AMENITY = /^(school|college|university|kindergarten|hospital|clinic|place_of_worship|marketplace)$/;
const ZONE_LANDUSE = /^(industrial|commercial|retail)$/;

/** Buildings, open spaces and grounds, ready to use (grounds already applied to buildings). */
export function parseOverpass(json: { elements?: any[] }): AreaFeature[] {
  return classifyByZones(parseOverpassRaw(json));
}

/** Same as parseOverpass, but keeps the grounds ("zone" features) in the list. */
export function parseOverpassRaw(json: { elements?: any[] }): AreaFeature[] {
  const out: AreaFeature[] = [];
  for (const el of json.elements ?? []) {
    if (el.type !== "way" || !Array.isArray(el.geometry)) continue;
    const t = el.tags ?? {};
    const ring: [number, number][] = el.geometry.map((g: { lat: number; lon: number }) => [g.lat, g.lon]);
    if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring.pop();
    if (ring.length < 3) continue;
    const area = ringAreaM2(ring);
    const name = t.name || undefined;
    if (t.building) {
      if (area < MIN_BUILDING_M2) continue;
      const tag = t.amenity && BUILDING_AMENITY.test(t.amenity) ? t.amenity : t.office === "government" ? "government" : t.building === "yes" && t.shop ? "retail" : t.building;
      out.push({ id: el.id, kind: "building", tag, name, ring, area });
    } else if (t.amenity && ZONE_AMENITY.test(t.amenity)) {
      out.push({ id: el.id, kind: "zone", tag: t.amenity, name, ring, area });
    } else if (t.office === "government") {
      out.push({ id: el.id, kind: "zone", tag: "government", name, ring, area });
    } else if (t.landuse && ZONE_LANDUSE.test(t.landuse)) {
      out.push({ id: el.id, kind: "zone", tag: t.landuse, name, ring, area });
    } else {
      if (area < MIN_OPEN_M2) continue;
      out.push({ id: el.id, kind: "open", tag: t.leisure || t.landuse || "open", name, ring, area });
    }
  }
  return out;
}

/**
 * Buildings with no type ("yes") that stand inside a school campus, hospital, industrial area, ...
 * get that type (and the campus name). Grounds themselves are then dropped from the list.
 * Smaller grounds win, so a school inside an industrial area counts as a school.
 */
export function classifyByZones(features: AreaFeature[]): AreaFeature[] {
  const zones = features.filter((f) => f.kind === "zone").sort((a, b) => a.area - b.area);
  const out: AreaFeature[] = [];
  for (const f of features) {
    if (f.kind === "zone") continue;
    if (f.kind === "building" && (f.tag === "yes" || f.tag === "building") && zones.length) {
      const [lat, lng] = centroidOf(f.ring);
      const z = zones.find((z) => pointInRing(lat, lng, z.ring));
      if (z) {
        out.push({ ...f, tag: z.tag, name: f.name ?? z.name });
        continue;
      }
    }
    out.push(f);
  }
  return out;
}

export function toCompact(f: AreaFeature): CompactFeature {
  return [f.id, f.kind === "building" ? 0 : f.kind === "open" ? 1 : 2, f.tag, f.name ?? "", f.ring.flatMap(([a, b]) => [+a.toFixed(6), +b.toFixed(6)])];
}

export function fromCompact(c: CompactFeature): AreaFeature {
  const ring: [number, number][] = [];
  for (let i = 0; i < c[4].length; i += 2) ring.push([c[4][i], c[4][i + 1]]);
  return { id: c[0], kind: c[1] === 0 ? "building" : c[1] === 1 ? "open" : "zone", tag: c[2], name: c[3] || undefined, ring, area: ringAreaM2(ring) };
}

/**
 * Reads an Overpass answer. A busy server can answer with an HTML error page, or with JSON that
 * has no elements and a "remark" like "runtime error: ... timeout". Both mean "failed", not "no buildings".
 */
export function readOverpassJson(text: string): { elements?: any[] } {
  if (!text.trimStart().startsWith("{")) throw new Error("Server busy");
  const json = JSON.parse(text);
  if (typeof json.remark === "string" && /error|timeout|out of memory/i.test(json.remark)) throw new Error("Server busy (partial answer)");
  return json;
}

/** Give up on one server after this long and try the next one. */
const SERVER_TIMEOUT_MS = 30_000;

/** Try each Overpass server in turn. Throws if all fail. */
export async function fetchAreaFeatures(lat: number, lng: number, radius = AREA_RADIUS_M, signal?: AbortSignal): Promise<AreaFeature[]> {
  const body = "data=" + encodeURIComponent(overpassQuery(lat, lng, radius));
  let lastError: unknown;
  for (const url of OVERPASS_ENDPOINTS) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    signal?.addEventListener("abort", onAbort);
    const timer = setTimeout(() => ctrl.abort(), SERVER_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        body,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseOverpass(readOverpassJson(await res.text()));
    } catch (e) {
      if (signal?.aborted) throw e;
      lastError = ctrl.signal.aborted ? new Error("Server took too long") : e;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not reach OpenStreetMap");
}
