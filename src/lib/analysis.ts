import { CRITICAL_DEPTH } from "./bands";
import type { Period, Reading, Season, Station } from "./types";

// Season windows (same idea as CGWB's pre- and post-monsoon surveys):
//   pre-monsoon  = March to June        (driest time, water is deepest)
//   post-monsoon = October to January   (after the rains, water is highest)
// January belongs to the previous year's post-monsoon.
export function seasonOf(date: string): { season: Season; year: number } | null {
  const year = +date.slice(0, 4);
  const month = +date.slice(5, 7);
  if (month >= 3 && month <= 6) return { season: "pre", year };
  if (month >= 10) return { season: "post", year };
  if (month === 1) return { season: "post", year: year - 1 };
  return null;
}

export const SEASON_LABEL: Record<Season, string> = { pre: "Pre-monsoon", post: "Post-monsoon" };
export const SEASON_SHORT: Record<Season, string> = { pre: "Pre", post: "Post" };

export function periodLabel(p: Period): string {
  return p.kind === "latest" ? "Latest readings" : `${SEASON_LABEL[p.season]} ${p.year}`;
}

export function periodKey(p: Period): string {
  return p.kind === "latest" ? "latest" : `${p.year}-${p.season}`;
}

/** Readings grouped by station, each list sorted oldest → newest. */
export function groupReadings(readings: Reading[]): Map<string, Reading[]> {
  const map = new Map<string, Reading[]>();
  for (const r of readings) {
    const list = map.get(r.stationId);
    if (list) list.push(r);
    else map.set(r.stationId, [r]);
  }
  for (const list of map.values()) list.sort((a, b) => a.date.localeCompare(b.date));
  return map;
}

/** The reading that represents a station in a period (latest one inside the window). */
export function readingFor(list: Reading[] | undefined, period: Period): Reading | undefined {
  if (!list || list.length === 0) return undefined;
  if (period.kind === "latest") return list[list.length - 1];
  for (let i = list.length - 1; i >= 0; i--) {
    const s = seasonOf(list[i].date);
    if (s && s.season === period.season && s.year === period.year) return list[i];
  }
  return undefined;
}

/** All season periods that have at least one reading, oldest first. */
export function availablePeriods(readings: Reading[]): Period[] {
  const keys = new Set<string>();
  for (const r of readings) {
    const s = seasonOf(r.date);
    if (s) keys.add(`${s.year}-${s.season}`);
  }
  return [...keys]
    .map((k) => {
      const [y, season] = k.split("-");
      return { kind: "season", year: +y, season: season as Season } as Period;
    })
    .sort((a, b) => {
      if (a.kind !== "season" || b.kind !== "season") return 0;
      return a.year - b.year || (a.season === "pre" ? -1 : 1) - (b.season === "pre" ? -1 : 1);
    });
}

/** Same season one year earlier, for "change since last year". */
export function previousYear(p: Period, list: Reading[] | undefined): Reading | undefined {
  if (p.kind === "season") return readingFor(list, { ...p, year: p.year - 1 });
  const latest = list?.[list.length - 1];
  if (!latest) return undefined;
  const s = seasonOf(latest.date);
  return s ? readingFor(list, { kind: "season", season: s.season, year: s.year - 1 }) : undefined;
}

export interface Trend {
  /** Metres per year. Positive = water going deeper (bad). */
  slope: number;
  points: number;
  basis: "pre-monsoon" | "all readings";
}

const yearFraction = (date: string) => {
  const d = new Date(date + "T00:00:00Z");
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return d.getUTCFullYear() + (d.getTime() - start) / (365.25 * 86400000);
};

/**
 * Long-term trend with a straight-line fit (least squares).
 * We use pre-monsoon readings only, like CGWB does, so the seasonal up-and-down does not hide the trend.
 */
export function trendOf(list: Reading[] | undefined): Trend | null {
  if (!list || list.length < 2) return null;
  const pre = list.filter((r) => seasonOf(r.date)?.season === "pre");
  const use = pre.length >= 3 ? pre : list;
  if (use.length < 2) return null;
  const xs = use.map((r) => yearFraction(r.date));
  const ys = use.map((r) => r.level);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return null;
  return { slope: num / den, points: use.length, basis: use === pre ? "pre-monsoon" : "all readings" };
}

export type Status = "critical" | "atrisk" | "watch" | "ok";

/** Falling faster than this (m/yr) counts as a fast fall. */
export const FAST_FALL = 0.5;

export function statusOf(level: number, trend: Trend | null): Status {
  const slope = trend?.slope ?? 0;
  if (level >= CRITICAL_DEPTH) return "critical";
  if (level >= 10 && slope >= FAST_FALL) return "atrisk";
  if (level >= 10 || slope >= FAST_FALL) return "watch";
  return "ok";
}

export const STATUS_META: Record<Status, { label: string; color: string; soft: string; text: string }> = {
  critical: { label: "Critical", color: "#ea580c", soft: "#ffedd5", text: "#c2410c" },
  atrisk: { label: "At risk", color: "#d97706", soft: "#fef3c7", text: "#a16207" },
  watch: { label: "Watch", color: "#64748b", soft: "#f1f5f9", text: "#475569" },
  ok: { label: "Healthy", color: "#16a34a", soft: "#dcfce7", text: "#15803d" },
};

/** Higher = more urgent. Depth counts most, a fast fall adds to it. */
export function priorityScore(level: number, trend: Trend | null): number {
  return level + 6 * Math.max(0, trend?.slope ?? 0);
}

export interface StationView {
  station: Station;
  reading?: Reading;
  previous?: Reading;
  trend: Trend | null;
  status?: Status;
  score: number;
}

export function buildViews(stations: Station[], grouped: Map<string, Reading[]>, period: Period): StationView[] {
  return stations.map((station) => {
    const list = grouped.get(station.id);
    const reading = readingFor(list, period);
    const trend = trendOf(list);
    return {
      station,
      reading,
      previous: reading ? previousYear(period, list) : undefined,
      trend,
      status: reading ? statusOf(reading.level, trend) : undefined,
      score: reading ? priorityScore(reading.level, trend) : -1,
    };
  });
}

export function formatDate(date: string): string {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Distance in km between two points (haversine). */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
