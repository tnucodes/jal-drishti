import { useEffect, useState } from "react";
import { useApp } from "../../app-state";
import { distanceKm, todayISO } from "../../lib/analysis";
import { newId, useData } from "../../lib/store";
import type { StationKind, Zone } from "../../lib/types";
import { KIND_LABEL, ZONE_LABEL } from "../panel/labels";
import { Button, Field, Modal, useToast } from "../ui";
import { MAX_DEPTH } from "./ReadingForm";

export function StationForm() {
  const app = useApp();
  const data = useData();
  const toast = useToast();
  const at = app.newStationAt;

  const [name, setName] = useState("");
  const [kind, setKind] = useState<StationKind>("borewell");
  const [zone, setZone] = useState<Zone>("urban");
  const [coastal, setCoastal] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [level, setLevel] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!at) return;
    setName("");
    setKind("borewell");
    setZone("urban");
    setCoastal(false);
    setDate(todayISO());
    setLevel("");
    setTouched(false);
  }, [at]);

  if (!at) return null;

  const nearest = data.stations
    .map((s) => ({ s, d: distanceKm(at[0], at[1], s.lat, s.lng) }))
    .sort((a, b) => a.d - b.d)[0];

  const value = parseFloat(level);
  const nameError = name.trim().length < 2 ? "Enter a name" : undefined;
  const levelError = level.trim() && (isNaN(value) || value < 0 || value > MAX_DEPTH) ? `Enter a number between 0 and ${MAX_DEPTH}` : undefined;

  const close = () => app.setNewStationAt(null);
  const save = () => {
    setTouched(true);
    if (nameError || levelError) return;
    const id = newId("st");
    data.dispatch({
      type: "addStation",
      station: { id, name: name.trim(), lat: +at[0].toFixed(5), lng: +at[1].toFixed(5), kind, zone, coastal: coastal || zone === "coastal", custom: true },
      reading: level.trim()
        ? { id: newId("r"), stationId: id, date, level: Math.round(value * 100) / 100, source: "official", recordedBy: data.settings.officerName, savedAt: new Date().toISOString() }
        : undefined,
    });
    app.setPeriod({ kind: "latest" });
    close();
    app.selectStation(id, false);
    toast(`Station “${name.trim()}” added${level.trim() ? " · heatmap updated" : ""}`);
  };

  return (
    <Modal
      open
      onClose={close}
      title="New monitoring station"
      subtitle={`${at[0].toFixed(5)}, ${at[1].toFixed(5)}${nearest ? ` · ${nearest.d.toFixed(1)} km from ${nearest.s.name}` : ""}`}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="official" onClick={save}>
            Add station
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Station name" error={touched ? nameError : undefined}>
          <input autoFocus className="input" placeholder="e.g. Ward 23 Community Hall borewell" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value as StationKind)}>
              {(Object.keys(KIND_LABEL) as StationKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Area type">
            <select className="input" value={zone} onChange={(e) => setZone(e.target.value as Zone)}>
              {(Object.keys(ZONE_LABEL) as Zone[]).map((z) => (
                <option key={z} value={z}>
                  {ZONE_LABEL[z]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <label className="flex items-center gap-2.5 text-sm text-ink-700">
          <input type="checkbox" className="h-4 w-4 rounded accent-amber-500" checked={coastal || zone === "coastal"} disabled={zone === "coastal"} onChange={(e) => setCoastal(e.target.checked)} />
          Near the sea (seawater risk)
        </label>
        <div className="rounded-2xl bg-ink-50 p-3.5">
          <div className="mb-3 text-xs font-semibold text-ink-600">First reading (optional)</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Depth (m bgl)" error={touched ? levelError : undefined}>
              <input className="input tabular" type="number" inputMode="decimal" step="0.1" min={0} max={MAX_DEPTH} placeholder="e.g. 14.2" value={level} onChange={(e) => setLevel(e.target.value)} />
            </Field>
            <Field label="Date">
              <input className="input" type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
