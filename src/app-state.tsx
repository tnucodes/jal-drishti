// Screen state shared by the map and the side panel (what is selected, which period, etc.).

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import boundary from "./data/boundary.json";
import { availablePeriods, buildViews, groupReadings, periodKey, type StationView } from "./lib/analysis";
import { loadArea, type AreaData } from "./lib/areas";
import { renderHeatImage, type HeatImage, type HeatPoint } from "./lib/heatmap";
import { readPref, useData, writePref } from "./lib/store";
import { rankSuggestions, type MethodId, type Suggestion } from "./lib/suggestions";
import type { Mode, Period, Reading } from "./lib/types";

export type Tab = "overview" | "critical";
export type SheetSize = "min" | "peek" | "full";
export type MapStyle = "light" | "satellite";

export interface FocusRequest {
  lat: number;
  lng: number;
  zoom: number;
  ts: number;
}

export interface AreaState {
  status: "idle" | "loading" | "ready" | "error";
  data?: AreaData;
  error?: string;
}

export type ReadingFormState = { stationId: string; reading?: Reading } | null;

const BOUNDARY = boundary.coordinates as [number, number][];

function useAppState() {
  const { stations, readings, settings } = useData();

  const [mode, setModeRaw] = useState<Mode>(() => readPref<Mode>("mode", "citizen"));
  const [period, setPeriod] = useState<Period>({ kind: "latest" });
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [areaStationId, setAreaStationId] = useState<string | null>(null);
  const [area, setArea] = useState<AreaState>({ status: "idle" });
  const [areaReload, setAreaReload] = useState(0);
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<number | null>(null);
  const [methodFilter, setMethodFilter] = useState<MethodId | "all">("all");
  const [placing, setPlacing] = useState(false);
  const [newStationAt, setNewStationAt] = useState<[number, number] | null>(null);
  const [readingForm, setReadingForm] = useState<ReadingFormState>(null);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [sheet, setSheet] = useState<SheetSize>("peek");
  // Defaults: satellite map, one colour per CGWB band, heatmap at 50%.
  const [mapStyle, setMapStyleRaw] = useState<MapStyle>(() => readPref<MapStyle>("mapStyle", "satellite"));
  const [showHeat, setShowHeat] = useState(true);
  const [smooth, setSmoothRaw] = useState<boolean>(() => readPref("smooth", false));
  const [heatOpacity, setHeatOpacity] = useState(0.5);

  const setMode = useCallback((m: Mode) => {
    setModeRaw(m);
    writePref("mode", m);
    if (m === "citizen") {
      setTab("overview");
      setAreaStationId(null);
      setPlacing(false);
    }
  }, []);
  const setMapStyle = useCallback((s: MapStyle) => {
    setMapStyleRaw(s);
    writePref("mapStyle", s);
  }, []);
  const setSmooth = useCallback((v: boolean) => {
    setSmoothRaw(v);
    writePref("smooth", v);
  }, []);

  const grouped = useMemo(() => groupReadings(readings), [readings]);
  const periods = useMemo(() => availablePeriods(readings), [readings]);
  const views = useMemo(() => buildViews(stations, grouped, period), [stations, grouped, period]);
  const viewById = useMemo(() => new Map(views.map((v) => [v.station.id, v])), [views]);

  // If the chosen season no longer has data (e.g. after deleting readings), go back to latest.
  useEffect(() => {
    if (period.kind === "season" && !periods.some((p) => periodKey(p) === periodKey(period))) setPeriod({ kind: "latest" });
  }, [periods, period]);

  const heatPoints = useMemo<HeatPoint[]>(
    () => views.filter((v) => v.reading).map((v) => ({ lat: v.station.lat, lng: v.station.lng, value: v.reading!.level })),
    [views],
  );
  const heatImage = useMemo<HeatImage | null>(() => renderHeatImage(heatPoints, BOUNDARY, smooth), [heatPoints, smooth]);

  const criticalAreas = useMemo<StationView[]>(
    () => views.filter((v) => v.status === "critical" || v.status === "atrisk").sort((a, b) => b.score - a.score),
    [views],
  );

  // Load buildings when an area is opened.
  const areaStation = areaStationId ? stations.find((s) => s.id === areaStationId) : undefined;
  useEffect(() => {
    if (!areaStation) {
      setArea({ status: "idle" });
      return;
    }
    const ctrl = new AbortController();
    setArea({ status: "loading" });
    loadArea(areaStation.id, areaStation.lat, areaStation.lng, ctrl.signal)
      .then((data) => !ctrl.signal.aborted && setArea({ status: "ready", data }))
      .catch((e: Error) => !ctrl.signal.aborted && setArea({ status: "error", error: e.message }));
    return () => ctrl.abort();
  }, [areaStation, areaReload]);

  const areaView = areaStationId ? viewById.get(areaStationId) : undefined;
  const suggestions = useMemo<Suggestion[]>(() => {
    if (area.status !== "ready" || !area.data || !areaView?.reading) return [];
    const s = areaView.station;
    return rankSuggestions(area.data.features, { level: areaView.reading.level, zone: s.zone, coastal: s.coastal }, settings);
  }, [area, areaView, settings]);

  const flyTo = useCallback((lat: number, lng: number, zoom: number) => setFocus({ lat, lng, zoom, ts: Date.now() }), []);

  const selectStation = useCallback(
    (id: string | null, fly = true) => {
      setSelectedStationId(id);
      if (id) {
        const s = stations.find((x) => x.id === id);
        if (s && fly) flyTo(s.lat, s.lng, 14);
        setSheet((cur) => (cur === "min" ? "peek" : cur));
      }
    },
    [stations, flyTo],
  );

  const openArea = useCallback(
    (id: string | null) => {
      setAreaStationId(id);
      setSelectedFeature(null);
      setHoveredFeature(null);
      setMethodFilter("all");
      if (id) {
        setTab("critical");
        setSelectedStationId(null);
        const s = stations.find((x) => x.id === id);
        // Zoom 16 shows the whole 600 m circle on a laptop; phones need one step out.
        if (s) flyTo(s.lat, s.lng, window.matchMedia("(max-width: 767px)").matches ? 15 : 16);
      }
    },
    [stations, flyTo],
  );

  return {
    mode, setMode, period, setPeriod, periods, tab, setTab,
    views, viewById, grouped, heatPoints, heatImage, boundary: BOUNDARY, criticalAreas,
    selectedStationId, selectStation,
    areaStationId, openArea, area, areaView, suggestions, retryArea: () => setAreaReload((n) => n + 1),
    hoveredFeature, setHoveredFeature, selectedFeature, setSelectedFeature, methodFilter, setMethodFilter,
    placing, setPlacing, newStationAt, setNewStationAt, readingForm, setReadingForm,
    focus, flyTo, sheet, setSheet,
    mapStyle, setMapStyle, showHeat, setShowHeat, smooth, setSmooth, heatOpacity, setHeatOpacity,
  };
}

export type AppState = ReturnType<typeof useAppState>;
const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const value = useAppState();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppStateProvider");
  return v;
}
