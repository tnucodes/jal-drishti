// Builds src/data/seed.json: SAMPLE monitoring stations and readings.
//
// IMPORTANT: these are NOT real measurements. Station places are real Vizag localities
// (coordinates from OpenStreetMap), but water levels are made up to follow realistic patterns:
//   - Hard rock / hilly growth areas (Madhurawada, Kommadi, Pendurthi side) are deep and falling fast.
//   - Dense old city and the Gajuwaka industrial belt are stressed.
//   - Coastal areas are shallow, but carry a seawater intrusion risk.
//   - Pre-monsoon (May) is deeper than post-monsoon (November).
// The same input always gives the same output (fixed random seed), so the file is reproducible.
//
// Run: bun run data:seed

type Zone = "urban" | "dense" | "industrial" | "hill" | "periurban" | "coastal";
type Kind = "piezometer" | "borewell" | "openwell";

// [id, name, lat, lng, zone, kind, pre-monsoon depth in May 2026 (m bgl), yearly fall (m/yr), coastal]
const STATIONS: [string, string, number, number, Zone, Kind, number, number, boolean][] = [
  ["mvp", "MVP Colony", 17.7423, 83.3357, "urban", "piezometer", 9.5, 0.25, false],
  ["siripuram", "Siripuram", 17.7208, 83.3172, "urban", "borewell", 11, 0.3, false],
  ["dwaraka", "Dwaraka Nagar", 17.7286, 83.3093, "dense", "piezometer", 21.5, 0.7, false],
  ["asilmetta", "Asilmetta", 17.7247, 83.3089, "dense", "borewell", 19, 0.6, false],
  ["seethammadhara", "Seethammadhara", 17.745, 83.3062, "urban", "piezometer", 12.5, 0.35, false],
  ["akkayyapalem", "Akkayyapalem", 17.7382, 83.2992, "dense", "borewell", 22.5, 0.75, false],
  ["gajuwaka", "Gajuwaka", 17.6814, 83.213, "industrial", "piezometer", 31, 1.1, false],
  ["pedagantyada", "Pedagantyada", 17.6657, 83.2098, "industrial", "borewell", 27, 0.9, false],
  ["kurmannapalem", "Kurmannapalem", 17.6867, 83.1695, "industrial", "piezometer", 24, 0.85, false],
  ["aganampudi", "Aganampudi", 17.686, 83.1355, "periurban", "borewell", 18, 0.4, false],
  ["madhurawada", "Madhurawada", 17.8102, 83.354, "hill", "piezometer", 34, 1.3, false],
  ["pmpalem", "PM Palem", 17.797, 83.351, "hill", "borewell", 26, 1.0, false],
  ["kommadi", "Kommadi", 17.8306, 83.3358, "hill", "piezometer", 29, 1.2, false],
  ["rushikonda", "Rushikonda", 17.7931, 83.3849, "coastal", "openwell", 6.5, 0.2, true],
  ["sagarnagar", "Sagar Nagar", 17.7671, 83.3581, "coastal", "borewell", 5.5, 0.15, true],
  ["yendada", "Yendada", 17.7829, 83.358, "hill", "borewell", 16, 0.4, false],
  ["arilova", "Arilova", 17.7651, 83.3154, "hill", "piezometer", 14, 0.45, false],
  ["pedawaltair", "Pedawaltair", 17.7262, 83.332, "coastal", "borewell", 7.5, 0.15, true],
  ["rkbeach", "Beach Road (RK Beach)", 17.715, 83.317, "coastal", "openwell", 4.2, 0.1, true],
  ["oldtown", "Old Town", 17.702, 83.2916, "coastal", "openwell", 5, 0.1, true],
  ["kancharapalem", "Kancharapalem", 17.73, 83.2779, "dense", "borewell", 17.5, 0.55, false],
  ["marripalem", "Marripalem", 17.7409, 83.2483, "urban", "piezometer", 14.5, 0.4, false],
  ["nad", "NAD Junction", 17.7448, 83.2334, "urban", "borewell", 16.5, 0.5, false],
  ["gopalapatnam", "Gopalapatnam", 17.7484, 83.22, "urban", "piezometer", 13, 0.35, false],
  ["simhachalam", "Simhachalam", 17.7664, 83.2508, "hill", "borewell", 23, 0.6, false],
  ["adavivaram", "Adavivaram", 17.7822, 83.2659, "hill", "piezometer", 21, 0.7, false],
  ["vepagunta", "Vepagunta", 17.7744, 83.2154, "periurban", "borewell", 12, 0.5, false],
  ["pendurthi", "Pendurthi", 17.8214, 83.2066, "periurban", "piezometer", 19.5, 0.8, false],
  ["chinamushidiwada", "Chinamushidiwada", 17.8128, 83.2256, "hill", "borewell", 22, 0.85, false],
  ["malkapuram", "Malkapuram", 17.6868, 83.2426, "industrial", "borewell", 15, 0.4, true],
  ["mindi", "Mindi", 17.7019, 83.2123, "industrial", "piezometer", 20.5, 0.7, false],
  ["duvvada", "Duvvada", 17.7036, 83.1514, "periurban", "borewell", 16, 0.4, false],
  ["vadlapudi", "Vadlapudi", 17.6933, 83.1876, "industrial", "borewell", 22, 0.75, false],
  ["sheelanagar", "Sheela Nagar", 17.7203, 83.2019, "urban", "piezometer", 14, 0.45, false],
  ["maddilapalem", "Maddilapalem", 17.7352, 83.3209, "dense", "borewell", 18, 0.55, false],
  ["lawsonsbay", "Lawsons Bay Colony", 17.7317, 83.3396, "coastal", "openwell", 6, 0.1, true],
  ["yarada", "Yarada", 17.6595, 83.276, "coastal", "openwell", 8, 0.05, true],
  ["marikavalasa", "Marikavalasa", 17.8393, 83.3539, "hill", "borewell", 27.5, 1.0, false],
  ["bakkannapalem", "Bakkannapalem", 17.8151, 83.3434, "hill", "piezometer", 30, 1.15, false],
  ["thatichetlapalem", "Thatichetlapalem", 17.7358, 83.2925, "dense", "borewell", 20, 0.6, false],
  ["muralinagar", "Murali Nagar", 17.7699, 83.3093, "hill", "borewell", 13.5, 0.4, false],
  ["narava", "Narava", 17.7441, 83.1825, "periurban", "openwell", 10.5, 0.3, false],
  ["dabagardens", "Daba Gardens", 17.7172, 83.2986, "urban", "borewell", 15, 0.35, false],
  ["kailasapuram", "Kailasapuram", 17.7409, 83.2882, "urban", "piezometer", 16, 0.45, false],
  ["sujathanagar", "Sujatha Nagar", 17.7979, 83.2154, "periurban", "borewell", 17, 0.65, false],
  ["midhilapuri", "Midhilapuri VUDA Colony", 17.805, 83.3636, "hill", "borewell", 25, 0.95, false],
  ["kapuluppada", "Kapuluppada", 17.8536, 83.3856, "hill", "piezometer", 18, 0.4, false],
];

// Made-up monsoon strength per year (+ = good rain, − = weak rain). Sample only.
const MONSOON: Record<number, number> = { 2020: 0.05, 2021: 0.1, 2022: -0.05, 2023: -0.2, 2024: 0.05, 2025: 0.1 };
// How much one year's monsoon changes the next pre-monsoon depth (share of depth).
const MONSOON_EFFECT = 0.2;

// Small fixed-seed random generator (mulberry32) so output never changes between runs.
let s = 20261021;
const rand = () => {
  s |= 0; s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const noise = (sd: number) => (rand() + rand() + rand() - 1.5) * sd * 1.4;
const round1 = (n: number) => Math.round(n * 10) / 10;
const pad = (n: number) => String(n).padStart(2, "0");

const stations = STATIONS.map(([id, name, lat, lng, zone, kind, , , coastal]) => ({ id, name, lat, lng, zone, kind, coastal }));
const readings: { id: string; stationId: string; date: string; level: number; source: "seed" }[] = [];

for (const [id, , , , zone, , base, fall] of STATIONS) {
  for (let year = 2021; year <= 2026; year++) {
    // Pre-monsoon (May): depends on the previous year's monsoon.
    const trendLevel = base - fall * (2026 - year);
    const pre = Math.max(0.6, trendLevel * (1 - MONSOON_EFFECT * MONSOON[year - 1]) + noise(0.25 + 0.02 * base));
    readings.push({ id: `seed-${id}-${year}-pre`, stationId: id, date: `${year}-05-${pad(10 + Math.floor(rand() * 15))}`, level: round1(pre), source: "seed" });

    // Post-monsoon (November): water rises after the rains. Hard rock recovers a bit less.
    if (year <= 2025) {
      const recoveryShare = zone === "hill" ? 0.3 : zone === "coastal" ? 0.5 : 0.38;
      const recovery = Math.min(pre * recoveryShare, 1.5 + pre * 0.28) * (1 + 0.8 * MONSOON[year]);
      const post = Math.max(0.5, pre - recovery + noise(0.2 + 0.02 * base));
      readings.push({ id: `seed-${id}-${year}-post`, stationId: id, date: `${year}-11-${pad(10 + Math.floor(rand() * 15))}`, level: round1(post), source: "seed" });
    }
  }
}

await Bun.write(
  new URL("../src/data/seed.json", import.meta.url),
  JSON.stringify({ note: "SAMPLE DATA for a student prototype. Not real measurements.", stations, readings }),
);
console.log(`${stations.length} stations, ${readings.length} readings`);
