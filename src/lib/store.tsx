// App data (stations, readings, settings), saved in this browser with localStorage.
// First visit = sample data from src/data/seed.json. "Reset demo data" brings it back.

import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import seed from "../data/seed.json";
import type { Reading, Settings, Station } from "./types";

const STORAGE_KEY = "jaldrishti:changes:v1";

export const DEFAULT_SETTINGS: Settings = {
  rainfallMm: 1000, // Approximate yearly rainfall for Visakhapatnam. Check the latest IMD normal before submitting.
  roofRunoff: 0.8, // Concrete / RCC roof
  openRunoff: 0.3, // Grass and open soil
  lpcd: 135, // CPHEEO norm for Indian cities with piped water and sewerage
  officerName: "Field Officer",
};

export interface DataState {
  stations: Station[];
  readings: Reading[];
  settings: Settings;
}

type Action =
  | { type: "addReading"; reading: Reading }
  | { type: "updateReading"; reading: Reading }
  | { type: "deleteReading"; id: string }
  | { type: "addStation"; station: Station; reading?: Reading }
  | { type: "deleteStation"; id: string }
  | { type: "updateSettings"; settings: Partial<Settings> }
  | { type: "reset" };

function seedState(settings?: Settings): DataState {
  return {
    stations: seed.stations as Station[],
    readings: seed.readings as Reading[],
    settings: settings ?? DEFAULT_SETTINGS,
  };
}

// We save only the changes made on top of the sample data (added, edited, deleted).
// So if the sample data file is updated later, the browser still picks up the new version.
interface Patch {
  readings: Reading[]; // added or edited
  deletedReadings: string[];
  stations: Station[]; // added
  deletedStations: string[];
  settings: Settings;
}

const SEED_READINGS = new Map((seed.readings as Reading[]).map((r) => [r.id, r]));
const SEED_STATIONS = new Set((seed.stations as Station[]).map((s) => s.id));

function toPatch(state: DataState): Patch {
  const ids = new Set(state.readings.map((r) => r.id));
  const stationIds = new Set(state.stations.map((s) => s.id));
  return {
    readings: state.readings.filter((r) => SEED_READINGS.get(r.id) !== r),
    deletedReadings: [...SEED_READINGS.keys()].filter((id) => !ids.has(id)),
    stations: state.stations.filter((s) => !SEED_STATIONS.has(s.id)),
    deletedStations: [...SEED_STATIONS].filter((id) => !stationIds.has(id)),
    settings: state.settings,
  };
}

function fromPatch(p: Patch): DataState {
  const deleted = new Set(p.deletedReadings);
  const deletedStations = new Set(p.deletedStations);
  const changed = new Map(p.readings.map((r) => [r.id, r]));
  const stations = [...(seed.stations as Station[]).filter((s) => !deletedStations.has(s.id)), ...p.stations];
  const stationIds = new Set(stations.map((s) => s.id));
  const readings = (seed.readings as Reading[])
    .filter((r) => !deleted.has(r.id) && !changed.has(r.id))
    .concat(p.readings)
    .filter((r) => stationIds.has(r.stationId));
  return { stations, readings, settings: { ...DEFAULT_SETTINGS, ...p.settings } };
}

function load(): DataState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Patch;
      if (Array.isArray(p.readings) && Array.isArray(p.stations)) return fromPatch(p);
    }
  } catch {
    // Storage blocked or broken: fall back to sample data.
  }
  return seedState();
}

function reducer(state: DataState, action: Action): DataState {
  switch (action.type) {
    case "addReading":
      return { ...state, readings: [...state.readings, action.reading] };
    case "updateReading":
      return { ...state, readings: state.readings.map((r) => (r.id === action.reading.id ? action.reading : r)) };
    case "deleteReading":
      return { ...state, readings: state.readings.filter((r) => r.id !== action.id) };
    case "addStation":
      return {
        ...state,
        stations: [...state.stations, action.station],
        readings: action.reading ? [...state.readings, action.reading] : state.readings,
      };
    case "deleteStation":
      return {
        ...state,
        stations: state.stations.filter((s) => s.id !== action.id),
        readings: state.readings.filter((r) => r.stationId !== action.id),
      };
    case "updateSettings":
      return { ...state, settings: { ...state.settings, ...action.settings } };
    case "reset":
      // Keep the officer name and assumptions; only the data goes back to the sample.
      return seedState(state.settings);
  }
}

interface Store extends DataState {
  dispatch: (a: Action) => void;
}

const Ctx = createContext<Store | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toPatch(state)));
    } catch {
      // Storage full or blocked: the app still works for this visit.
    }
  }, [state]);

  const value = useMemo(() => ({ ...state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useData must be used inside DataProvider");
  return s;
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Small per-browser preference (mode, map style). Never throws. */
export function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`jaldrishti:pref:${key}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: unknown): void {
  try {
    localStorage.setItem(`jaldrishti:pref:${key}`, JSON.stringify(value));
  } catch {
    // ignore
  }
}
