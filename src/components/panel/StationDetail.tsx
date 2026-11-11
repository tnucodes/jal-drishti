import { ArrowLeft, Building2, Pencil, Plus, Trash2, Waves } from "lucide-react";
import { useState } from "react";
import { useApp } from "../../app-state";
import { FAST_FALL, formatDate, periodLabel, SEASON_LABEL, seasonOf } from "../../lib/analysis";
import { useData } from "../../lib/store";
import { BandChip, Button, IconButton, Modal, StatusChip, useToast } from "../ui";
import { KIND_LABEL, ZONE_LABEL } from "./labels";
import { LevelChart } from "./LevelChart";

export function StationDetail({ stationId }: { stationId: string }) {
  const app = useApp();
  const data = useData();
  const toast = useToast();
  const official = app.mode === "official";
  const view = app.viewById.get(stationId);
  const list = app.grouped.get(stationId) ?? [];
  const [showAll, setShowAll] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<"station" | string | null>(null);

  if (!view) {
    return (
      <div className="p-5">
        <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => app.selectStation(null)}>
          Back
        </Button>
        <p className="mt-4 text-sm text-ink-500">This station no longer exists.</p>
      </div>
    );
  }

  const { station, reading, previous, trend, status } = view;
  const season = reading ? seasonOf(reading.date) : null;
  const delta = reading && previous ? reading.level - previous.level : null;
  const history = [...list].reverse();
  const shown = showAll ? history : history.slice(0, 6);
  const canPlan = official && (status === "critical" || status === "atrisk");

  return (
    <div className="pb-8">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-ink-100 bg-white/95 px-3 py-2.5 backdrop-blur md:px-4">
        <IconButton label="Back" onClick={() => app.selectStation(null)}>
          <ArrowLeft size={18} />
        </IconButton>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold text-ink-900">{station.name}</h2>
          <div className="truncate text-xs text-ink-500">
            {KIND_LABEL[station.kind]} · {ZONE_LABEL[station.zone]}
            {station.custom && " · Added by official"}
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 pt-4 md:px-5">
        {reading ? (
          <div className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="label">Depth to water</div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-4xl font-bold tracking-tight text-ink-900 tabular">{reading.level.toFixed(1)}</span>
                  <span className="text-sm font-medium text-ink-500">m below ground</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <BandChip level={reading.level} />
                {status && status !== "critical" && <StatusChip status={status} />}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
              <span>
                {formatDate(reading.date)}
                {season && ` · ${SEASON_LABEL[season.season]}`}
              </span>
              {delta !== null && (
                <span className={delta > 0 ? "font-semibold text-red-600" : "font-semibold text-emerald-600"}>
                  {delta > 0 ? "▼" : "▲"} {Math.abs(delta).toFixed(1)} m vs a year ago
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="card p-4 text-sm text-ink-500">No reading in {periodLabel(app.period)}.</div>
        )}

        {trend && (
          <div className="flex items-center gap-3 rounded-2xl bg-ink-50 p-3.5">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold"
              style={{
                background: trend.slope >= FAST_FALL ? "#fee2e2" : trend.slope > 0 ? "#fef3c7" : "#dcfce7",
                color: trend.slope >= FAST_FALL ? "#dc2626" : trend.slope > 0 ? "#a16207" : "#15803d",
              }}
            >
              {trend.slope > 0 ? "▼" : "▲"}
            </div>
            <div className="text-sm">
              <div className="font-semibold text-ink-900">
                {trend.slope > 0.05
                  ? `Water going ${trend.slope.toFixed(2)} m deeper every year`
                  : trend.slope < -0.05
                    ? `Water rising ${Math.abs(trend.slope).toFixed(2)} m every year`
                    : "Water level is steady"}
              </div>
              <div className="text-xs text-ink-500">
                Straight-line trend of {trend.points} {trend.basis} readings
              </div>
            </div>
          </div>
        )}

        {station.coastal && (
          <div className="flex gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-3.5 text-sm">
            <Waves size={18} className="mt-0.5 shrink-0 text-sky-600" />
            <p className="text-sky-900">
              <b className="font-semibold">Coastal station.</b> Pumping too much here can pull seawater into the ground and make wells salty.
            </p>
          </div>
        )}

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="label">History</span>
            <span className="text-[11px] text-ink-400">Dashed line = trend · Orange line = 20 m</span>
          </div>
          <LevelChart readings={list} highlightId={reading?.id} />
        </div>

        {official && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="official" icon={<Plus size={16} />} onClick={() => app.setReadingForm({ stationId })} className={canPlan ? "" : "col-span-2"}>
              Add reading
            </Button>
            {canPlan && (
              <Button variant="primary" icon={<Building2 size={16} />} onClick={() => app.openArea(stationId)}>
                Plan recharge
              </Button>
            )}
          </div>
        )}

        <div>
          <div className="label mb-1.5">All readings ({list.length})</div>
          <ul className="divide-y divide-ink-100 rounded-2xl border border-ink-200/70">
            {shown.map((r) => {
              const s = seasonOf(r.date);
              return (
                <li key={r.id} className="flex items-center gap-3 px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-ink-800">{formatDate(r.date)}</span>
                      {s && <span className="rounded bg-ink-100 px-1.5 py-px text-[10px] font-semibold text-ink-500">{s.season === "pre" ? "PRE" : "POST"}</span>}
                    </div>
                    <div className="truncate text-[11px] text-ink-400">
                      {r.source === "seed" ? "Sample data" : `Added by ${r.recordedBy ?? "official"}`}
                      {r.note && ` · ${r.note}`}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-ink-900 tabular">{r.level.toFixed(1)} m</span>
                  {official && (
                    <div className="-mr-1.5 flex">
                      <IconButton label="Edit reading" onClick={() => app.setReadingForm({ stationId, reading: r })}>
                        <Pencil size={14} />
                      </IconButton>
                      <IconButton label="Delete reading" onClick={() => setConfirmDelete(r.id)} className="hover:!bg-red-50 hover:!text-red-600">
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
                  )}
                </li>
              );
            })}
            {list.length === 0 && <li className="px-3.5 py-4 text-sm text-ink-400">No readings yet.</li>}
          </ul>
          {history.length > 6 && (
            <button onClick={() => setShowAll((s) => !s)} className="mt-2 text-xs font-semibold text-brand-700 hover:underline">
              {showAll ? "Show fewer" : `Show all ${history.length} readings`}
            </button>
          )}
        </div>

        {official && station.custom && (
          <button onClick={() => setConfirmDelete("station")} className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:underline">
            <Trash2 size={13} /> Delete this station
          </button>
        )}
      </div>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={confirmDelete === "station" ? "Delete this station?" : "Delete this reading?"}
        subtitle={confirmDelete === "station" ? "The station and all its readings will be removed." : "The heatmap will update without it."}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirmDelete === "station") {
                  data.dispatch({ type: "deleteStation", id: stationId });
                  app.selectStation(null);
                  toast("Station deleted");
                } else if (confirmDelete) {
                  data.dispatch({ type: "deleteReading", id: confirmDelete });
                  toast("Reading deleted · heatmap updated");
                }
                setConfirmDelete(null);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">You can bring back the sample data later with “Reset demo data”.</p>
      </Modal>
    </div>
  );
}
