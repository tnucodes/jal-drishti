import { ChevronRight, Globe, Waves } from "lucide-react";
import { useApp } from "../../app-state";
import { FAST_FALL, periodLabel } from "../../lib/analysis";
import { CRITICAL_DEPTH, bandFor } from "../../lib/bands";
import { hasBundledArea } from "../../lib/areas";
import { StatusChip } from "../ui";
import { ZONE_LABEL } from "./labels";

export function CriticalList() {
  const app = useApp();
  const list = app.criticalAreas;
  const critical = list.filter((v) => v.status === "critical").length;

  return (
    <div className="px-4 pb-8 pt-2 md:px-5">
      <div className="rounded-2xl bg-ink-50 p-4">
        <div className="text-sm font-bold text-ink-900">Where to act first</div>
        <p className="mt-1 text-xs leading-relaxed text-ink-500">
          <b className="text-ink-700">Critical</b>: water deeper than {CRITICAL_DEPTH} m. <b className="text-ink-700">At risk</b>: deeper than 10 m and falling {FAST_FALL} m or
          more a year. Sorted by depth plus fall speed. Based on {periodLabel(app.period).toLowerCase()}.
        </p>
        <div className="mt-3 flex gap-2 text-xs font-semibold">
          <span className="rounded-full bg-orange-100 px-2.5 py-1 text-orange-700">{critical} critical</span>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">{list.length - critical} at risk</span>
        </div>
      </div>

      <ol className="mt-3 space-y-2">
        {list.map((v, i) => {
          const level = v.reading!.level;
          const offline = hasBundledArea(v.station.id);
          return (
            <li key={v.station.id}>
              <button
                onClick={() => app.openArea(v.station.id)}
                className="group flex w-full items-center gap-3 rounded-2xl border border-ink-200/70 bg-white p-3 text-left shadow-sm transition hover:border-brand-300 hover:shadow-card"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-ink-100 text-xs font-bold text-ink-600 tabular">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-ink-900">{v.station.name}</span>
                    {v.station.coastal && <Waves size={13} className="shrink-0 text-sky-500" aria-label="Coastal" />}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-500">
                    <span>{ZONE_LABEL[v.station.zone]}</span>
                    {v.trend && v.trend.slope > 0 && <span className="font-medium text-red-600">▼ {v.trend.slope.toFixed(2)} m/yr</span>}
                    {!offline && (
                      <span className="flex items-center gap-1 text-ink-400" title="Buildings load live from OpenStreetMap">
                        <Globe size={11} /> live
                      </span>
                    )}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <span className="text-sm font-bold tabular" style={{ color: bandFor(level).text }}>
                    {level.toFixed(1)} m
                  </span>
                  <StatusChip status={v.status!} />
                </span>
                <ChevronRight size={16} className="shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
              </button>
            </li>
          );
        })}
        {list.length === 0 && <li className="rounded-2xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">No critical areas in this period. 🎉</li>}
      </ol>
    </div>
  );
}
