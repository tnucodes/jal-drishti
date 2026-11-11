// Builds src/data/boundary.json: the "core city" area we show on the map.
//
// Steps:
// 1. Download the GVMC boundary from OpenStreetMap (Nominatim).
// 2. Cut it with a simple shape around the core city (this drops Bheemili and Anakapalli).
// 3. Simplify the outline so the file stays small.
//
// Run: bun run data:boundary

type Pt = [number, number]; // [lng, lat]

const GVMC_RELATION_ID = 17493324;

// Core city cut shape. It must be convex (no inward corners) for the cut method below.
// East side goes far into the sea, so the coast comes from the GVMC boundary itself.
const CORE: Pt[] = [
  [83.12, 17.64],
  [83.5, 17.64],
  [83.5, 17.87],
  [83.3, 17.87],
  [83.17, 17.85],
  [83.12, 17.78],
];

const res = await fetch(
  `https://nominatim.openstreetmap.org/lookup?osm_ids=R${GVMC_RELATION_ID}&format=json&polygon_geojson=1`,
  { headers: { "User-Agent": "jal-drishti-student-project/0.1" } },
);
const [place] = (await res.json()) as any[];
const geom = place.geojson;
const rings: Pt[][] = geom.type === "Polygon" ? [geom.coordinates[0]] : geom.coordinates.map((p: Pt[][]) => p[0]);
// Use the biggest outer ring.
const outer = rings.sort((a, b) => b.length - a.length)[0];

// Sutherland–Hodgman: cut a polygon with a convex polygon.
function clip(subject: Pt[], clipper: Pt[]): Pt[] {
  const inside = (p: Pt, a: Pt, b: Pt) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0;
  const cross = (p: Pt, q: Pt, a: Pt, b: Pt): Pt => {
    const a1 = b[1] - a[1], b1 = a[0] - b[0], c1 = a1 * a[0] + b1 * a[1];
    const a2 = q[1] - p[1], b2 = p[0] - q[0], c2 = a2 * p[0] + b2 * p[1];
    const d = a1 * b2 - a2 * b1;
    return [(b2 * c1 - b1 * c2) / d, (a1 * c2 - a2 * c1) / d];
  };
  let out = subject;
  for (let i = 0; i < clipper.length; i++) {
    const a = clipper[i], b = clipper[(i + 1) % clipper.length];
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j], q = input[(j + 1) % input.length];
      if (inside(q, a, b)) {
        if (!inside(p, a, b)) out.push(cross(p, q, a, b));
        out.push(q);
      } else if (inside(p, a, b)) out.push(cross(p, q, a, b));
    }
  }
  return out;
}

// Douglas–Peucker line simplification (tolerance in degrees, ~0.0003 ≈ 30 m).
function simplify(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 3) return pts;
  const dist = (p: Pt, a: Pt, b: Pt) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0;
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  };
  let max = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = dist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > max) { max = d; idx = i; }
  }
  if (max <= tol) return [pts[0], pts[pts.length - 1]];
  return [...simplify(pts.slice(0, idx + 1), tol).slice(0, -1), ...simplify(pts.slice(idx), tol)];
}

// Make sure the cut shape is counter-clockwise, as clip() expects.
const signedArea = (r: Pt[]) => r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
const core = signedArea(CORE) > 0 ? CORE : [...CORE].reverse();

const cut = clip(outer, core);
const simple = simplify(cut, 0.0003).map(([x, y]) => [+x.toFixed(5), +y.toFixed(5)] as Pt);

const out = {
  name: "Visakhapatnam core city (from GVMC boundary, OpenStreetMap)",
  source: `OpenStreetMap relation ${GVMC_RELATION_ID} © OpenStreetMap contributors (ODbL)`,
  coordinates: simple, // [lng, lat]
};
await Bun.write(new URL("../src/data/boundary.json", import.meta.url), JSON.stringify(out));
console.log(`GVMC ring: ${outer.length} points → core ring: ${cut.length} → simplified: ${simple.length}`);
