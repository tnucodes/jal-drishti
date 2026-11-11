// Rule-based recharge suggestions for buildings and open spaces in a critical area.
// Methods and sizes are based on the CGWB "Manual on Artificial Recharge of Ground Water" (2007)
// and CGWB rooftop rainwater harvesting guidance. Please verify the numbers before using them in a report.

import { isSatellite, type AreaFeature } from "./osm";
import type { Settings, Zone } from "./types";

export type MethodId = "pit" | "trench" | "borewell" | "shaft" | "storage" | "percolation" | "contour";

export interface Method {
  id: MethodId;
  name: string;
  short: string;
  /** When to use it, in one line. */
  fit: string;
  /** How it is built, from CGWB guidance. */
  build: string;
  color: string;
}

export const METHODS: Record<MethodId, Method> = {
  pit: {
    id: "pit",
    name: "Recharge pit",
    short: "Pit",
    fit: "Small roofs (under ~300 m²), houses and small shops.",
    build: "Pit 1–2 m wide and 2–3 m deep, filled with boulders, then gravel, then coarse sand. Roof water goes in through a filter.",
    color: "#8b5cf6",
  },
  trench: {
    id: "trench",
    name: "Recharge trench",
    short: "Trench",
    fit: "Medium roofs (300–1000 m²) where the water is not too deep.",
    build: "Trench 0.5–1 m wide, 1–1.5 m deep and 10–20 m long along the compound, filled like a pit.",
    color: "#ec4899",
  },
  borewell: {
    id: "borewell",
    name: "Borewell recharge",
    short: "Borewell",
    fit: "Medium roofs where water is deep (≥ 15 m) or in hard rock.",
    build: "Roof water goes through a sand–gravel filter chamber into an existing or unused borewell, so it reaches the deep rock cracks.",
    color: "#0ea5e9",
  },
  shaft: {
    id: "shaft",
    name: "Recharge shaft",
    short: "Shaft",
    fit: "Large roofs (≥ 1000 m²): schools, offices, factories, big apartments.",
    build: "Shaft 2–5 m wide and 10–15 m deep (past the clay layer), filled with boulders, gravel and sand. Often paired with a borewell.",
    color: "#3730a3",
  },
  storage: {
    id: "storage",
    name: "Store & reuse",
    short: "Storage",
    fit: "Where water is already near the surface, or near the sea.",
    build: "Collect roof water in a sump or tank and use it for washing, gardens and toilets. Using it means less borewell pumping.",
    color: "#14b8a6",
  },
  percolation: {
    id: "percolation",
    name: "Percolation pits",
    short: "Percolation",
    fit: "Parks, playgrounds and open plots on flat ground.",
    build: "A row of small pits (about 1 m × 1 m × 1.5 m) filled with gravel at low points, so rain soaks in instead of running into drains.",
    color: "#65a30d",
  },
  contour: {
    id: "contour",
    name: "Contour trenches",
    short: "Contour",
    fit: "Open land on hill slopes (Kambalakonda, Madhurawada side).",
    build: "Shallow trenches dug along the slope's contour lines to slow down running water and let it soak into the ground.",
    color: "#a16207",
  },
};

export const METHOD_ORDER: MethodId[] = ["shaft", "borewell", "trench", "pit", "storage", "percolation", "contour"];

export interface AreaContext {
  /** Depth to water at the station (m bgl). */
  level: number;
  zone: Zone;
  coastal: boolean;
}

export interface Suggestion {
  feature: AreaFeature;
  method: MethodId;
  /** Estimated water captured per year (litres). */
  litres: number;
  tier: 1 | 2 | 3 | 4;
  typeLabel: string;
  reasons: string[];
}

const TAG_LABEL: Record<string, string> = {
  school: "School", college: "College", university: "University", kindergarten: "Pre-school",
  hospital: "Hospital", clinic: "Clinic", townhall: "Town hall", police: "Police station",
  fire_station: "Fire station", post_office: "Post office", library: "Library",
  community_centre: "Community hall", government: "Government office", public: "Public building",
  civic: "Civic building", courthouse: "Court", bus_station: "Bus station", train_station: "Railway station",
  transportation: "Transport building", place_of_worship: "Place of worship", temple: "Temple",
  church: "Church", mosque: "Mosque", commercial: "Commercial", office: "Office", retail: "Shop / retail",
  supermarket: "Supermarket", marketplace: "Market", hotel: "Hotel", industrial: "Industrial",
  warehouse: "Warehouse", factory: "Factory", apartments: "Apartments", residential: "Residential",
  dormitory: "Hostel", house: "House", detached: "House", semidetached_house: "House", terrace: "Row houses",
  hut: "Hut", shed: "Shed", garage: "Garage", garages: "Garages", roof: "Roof / shelter",
  construction: "Under construction", yes: "Building",
  park: "Park", playground: "Playground", pitch: "Sports ground", garden: "Garden", grass: "Open green",
  recreation_ground: "Recreation ground", village_green: "Open green",
};

const TIER_1 = /^(school|college|university|kindergarten|hospital|clinic|townhall|police|fire_station|post_office|library|community_centre|government|public|civic|courthouse|bus_station|train_station|transportation)$/;
const TIER_2 = /^(commercial|office|retail|supermarket|marketplace|hotel|industrial|warehouse|factory|place_of_worship|temple|church|mosque)$/;
const TIER_3 = /^(apartments|residential|dormitory)$/;

export const TIER_LABEL: Record<1 | 2 | 3 | 4, string> = {
  1: "Public",
  2: "Large / commercial",
  3: "Apartments",
  4: "Houses & others",
};

export function typeLabel(tag: string): string {
  return TAG_LABEL[tag] ?? tag.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** litres per year = area (m²) × rainfall (m) × runoff share × 1000 */
export function harvestLitres(areaM2: number, settings: Settings, kind: "building" | "open"): number {
  const runoff = kind === "building" ? settings.roofRunoff : settings.openRunoff;
  return areaM2 * (settings.rainfallMm / 1000) * runoff * 1000;
}

const SKIP_TAGS = /^(construction|hut|shed|roof|garage|garages|ruins|collapsed)$/;

export function suggestFor(feature: AreaFeature, ctx: AreaContext, settings: Settings): Suggestion | null {
  if (feature.kind === "zone") return null; // Grounds only help to label buildings.
  const litres = harvestLitres(feature.area, settings, feature.kind);
  const area = Math.round(feature.area);
  const kl = Math.round(litres / 1000);

  if (feature.kind === "open") {
    if (ctx.level < 3) return null; // Water already near the surface: no need to recharge here.
    const method: MethodId = ctx.zone === "hill" ? "contour" : "percolation";
    const reasons = [`Open area of about ${area.toLocaleString("en-IN")} m² can soak in about ${kl.toLocaleString("en-IN")} kL of rain a year.`];
    if (ctx.zone === "hill") reasons.push("Hill slope: trenches slow down running water so it can soak in.");
    return { feature, method, litres, tier: 2, typeLabel: typeLabel(feature.tag), reasons };
  }

  if (SKIP_TAGS.test(feature.tag)) return null;

  const reasons = [`Roof of about ${area.toLocaleString("en-IN")} m² collects about ${kl.toLocaleString("en-IN")} kL of rain a year.`];
  let method: MethodId;

  if (ctx.level < 3) {
    method = "storage";
    reasons.push(`Water is only ${ctx.level.toFixed(1)} m deep here. More recharge can cause waterlogging, so store and use the rain instead.`);
  } else if (ctx.coastal && ctx.level < 8) {
    method = "storage";
    reasons.push("Near the sea with shallow water: using rainwater means less pumping, which keeps seawater out of the wells.");
  } else if (feature.area >= 1000) {
    method = "shaft";
    reasons.push("Large roof: a shaft can take a lot of water quickly, past the top clay layer.");
  } else if (feature.area >= 300) {
    if (ctx.level >= 15 || ctx.zone === "hill") {
      method = "borewell";
      reasons.push(ctx.zone === "hill" ? "Hard rock area: water must reach the rock cracks, so recharge through a borewell." : `Water is deep (${ctx.level.toFixed(1)} m), so send it down through a borewell.`);
    } else {
      method = "trench";
      reasons.push("Medium roof with moderate depth: a trench along the compound is enough.");
    }
  } else {
    method = "pit";
    reasons.push("Small roof: a simple recharge pit is cheap and works well.");
  }

  if (ctx.coastal && method !== "storage") reasons.push("Near the sea: recharge helps hold back seawater intrusion.");

  const tier = TIER_1.test(feature.tag) ? 1 : TIER_2.test(feature.tag) ? 2 : TIER_3.test(feature.tag) ? 3 : 4;
  const label = isSatellite(feature) && feature.tag === "yes" ? "Building (seen from satellite)" : typeLabel(feature.tag);
  return { feature, method, litres, tier, typeLabel: label, reasons };
}

/** Public buildings first (the city can act on them directly), then by water captured. */
export function rankSuggestions(features: AreaFeature[], ctx: AreaContext, settings: Settings): Suggestion[] {
  const list: Suggestion[] = [];
  for (const f of features) {
    const s = suggestFor(f, ctx, settings);
    if (s) list.push(s);
  }
  return list.sort((a, b) => a.tier - b.tier || b.litres - a.litres);
}

export function formatLitres(l: number): string {
  if (l >= 1e7) return `${(l / 1e7).toFixed(2)} crore L`;
  if (l >= 1e5) return `${(l / 1e5).toFixed(1)} lakh L`;
  if (l >= 1000) return `${Math.round(l / 1000).toLocaleString("en-IN")} kL`;
  return `${Math.round(l)} L`;
}

export function formatMillionLitres(l: number): string {
  return `${(l / 1e6).toFixed(l >= 1e8 ? 0 : 1)} million L`;
}
