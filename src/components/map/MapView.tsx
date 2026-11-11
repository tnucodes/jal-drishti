import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { Circle, ImageOverlay, MapContainer, Marker, Pane, Polygon, Polyline, Popup, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { useApp } from "../../app-state";
import { bandFor } from "../../lib/bands";
import { estimateAt, type Estimate } from "../../lib/heatmap";
import { METHODS } from "../../lib/suggestions";
import { BandChip } from "../ui";
import { MapOverlays } from "./MapOverlays";

export const CITY_CENTER: [number, number] = [17.755, 83.28];
export const CITY_ZOOM = 12;

/** Fit the whole city in view. On phones, leave room for the bottom panel. */
export function fitCity(map: L.Map, boundary: [number, number][], animate = true) {
  const bounds = L.latLngBounds(boundary.map(([lng, lat]) => [lat, lng] as [number, number]));
  const mobile = window.matchMedia("(max-width: 767px)").matches;
  const bottom = mobile ? Math.round(map.getSize().y * 0.46) : 0;
  const opts = { paddingTopLeft: [10, 50] as L.PointTuple, paddingBottomRight: [10, bottom + 10] as L.PointTuple };
  if (animate) map.flyToBounds(bounds, { ...opts, duration: 0.8 });
  else map.fitBounds(bounds, { ...opts, animate: false });
}

// Free tile services that need no API key. Labels are a separate layer drawn above the heatmap,
// so place names stay readable. The light map only has detail up to zoom 16; Leaflet enlarges it after that.
const TILES = {
  light: {
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    labels: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    nativeMax: 16,
    labelsMax: 16,
    attribution: 'Base map &copy; Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  satellite: {
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    labels: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    nativeMax: 19,
    labelsMax: 14,
    attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics",
  },
};

export default function MapView() {
  const app = useApp();
  const tiles = TILES[app.mapStyle];
  const areaOpen = !!app.areaStationId;
  const [map, setMap] = useState<L.Map | null>(null);

  return (
    <div className={`relative h-full w-full ${app.placing ? "placing" : ""}`}>
      <MapContainer
        ref={setMap}
        center={CITY_CENTER}
        zoom={CITY_ZOOM}
        minZoom={10}
        zoomSnap={0.5}
        maxZoom={19}
        maxBounds={[
          [17.2, 82.8],
          [18.3, 83.8],
        ]}
        zoomControl={false}
        preferCanvas // draws 1000+ building outlines faster than SVG, important on phones
        className="h-full w-full"
        attributionControl
      >
        <TileLayer key={app.mapStyle + "-base"} url={tiles.base} attribution={tiles.attribution} maxZoom={19} maxNativeZoom={tiles.nativeMax} />

        <Pane name="heat" style={{ zIndex: 350 }}>
          {app.showHeat && app.heatImage && (
            <ImageOverlay url={app.heatImage.url} bounds={app.heatImage.bounds} opacity={areaOpen ? Math.min(0.3, app.heatOpacity) : app.heatOpacity} interactive={false} />
          )}
        </Pane>
        <Pane name="labels" style={{ zIndex: 380, pointerEvents: "none" }}>
          {/* Labels are hidden when zoomed in further; there they would be blown up and blurry. */}
          <TileLayer key={app.mapStyle + "-labels"} url={tiles.labels} maxZoom={tiles.labelsMax} pane="labels" />
        </Pane>
        <Pane name="outline" style={{ zIndex: 390, pointerEvents: "none" }}>
          <Polyline
            positions={[...app.boundary, app.boundary[0]].map(([lng, lat]) => [lat, lng] as [number, number])}
            pathOptions={{ color: app.mapStyle === "satellite" ? "#ffffff" : "#364050", weight: 1.5, opacity: 0.55, dashArray: "4 5", interactive: false }}
          />
        </Pane>
        <Pane name="areas" style={{ zIndex: 410 }}>
          <AreaLayer />
        </Pane>

        <StationLayer />
        <MapBehaviour />
      </MapContainer>
      <MapOverlays map={map} />
    </div>
  );
}

function stationIcon(color: string | null, selected: boolean, pulse: boolean, pill: string | null) {
  const cls = ["st-marker", selected && "is-selected", !color && "is-empty"].filter(Boolean).join(" ");
  const c = color ?? "#fff";
  return L.divIcon({
    className: "",
    iconSize: [16, 16],
    html: `<div class="${cls}" style="width:16px;height:16px">${pulse ? `<span class="st-pulse" style="background:${c}"></span>` : ""}<span class="st-dot" style="background:${c}"></span>${pill ? `<span class="st-pill">${pill}</span>` : ""}</div>`,
  });
}

function StationLayer() {
  const app = useApp();
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  const showValues = zoom >= 14;

  return (
    <>
      {app.views.map((v) => {
        const selected = v.station.id === app.selectedStationId || v.station.id === app.areaStationId;
        const level = v.reading?.level;
        const color = level !== undefined ? bandFor(level).color : null;
        return (
          <Marker
            key={v.station.id}
            position={[v.station.lat, v.station.lng]}
            icon={stationIcon(color, selected, selected, showValues && level !== undefined ? `${level.toFixed(1)} m` : null)}
            zIndexOffset={selected ? 1000 : v.score > 0 ? Math.round(v.score) : 0}
            eventHandlers={{
              click: () => {
                if (app.placing) return;
                app.selectStation(v.station.id, false);
              },
            }}
          >
            {!showValues && (
              <Tooltip className="station-tip" direction="top" offset={[0, -10]}>
                {v.station.name} · {level !== undefined ? `${level.toFixed(1)} m` : "no reading"}
              </Tooltip>
            )}
          </Marker>
        );
      })}
    </>
  );
}

function AreaLayer() {
  const app = useApp();
  const v = app.areaView;
  if (!v || !app.areaStationId) return null;
  const radius = app.area.data?.radius ?? 600;

  return (
    <>
      <Circle
        center={[v.station.lat, v.station.lng]}
        radius={radius}
        pane="areas"
        pathOptions={{ color: "#0a81a6", weight: 2, dashArray: "6 6", fillColor: "#0a81a6", fillOpacity: 0.04, interactive: false }}
      />
      {app.suggestions.map((s) => {
        const m = METHODS[s.method];
        const dim = app.methodFilter !== "all" && app.methodFilter !== s.method;
        const active = app.hoveredFeature === s.feature.id || app.selectedFeature === s.feature.id;
        return (
          <Polygon
            key={s.feature.id}
            positions={s.feature.ring}
            pane="areas"
            pathOptions={{
              color: active ? "#141a23" : m.color,
              weight: active ? 2.5 : 1,
              fillColor: m.color,
              fillOpacity: dim ? 0.06 : active ? 0.85 : s.tier === 1 ? 0.7 : 0.45,
              opacity: dim ? 0.2 : 1,
            }}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                app.setSelectedFeature(s.feature.id);
                app.setSheet((cur) => (cur === "min" ? "peek" : cur));
              },
              mouseover: () => app.setHoveredFeature(s.feature.id),
              mouseout: () => app.setHoveredFeature(null),
            }}
          />
        );
      })}
    </>
  );
}

/** Fly to requests, map clicks (estimate / place new station), and resize handling. */
function MapBehaviour() {
  const app = useApp();
  const map = useMap();
  const [probe, setProbe] = useState<{ lat: number; lng: number; est: Estimate | null } | null>(null);

  useEffect(() => {
    if (!app.focus) return;
    const { lat, lng, zoom } = app.focus;
    let target = L.latLng(lat, lng);
    // On phones the bottom panel covers ~half the map, so aim a bit lower to keep the spot visible.
    if (window.matchMedia("(max-width: 767px)").matches) {
      const p = map.project(target, zoom).add([0, map.getSize().y * 0.22]);
      target = map.unproject(p, zoom);
    }
    map.flyTo(target, zoom, { duration: 0.9 });
  }, [app.focus, map]);

  // Start with the whole city in view.
  const boundary = app.boundary;
  // Wait one frame so the map knows its final size (the layout settles after the first paint).
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      map.invalidateSize();
      fitCity(map, boundary, false);
    });
    return () => cancelAnimationFrame(id);
  }, [map, boundary]);

  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);

  // Close the estimate popup when the data changes.
  useEffect(() => setProbe(null), [app.heatPoints]);

  useMapEvents({
    // On phones, moving the map makes the bottom panel small so the map has room.
    dragstart: () => {
      if (window.matchMedia("(max-width: 767px)").matches) app.setSheet("min");
    },
    click: (e) => {
      if (app.placing) {
        app.setNewStationAt([e.latlng.lat, e.latlng.lng]);
        app.setPlacing(false);
        return;
      }
      if (app.areaStationId) {
        app.setSelectedFeature(null);
        return;
      }
      setProbe({ lat: e.latlng.lat, lng: e.latlng.lng, est: estimateAt(app.heatPoints, e.latlng.lat, e.latlng.lng) });
    },
  });

  const content = useMemo(() => {
    if (!probe) return null;
    const est = probe.est;
    if (!est || est.confidence === 0) {
      return (
        <div className="w-56 p-3.5 text-sm">
          <div className="font-semibold text-ink-900">No estimate here</div>
          <p className="mt-1 text-xs text-ink-500">The nearest station is {est ? `${est.nearestKm.toFixed(1)} km` : "too far"} away, so any value would be a guess.</p>
        </div>
      );
    }
    const conf = est.confidence >= 0.99 ? "High" : est.confidence >= 0.5 ? "Medium" : "Low";
    return (
      <div className="w-60 p-3.5">
        <div className="label">Estimated depth to water</div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="tabular text-2xl font-bold text-ink-900">{est.value.toFixed(1)}</span>
          <span className="text-sm text-ink-500">m below ground</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <BandChip level={est.value} size="sm" />
          <span className="text-[11px] text-ink-500">Confidence: {conf}</span>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-ink-400">
          Estimated from nearby stations (IDW). Nearest station: {est.nearestKm.toFixed(1)} km.
        </p>
      </div>
    );
  }, [probe]);

  return probe ? (
    <Popup position={[probe.lat, probe.lng]} eventHandlers={{ remove: () => setProbe(null) }} closeButton={false} autoPan={false}>
      {content}
    </Popup>
  ) : null;
}
