export type Zone = "urban" | "dense" | "industrial" | "hill" | "periurban" | "coastal";
export type StationKind = "piezometer" | "borewell" | "openwell";

export interface Station {
  id: string;
  name: string;
  lat: number;
  lng: number;
  zone: Zone;
  kind: StationKind;
  /** Near the sea: pumping too much can pull seawater into the ground. */
  coastal: boolean;
  /** Added by an official in this browser (not part of the sample data). */
  custom?: boolean;
}

export interface Reading {
  id: string;
  stationId: string;
  /** YYYY-MM-DD */
  date: string;
  /** Depth to water in metres below ground level (m bgl). Bigger = deeper = worse. */
  level: number;
  source: "seed" | "official";
  recordedBy?: string;
  note?: string;
  /** ISO time when an official saved it. */
  savedAt?: string;
}

export type Season = "pre" | "post";

export type Period = { kind: "latest" } | { kind: "season"; year: number; season: Season };

export type Mode = "citizen" | "official";

export interface Settings {
  /** Average yearly rainfall used in the water-saving estimate (mm). */
  rainfallMm: number;
  /** Share of rain a hard roof collects (0–1). */
  roofRunoff: number;
  /** Share of rain an open ground area sends to a recharge pit (0–1). */
  openRunoff: number;
  /** City water norm per person (litres/day) used to explain savings. */
  lpcd: number;
  officerName: string;
}
