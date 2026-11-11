import { ArrowLeft, Download, Landmark, RefreshCw, Satellite, Users, Waves } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../../app-state";
import { FAST_FALL } from "../../lib/analysis";
import { downloadCsv } from "../../lib/csv";
import { isSatellite } from "../../lib/osm";
import { useData } from "../../lib/store";
import { formatLitres, formatMillionLitres, METHOD_ORDER, METHODS, TIER_LABEL, type Suggestion } from "../../lib/suggestions";
import { BandChip, Button, cx, IconButton, Spinner, StatusChip } from "../ui";
import { ZONE_LABEL } from "./labels";

const PAGE = 40;

export function AreaDetail() {
  const app = useApp();
  const { settings } = useData();
  const view = app.areaView;
  const [limit, setLimit] = useState(PAGE);
  const itemRefs = useRef(new Map<number, HTMLLIElement>());

  const filtered = useMemo(
    () => (app.methodFilter === "all" ? app.suggestions : app.suggestions.filter((s) => s.method === app.methodFilter)),
    [app.suggestions, app.methodFilter],
  );

  const totals = useMemo(() => {
    const litres = app.suggestions.reduce((a, s) => a + s.litres, 0);
    const byMethod = METHOD_ORDER.map((id) => {
      const list = app.suggestions.filter((s) => s.method === id);
      return { id, count: list.length, litres: list.reduce((a, s) => a + s.litres, 0) };
    }).filter((m) => m.count > 0);
    const publicCount = app.suggestions.filter((s) => s.tier === 1).length;
    const people = litres / (settings.lpcd * 365);
    const satellite = app.suggestions.filter((s) => isSatellite(s.feature)).length;
    return { litres, byMethod, publicCount, people, satellite, osm: app.suggestions.length - satellite };
  }, [app.suggestions, settings.lpcd]);

  // When a building is tapped on the map, show it in the list.
  useEffect(() => {
    if (app.selectedFeature === null) return;
    const idx = filtered.findIndex((s) => s.feature.id === app.selectedFeature);
    if (idx >= limit) setLimit(idx + 10);
    requestAnimationFrame(() => itemRefs.current.get(app.selectedFeature!)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }, [app.selectedFeature, filtered, limit]);

  if (!view || !view.reading) return null;
  const { station, reading, trend, status } = view;

  const exportCsv = () => {
    downloadCsv(
      `recharge-plan-${station.id}-${new Date().toISOString().slice(0, 10)}.csv`,
      ["rank", "source", "osm_id", "type", "name", "priority_group", "area_m2", "suggested_method", "litres_per_year", "latitude", "longitude", "osm_link", "why"],
      filtered.map((s, i) => {
        const [lat, lng] = centroid(s);
        const sat = isSatellite(s.feature);
        return [
          i + 1,
          sat ? "satellite (Microsoft)" : "OpenStreetMap",
          sat ? "" : s.feature.id,
          s.typeLabel,
          s.feature.name,
          TIER_LABEL[s.tier],
          Math.round(s.feature.area),
          METHODS[s.method].name,
          Math.round(s.litres),
          lat.toFixed(6),
          lng.toFixed(6),
          sat ? `https://www.openstreetmap.org/#map=19/${lat.toFixed(6)}/${lng.toFixed(6)}` : `https://www.openstreetmap.org/way/${s.feature.id}`,
          s.reasons.join(" "),
        ];
      }),
    );
  };

  return (
    <div className="pb-8">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-ink-100 bg-white/95 px-3 py-2.5 backdrop-blur md:px-4">
        <IconButton label="Back to critical areas" onClick={() => app.openArea(null)}>
          <ArrowLeft size={18} />
        </IconButton>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold text-ink-900">{station.name}</h2>
          <div className="text-xs text-ink-500">Recharge plan · 600 m around the station</div>
        </div>
        {app.area.status === "ready" && (
          <IconButton label="Download plan as CSV" onClick={exportCsv}>
            <Download size={17} />
          </IconButton>
        )}
      </div>

      <div className="space-y-4 px-4 pt-4 md:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-2xl font-bold text-ink-900 tabular">{reading.level.toFixed(1)} m</span>
          <BandChip level={reading.level} />
          {status && status !== "critical" && <StatusChip status={status} />}
          <span className="w-full text-xs text-ink-500">
            {ZONE_LABEL[station.zone]}
            {trend && trend.slope > 0 && (
              <span className={trend.slope >= FAST_FALL ? "font-semibold text-red-600" : undefined}> · going {trend.slope.toFixed(2)} m deeper a year</span>
            )}
          </span>
          {station.coastal && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-sky-700">
              <Waves size={13} /> Coastal: also reduce borewell pumping
            </span>
          )}
        </div>

        {app.area.status === "loading" && (
          <div className="card flex items-center gap-3 p-4 text-sm text-ink-600">
            <Spinner /> Loading buildings from OpenStreetMap…
          </div>
        )}
        {app.area.status === "error" && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <div className="font-semibold">Could not load buildings</div>
            <p className="mt-1 text-xs text-red-700">OpenStreetMap servers may be busy or you may be offline. ({app.area.error})</p>
            <Button size="sm" className="mt-3" icon={<RefreshCw size={13} />} onClick={app.retryArea}>
              Try again
            </Button>
          </div>
        )}

        {app.area.status === "ready" && (
          <>
            <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 p-4 text-white shadow-card">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-white/60">If every suggested site acts</div>
              <div className="mt-1 text-3xl font-bold tracking-tight tabular">{formatMillionLitres(totals.litres)}</div>
              <div className="text-sm text-white/75">of rainwater saved into the ground every year</div>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/15 pt-3 text-center">
                <Stat icon={<Users size={14} />} value={Math.round(totals.people).toLocaleString("en-IN")} label="people's yearly water" />
                <Stat value={app.suggestions.length.toLocaleString("en-IN")} label="sites" />
                <Stat icon={<Landmark size={14} />} value={String(totals.publicCount)} label="public buildings" />
              </div>
              <p className="mt-2 text-[10px] leading-snug text-white/50">
                Rain {settings.rainfallMm} mm/yr × roof area × {settings.roofRunoff} (roof) or {settings.openRunoff} (open ground). People at {settings.lpcd} L/day. Change these on the Methods page.
              </p>
            </div>

            <div>
              <div className="label mb-2">Filter by method</div>
              <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:-mx-5 md:px-5">
                <MethodChip active={app.methodFilter === "all"} onClick={() => app.setMethodFilter("all")} label="All" count={app.suggestions.length} />
                {totals.byMethod.map((m) => (
                  <MethodChip
                    key={m.id}
                    active={app.methodFilter === m.id}
                    onClick={() => app.setMethodFilter(app.methodFilter === m.id ? "all" : m.id)}
                    label={METHODS[m.id].name}
                    count={m.count}
                    color={METHODS[m.id].color}
                  />
                ))}
              </div>
            </div>

            {app.methodFilter !== "all" && (
              <div className="rounded-2xl border border-ink-200/70 p-3.5 text-xs leading-relaxed text-ink-600">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink-900">
                  <span className="h-3 w-3 rounded" style={{ background: METHODS[app.methodFilter].color }} />
                  {METHODS[app.methodFilter].name}
                </div>
                <p>
                  <b className="text-ink-700">Use for:</b> {METHODS[app.methodFilter].fit}
                </p>
                <p className="mt-1">
                  <b className="text-ink-700">How:</b> {METHODS[app.methodFilter].build}
                </p>
              </div>
            )}

            {app.mapStyle !== "satellite" && (
              <button
                onClick={() => app.setMapStyle("satellite")}
                className="flex w-full items-center gap-2 rounded-xl bg-ink-50 px-3 py-2 text-left text-xs text-ink-600 hover:bg-ink-100"
              >
                <Satellite size={14} className="text-ink-500" /> Tip: switch to <b className="font-semibold">satellite view</b> to see the real roofs.
              </button>
            )}

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="label">Sites, public buildings first ({filtered.length})</span>
              </div>
              <ul className="space-y-1.5">
                {filtered.slice(0, limit).map((s, i) => (
                  <SiteRow
                    key={s.feature.id}
                    s={s}
                    rank={i + 1}
                    refFn={(el) => (el ? itemRefs.current.set(s.feature.id, el) : itemRefs.current.delete(s.feature.id))}
                  />
                ))}
              </ul>
              {filtered.length > limit && (
                <Button className="mt-3 w-full" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
                  Show {Math.min(PAGE, filtered.length - limit)} more
                </Button>
              )}
              {filtered.length === 0 && <p className="py-6 text-center text-sm text-ink-400">No buildings found here in OpenStreetMap.</p>}
            </div>

            <p className="text-[11px] leading-snug text-ink-400">
              {totals.osm.toLocaleString("en-IN")} sites from © OpenStreetMap contributors
              {totals.satellite > 0 && <>, {totals.satellite.toLocaleString("en-IN")} roofs seen from satellite (Microsoft Global ML Building Footprints, ODbL)</>} ·{" "}
              {app.area.data?.source === "bundled" ? "saved with the app" : app.area.data?.source === "browser" ? "saved in this browser" : "loaded live"}, {app.area.data?.fetchedAt}. Some
              buildings may be missing or have no type. Sizes and methods are first estimates; a site visit is needed before building anything.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function centroid(s: Suggestion): [number, number] {
  const r = s.feature.ring;
  return [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[1], 0) / r.length];
}

function Stat({ value, label, icon }: { value: string; label: string; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-center gap-1 text-base font-bold tabular">
        {icon && <span className="text-white/60">{icon}</span>}
        {value}
      </div>
      <div className="text-[10px] leading-tight text-white/60">{label}</div>
    </div>
  );
}

function MethodChip({ active, onClick, label, count, color }: { active: boolean; onClick: () => void; label: string; count: number; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition",
        active ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 bg-white text-ink-600 hover:border-ink-300",
      )}
    >
      {color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />}
      {label}
      <span className={cx("tabular", active ? "text-white/60" : "text-ink-400")}>{count}</span>
    </button>
  );
}

function SiteRow({ s, rank, refFn }: { s: Suggestion; rank: number; refFn: (el: HTMLLIElement | null) => void }) {
  const app = useApp();
  const m = METHODS[s.method];
  const selected = app.selectedFeature === s.feature.id;
  const hovered = app.hoveredFeature === s.feature.id;

  return (
    <li
      ref={refFn}
      onMouseEnter={() => app.setHoveredFeature(s.feature.id)}
      onMouseLeave={() => app.setHoveredFeature(null)}
      className={cx(
        "rounded-2xl border transition",
        selected ? "border-ink-900 bg-white shadow-card" : hovered ? "border-ink-300 bg-ink-50" : "border-ink-200/70 bg-white",
      )}
    >
      <button
        onClick={() => {
          app.setSelectedFeature(selected ? null : s.feature.id);
          if (!selected) {
            const [lat, lng] = centroid(s);
            app.flyTo(lat, lng, 18);
          }
        }}
        aria-expanded={selected}
        className="w-full p-3 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="w-5 shrink-0 text-center text-[11px] font-semibold text-ink-400 tabular">{rank}</span>
          <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: m.color }} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-ink-900">{s.feature.name ?? s.typeLabel}</span>
              {s.tier === 1 && <span className="shrink-0 rounded bg-brand-50 px-1.5 py-px text-[10px] font-bold text-brand-700">PUBLIC</span>}
            </span>
            <span className="block truncate text-[11px] text-ink-500">
              {s.feature.name ? `${s.typeLabel} · ` : ""}
              {Math.round(s.feature.area).toLocaleString("en-IN")} m² · <span style={{ color: m.color }} className="font-semibold">{m.name}</span>
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block text-sm font-bold text-ink-900 tabular">{formatLitres(s.litres)}</span>
            <span className="block text-[10px] text-ink-400">per year</span>
          </span>
        </div>
      </button>
      {selected && (
          <div className="mx-3 mb-3 space-y-2 border-t border-ink-100 pt-3 text-xs leading-relaxed text-ink-600">
            <ul className="list-disc space-y-1 pl-4">
              {s.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="rounded-xl bg-ink-50 p-2.5">
              <b className="text-ink-800">How to build:</b> {m.build}
            </p>
            <a
              href={
                isSatellite(s.feature)
                  ? `https://www.openstreetmap.org/#map=19/${centroid(s)[0].toFixed(6)}/${centroid(s)[1].toFixed(6)}`
                  : `https://www.openstreetmap.org/way/${s.feature.id}`
              }
              target="_blank"
              rel="noreferrer"
              className="inline-block font-semibold text-brand-700 hover:underline"
            >
              View on OpenStreetMap ↗
            </a>
          </div>
        )}
    </li>
  );
}
