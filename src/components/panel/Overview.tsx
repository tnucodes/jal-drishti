import { ArrowDownRight, ArrowUpRight, Download, MapPinPlus, RotateCcw, Search, TrendingDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "../../app-state";
import { FAST_FALL, formatDate, periodLabel, STATUS_META, type StationView } from "../../lib/analysis";
import { BANDS, bandFor, bandIndex } from "../../lib/bands";
import { downloadCsv } from "../../lib/csv";
import { useData } from "../../lib/store";
import { useIsMobile } from "../../lib/useMedia";
import { Button, cx, Modal, Segmented, StatusChip, useToast } from "../ui";
import { PeriodBar } from "./PeriodBar";

type Sort = "deepest" | "falling" | "name";

export function Overview() {
  const app = useApp();
  const official = app.mode === "official";
  const reporting = app.views.filter((v) => v.reading);

  return (
    <div className="space-y-5 px-4 pb-8 pt-3 md:px-5 md:pt-5">
      <PeriodBar />
      {reporting.length === 0 ? (
        <div className="card p-5 text-sm text-ink-500">No readings in {periodLabel(app.period)}.</div>
      ) : (
        <>
          <Summary views={reporting} total={app.views.length} />
          <BandBar views={reporting} />
        </>
      )}
      {official && <OfficialTools />}
      <StationList />
    </div>
  );
}

function Summary({ views, total }: { views: StationView[]; total: number }) {
  const app = useApp();
  const s = useMemo(() => {
    const levels = views.map((v) => v.reading!.level);
    const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
    const critical = views.filter((v) => v.status === "critical").length;
    const atrisk = views.filter((v) => v.status === "atrisk").length;
    const falling = views.filter((v) => (v.trend?.slope ?? 0) >= FAST_FALL).length;
    const pairs = views.filter((v) => v.previous);
    const yoy = pairs.length ? pairs.reduce((a, v) => a + (v.reading!.level - v.previous!.level), 0) / pairs.length : null;
    const deepest = [...views].sort((a, b) => b.reading!.level - a.reading!.level)[0];
    const fastest = [...views].sort((a, b) => (b.trend?.slope ?? 0) - (a.trend?.slope ?? 0))[0];
    return { avg, critical, atrisk, falling, yoy, deepest, fastest, pairs: pairs.length };
  }, [views]);

  const share = Math.round(((s.critical + s.atrisk) / views.length) * 100);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-ink-900 via-ink-800 to-brand-900 p-4 text-white shadow-card">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-white/50">{periodLabel(app.period)}</div>
        <div className="mt-1.5 text-[17px] font-semibold leading-snug">
          <span className="text-orange-300">{s.critical + s.atrisk}</span> of {views.length} stations need attention
          <span className="text-white/50"> ({share}%)</span>
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">
          Deepest water is at <b className="font-semibold text-white">{s.deepest.station.name}</b> ({s.deepest.reading!.level.toFixed(1)} m).
          {s.fastest.trend && s.fastest.trend.slope > 0 && (
            <>
              {" "}
              Fastest fall: <b className="font-semibold text-white">{s.fastest.station.name}</b>, {s.fastest.trend.slope.toFixed(2)} m deeper every year.
            </>
          )}
        </p>
        {views.length < total && (
          <p className="mt-2 text-[11px] text-white/45">
            {total - views.length === 1 ? "1 station has" : `${total - views.length} stations have`} no reading in this period.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Kpi label="Average depth" value={`${s.avg.toFixed(1)} m`} hint={bandFor(s.avg).name} color={bandFor(s.avg).color} />
        <Kpi
          label="vs a year ago"
          value={s.yoy === null ? "—" : `${s.yoy > 0 ? "+" : ""}${s.yoy.toFixed(1)} m`}
          hint={s.yoy === null ? "No data for last year" : s.yoy > 0 ? "Water went deeper" : "Water came up"}
          color={s.yoy === null ? undefined : s.yoy > 0 ? "#dc2626" : "#16a34a"}
          icon={s.yoy === null ? null : s.yoy > 0 ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
        />
        <Kpi label="Critical (> 20 m)" value={String(s.critical)} hint={`${s.atrisk} more at risk`} color={STATUS_META.critical.color} />
        <Kpi label="Falling fast" value={String(s.falling)} hint={`≥ ${FAST_FALL} m deeper / year`} color="#d97706" icon={<TrendingDown size={14} />} />
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, color, icon }: { label: string; value: string; hint: string; color?: string; icon?: React.ReactNode }) {
  return (
    <div className="card p-3.5">
      <div className="text-[11px] font-medium text-ink-500">{label}</div>
      <div className="mt-1 flex items-center gap-1 text-xl font-bold text-ink-900 tabular">
        {value}
        {icon && <span style={{ color }}>{icon}</span>}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-500">
        {color && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
        {hint}
      </div>
    </div>
  );
}

function BandBar({ views }: { views: StationView[] }) {
  const counts = BANDS.map(() => 0);
  views.forEach((v) => counts[bandIndex(v.reading!.level)]++);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="label">Stations by depth class</span>
        <span className="text-[11px] text-ink-400">CGWB classes</span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-ink-100">
        {counts.map((c, i) =>
          c ? <div key={i} style={{ width: `${(c / views.length) * 100}%`, background: BANDS[i].color }} title={`${BANDS[i].name}: ${c}`} /> : null,
        )}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-x-2 gap-y-1">
        {BANDS.map((b, i) => (
          <div key={b.name} className="flex items-center gap-1.5 text-[11px] text-ink-500">
            <span className="h-2 w-2 rounded-full" style={{ background: b.color }} />
            <span className="truncate">{b.name}</span>
            <span className="ml-auto font-semibold text-ink-800 tabular">{counts[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OfficialTools() {
  const app = useApp();
  const data = useData();
  const toast = useToast();
  const mobile = useIsMobile();
  const [confirmReset, setConfirmReset] = useState(false);

  const recent = useMemo(
    () => data.readings.filter((r) => r.source === "official").sort((a, b) => (b.savedAt ?? "").localeCompare(a.savedAt ?? "")).slice(0, 4),
    [data.readings],
  );
  const name = (id: string) => data.stations.find((s) => s.id === id)?.name ?? id;

  const exportReadings = () => {
    const byId = new Map(data.stations.map((s) => [s.id, s]));
    downloadCsv(
      `vizag-groundwater-readings-${new Date().toISOString().slice(0, 10)}.csv`,
      ["station_id", "station", "latitude", "longitude", "date", "depth_m_bgl", "source", "recorded_by", "note"],
      [...data.readings]
        .sort((a, b) => a.stationId.localeCompare(b.stationId) || a.date.localeCompare(b.date))
        .map((r) => {
          const s = byId.get(r.stationId);
          return [r.stationId, s?.name, s?.lat, s?.lng, r.date, r.level, r.source === "seed" ? "sample" : "official", r.recordedBy, r.note];
        }),
    );
  };

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-amber-900">Official tools</div>
          <div className="text-xs text-amber-800/70">Readings are saved as {data.settings.officerName}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          variant="official"
          size="sm"
          icon={<MapPinPlus size={14} />}
          onClick={() => {
            app.setPlacing(true);
            app.selectStation(null);
            if (mobile) app.setSheet("min");
          }}
        >
          Add station
        </Button>
        <Button size="sm" icon={<Download size={14} />} onClick={exportReadings}>
          Export readings
        </Button>
      </div>
      {recent.length > 0 && (
        <div className="mt-4">
          <div className="label mb-1.5 !text-amber-800/60">Recent updates</div>
          <ul className="space-y-1">
            {recent.map((r) => (
              <li key={r.id}>
                <button onClick={() => app.selectStation(r.stationId)} className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-xs hover:bg-amber-100/70">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: bandFor(r.level).color }} />
                  <span className="min-w-0 flex-1 truncate font-medium text-ink-800">{name(r.stationId)}</span>
                  <span className="tabular text-ink-600">{r.level.toFixed(1)} m</span>
                  <span className="text-ink-400">{formatDate(r.date)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button onClick={() => setConfirmReset(true)} className="mt-3 flex items-center gap-1.5 text-xs font-medium text-amber-900/60 hover:text-amber-900">
        <RotateCcw size={12} /> Reset demo data
      </button>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset demo data?"
        subtitle="All readings and stations added in this browser will be removed. The sample data comes back."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                data.dispatch({ type: "reset" });
                app.selectStation(null);
                app.openArea(null);
                app.setPeriod({ kind: "latest" });
                setConfirmReset(false);
                toast("Demo data reset");
              }}
            >
              Reset
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">Use this before a demo so everyone sees the same starting point.</p>
      </Modal>
    </div>
  );
}

function StationList() {
  const app = useApp();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("deepest");

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = app.views.filter((v) => !term || v.station.name.toLowerCase().includes(term));
    return filtered.sort((a, b) => {
      if (sort === "name") return a.station.name.localeCompare(b.station.name);
      if (sort === "falling") return (b.trend?.slope ?? -99) - (a.trend?.slope ?? -99);
      return (b.reading?.level ?? -1) - (a.reading?.level ?? -1);
    });
  }, [app.views, q, sort]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="label">Monitoring stations ({app.views.length})</span>
      </div>
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input className="input !py-2 pl-9" placeholder="Search a locality" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Segmented
        className="mt-2 w-full"
        value={sort}
        onChange={setSort}
        options={[
          { value: "deepest", label: "Deepest" },
          { value: "falling", label: "Falling fastest" },
          { value: "name", label: "A–Z" },
        ]}
      />
      <ul className="mt-2 divide-y divide-ink-100">
        {list.map((v) => (
          <li key={v.station.id}>
            <button
              onClick={() => app.selectStation(v.station.id)}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-ink-50"
            >
              <span
                className={cx("h-3 w-3 shrink-0 rounded-full ring-2 ring-white", !v.reading && "border border-dashed border-ink-400")}
                style={{ background: v.reading ? bandFor(v.reading.level).color : "#fff", boxShadow: "0 0 0 1px rgba(20,26,35,.12)" }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink-800">{v.station.name}</span>
                <span className="block text-[11px] text-ink-400">
                  {v.trend ? (
                    <span className={v.trend.slope >= FAST_FALL ? "font-medium text-red-600" : v.trend.slope < 0 ? "text-emerald-600" : undefined}>
                      {v.trend.slope >= 0 ? "▼" : "▲"} {Math.abs(v.trend.slope).toFixed(2)} m/yr
                    </span>
                  ) : (
                    "No trend yet"
                  )}
                  {v.station.coastal && " · Coastal"}
                </span>
              </span>
              {v.status && v.status !== "ok" && v.status !== "watch" && <StatusChip status={v.status} />}
              <span className="w-14 text-right text-sm font-semibold text-ink-900 tabular">{v.reading ? `${v.reading.level.toFixed(1)} m` : "—"}</span>
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="py-6 text-center text-sm text-ink-400">No station matches “{q}”.</li>}
      </ul>
    </div>
  );
}
