import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../../app-state";
import { formatDate, SEASON_LABEL, seasonOf, todayISO } from "../../lib/analysis";
import { bandFor } from "../../lib/bands";
import { newId, useData } from "../../lib/store";
import { BandChip, Button, Field, Modal, useToast } from "../ui";

export const MAX_DEPTH = 150;

export function ReadingForm() {
  const app = useApp();
  const data = useData();
  const toast = useToast();
  const form = app.readingForm;
  const station = form ? data.stations.find((s) => s.id === form.stationId) : undefined;
  const editing = form?.reading;

  const [date, setDate] = useState(todayISO());
  const [level, setLevel] = useState("");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!form) return;
    setDate(form.reading?.date ?? todayISO());
    setLevel(form.reading ? String(form.reading.level) : "");
    setNote(form.reading?.note ?? "");
    setTouched(false);
  }, [form]);

  if (!form || !station) return null;

  const value = parseFloat(level);
  const levelError = !level.trim() ? "Enter the depth" : isNaN(value) || value < 0 || value > MAX_DEPTH ? `Enter a number between 0 and ${MAX_DEPTH}` : undefined;
  const dateError = !date ? "Pick a date" : date > todayISO() ? "Date cannot be in the future" : undefined;
  const season = date ? seasonOf(date) : null;

  // Warn (do not block) when the value jumps a lot. Compare with the same season if we can,
  // because the normal pre/post-monsoon swing can be 10 m in hard rock.
  const before = (app.grouped.get(station.id) ?? []).filter((r) => r.id !== editing?.id && r.date <= date);
  const earlier = (season && before.filter((r) => seasonOf(r.date)?.season === season.season).pop()) || before.pop();
  const jump = earlier && !levelError ? Math.abs(value - earlier.level) : 0;

  const close = () => app.setReadingForm(null);
  const save = () => {
    setTouched(true);
    if (levelError || dateError) return;
    const rounded = Math.round(value * 100) / 100;
    if (editing) {
      data.dispatch({ type: "updateReading", reading: { ...editing, date, level: rounded, note: note.trim() || undefined, savedAt: new Date().toISOString(), recordedBy: data.settings.officerName, source: "official" } });
    } else {
      data.dispatch({
        type: "addReading",
        reading: {
          id: newId("r"),
          stationId: station.id,
          date,
          level: rounded,
          source: "official",
          recordedBy: data.settings.officerName,
          note: note.trim() || undefined,
          savedAt: new Date().toISOString(),
        },
      });
    }
    // Show the newest data so the change is visible on the heatmap right away.
    app.setPeriod({ kind: "latest" });
    close();
    toast(`${station.name}: ${rounded.toFixed(1)} m saved · heatmap updated`);
  };

  return (
    <Modal
      open
      onClose={close}
      title={editing ? "Edit reading" : "Add reading"}
      subtitle={station.name}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="official" onClick={save}>
            {editing ? "Save changes" : "Save reading"}
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
        <Field
          label="Depth to water (m below ground level)"
          error={touched ? levelError : undefined}
          hint="Measured from ground level down to the water surface in the well."
        >
          <div className="relative">
            <input
              autoFocus
              className="input pr-10 text-lg font-semibold tabular"
              inputMode="decimal"
              type="number"
              step="0.1"
              min={0}
              max={MAX_DEPTH}
              placeholder="e.g. 18.5"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-400">m</span>
          </div>
        </Field>
        {!levelError && (
          <div className="flex items-center gap-2 text-xs text-ink-500">
            <BandChip level={value} size="sm" /> {bandFor(value).hint}
          </div>
        )}
        {jump >= 8 && earlier && (
          <div className="flex gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
            <AlertTriangle size={16} className="shrink-0 text-amber-600" />
            <span>
              This is {jump.toFixed(1)} m different from the reading on {formatDate(earlier.date)} ({earlier.level.toFixed(1)} m). Please double-check before saving.
            </span>
          </div>
        )}
        <Field label="Date measured" error={touched ? dateError : undefined} hint={season ? `Counts as ${SEASON_LABEL[season.season]} ${season.year}` : "Outside the pre/post-monsoon windows. Shows under “Latest”."}>
          <input className="input" type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Note (optional)">
          <input className="input" placeholder="e.g. Pump was off for 2 hours before measuring" value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} />
        </Field>
        <p className="text-[11px] text-ink-400">Saved as {data.settings.officerName}. Data stays in this browser.</p>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
