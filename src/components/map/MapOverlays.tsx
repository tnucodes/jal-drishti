import type L from "leaflet";
import { ChevronDown, Crosshair, Layers, Map as MapIcon, Minus, Plus, Satellite, X } from "lucide-react";
import { useState } from "react";
import { useApp } from "../../app-state";
import { periodLabel } from "../../lib/analysis";
import { BANDS, LUT_MAX, SMOOTH_GRADIENT } from "../../lib/bands";
import { METHODS, METHOD_ORDER } from "../../lib/suggestions";
import { cx, Segmented } from "../ui";
import { fitCity } from "./MapView";

export function MapOverlays({ map }: { map: L.Map | null }) {
  const app = useApp();
  return (
    <>
      {/* Top centre: what the map shows */}
      <div className="pointer-events-none absolute inset-x-0 top-16 z-[600] flex justify-center px-3 md:top-3 md:px-16">
        {app.placing ? (
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-amber-500 py-2 pl-4 pr-2 text-sm font-semibold text-white shadow-float">
            <Crosshair size={16} />
            Tap the map to place the new station
            <button onClick={() => app.setPlacing(false)} className="rounded-lg bg-white/20 px-2 py-1 text-xs hover:bg-white/30">
              Cancel
            </button>
          </div>
        ) : (
          <div className="hidden items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-ink-700 shadow-card backdrop-blur md:flex">
            <span className="h-2 w-2 rounded-full bg-brand-500" />
            {periodLabel(app.period)}
            <span className="hidden text-ink-300 sm:inline">|</span>
            <span className="hidden font-medium text-ink-400 sm:inline">Sample data</span>
          </div>
        )}
      </div>

      {/* Right: layer + view controls */}
      <div className="absolute right-3 top-3 z-[500] flex flex-col items-end gap-2">
        <LayerMenu />
        <button
          onClick={() => map && fitCity(map, app.boundary)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-ink-700 shadow-float transition hover:bg-ink-50"
          title="Show whole city"
          aria-label="Show whole city"
        >
          <Crosshair size={18} />
        </button>
        <ZoomButtons map={map} />
      </div>

      {/* Legend */}
      <Legend />
    </>
  );
}

// Leaflet's own zoom control would clash with our overlays, so we draw matching buttons.
function ZoomButtons({ map }: { map: L.Map | null }) {
  return (
    <div className="hidden overflow-hidden rounded-xl bg-white shadow-float md:flex md:flex-col">
      <button onClick={() => map?.zoomIn()} className="flex h-10 w-10 items-center justify-center text-ink-700 hover:bg-ink-50" aria-label="Zoom in" title="Zoom in">
        <Plus size={18} />
      </button>
      <div className="h-px bg-ink-100" />
      <button onClick={() => map?.zoomOut()} className="flex h-10 w-10 items-center justify-center text-ink-700 hover:bg-ink-50" aria-label="Zoom out" title="Zoom out">
        <Minus size={18} />
      </button>
    </div>
  );
}

function LayerMenu() {
  const app = useApp();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cx("flex h-10 w-10 items-center justify-center rounded-xl shadow-float transition", open ? "bg-ink-900 text-white" : "bg-white text-ink-700 hover:bg-ink-50")}
        title="Map layers"
        aria-label="Map layers"
        aria-expanded={open}
      >
        {open ? <X size={18} /> : <Layers size={18} />}
      </button>
      {open && (
        <div className="absolute right-0 top-12 w-64 space-y-4 rounded-2xl bg-white p-4 shadow-float">
          <div>
            <div className="label mb-2">Base map</div>
            <Segmented
              className="w-full"
              value={app.mapStyle}
              onChange={app.setMapStyle}
              options={[
                { value: "light", label: <><MapIcon size={14} /> Map</> },
                { value: "satellite", label: <><Satellite size={14} /> Satellite</> },
              ]}
            />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="label">Heatmap</span>
              <Toggle checked={app.showHeat} onChange={app.setShowHeat} label="Show heatmap" />
            </div>
            <Segmented
              className="w-full"
              value={app.smooth ? "smooth" : "bands"}
              onChange={(v) => app.setSmooth(v === "smooth")}
              options={[
                { value: "smooth", label: "Smooth", title: "Colours blend smoothly" },
                { value: "bands", label: "Bands", title: "One colour per CGWB depth class" },
              ]}
            />
            <label className="mt-3 block">
              <span className="flex justify-between text-xs text-ink-500">
                <span>Opacity</span>
                <span className="tabular">{Math.round(app.heatOpacity * 100)}%</span>
              </span>
              <input
                type="range"
                min={0.2}
                max={0.95}
                step={0.05}
                value={app.heatOpacity}
                onChange={(e) => app.setHeatOpacity(+e.target.value)}
                className="mt-1 w-full accent-brand-600"
              />
            </label>
          </div>
          <p className="text-[11px] leading-snug text-ink-400">Tip: tap anywhere on the map to see the estimated depth at that spot.</p>
        </div>
      )}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx("relative h-5 w-9 rounded-full transition", checked ? "bg-brand-600" : "bg-ink-300")}
    >
      <span className={cx("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
    </button>
  );
}

function Legend() {
  const app = useApp();
  // Open by default on every screen; people can close it to see more of the map.
  const [open, setOpen] = useState(true);
  const areaOpen = !!app.areaStationId && app.suggestions.length > 0;

  return (
    <div className="absolute left-3 top-3 z-[500] md:bottom-6 md:top-auto">
      <div className={cx("overflow-hidden rounded-2xl bg-white/95 shadow-float backdrop-blur", open ? "w-[248px]" : "w-auto")}>
        <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left">
          <span className="text-xs font-bold text-ink-800">{!open ? "Legend" : areaOpen ? "Suggested methods" : "Depth to water (m below ground)"}</span>
          <ChevronDown size={16} className={cx("text-ink-400 transition", open && "rotate-180")} />
        </button>
        {open && !areaOpen && (
          <div className="px-3.5 pb-3">
            {app.smooth && (
              <div className="mb-2">
                <div className="h-2.5 rounded-full" style={{ background: SMOOTH_GRADIENT }} />
                <div className="mt-1 flex justify-between text-[10px] text-ink-400 tabular">
                  <span>0</span>
                  <span>10</span>
                  <span>20</span>
                  <span>30</span>
                  <span>40</span>
                  <span>{LUT_MAX}+</span>
                </div>
              </div>
            )}
            <ul className="space-y-1">
              {BANDS.map((b) => (
                <li key={b.name} className="flex items-center gap-2 text-xs" title={b.hint}>
                  <span className="h-3 w-3 shrink-0 rounded" style={{ background: b.color }} />
                  <span className="w-14 tabular text-ink-500">{b.range}</span>
                  <span className="font-medium text-ink-700">{b.name}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] leading-snug text-ink-400">Colour fades where no station is within ~3 km.</p>
          </div>
        )}
        {open && areaOpen && (
          <ul className="space-y-1 px-3.5 pb-3">
            {METHOD_ORDER.filter((id) => app.suggestions.some((s) => s.method === id)).map((id) => (
              <li key={id} className="flex items-center gap-2 text-xs">
                <span className="h-3 w-3 shrink-0 rounded" style={{ background: METHODS[id].color }} />
                <span className="font-medium text-ink-700">{METHODS[id].name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
