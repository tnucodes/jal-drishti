import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useApp } from "../../app-state";
import { periodKey, SEASON_SHORT } from "../../lib/analysis";
import type { Period } from "../../lib/types";
import { cx } from "../ui";

/** Timeline of seasons. "Play" walks through them so you can watch the water rise and fall. */
export function PeriodBar() {
  const app = useApp();
  const [playing, setPlaying] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const all: Period[] = [...app.periods, { kind: "latest" }];
  const currentKey = periodKey(app.period);

  const { periods, setPeriod } = app;
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      const i = periods.findIndex((p) => periodKey(p) === currentKey);
      if (i === -1 || i >= periods.length - 1) {
        setPlaying(false);
        setPeriod({ kind: "latest" });
      } else setPeriod(periods[i + 1]);
    }, 1100);
    return () => clearTimeout(t);
  }, [playing, currentKey, periods, setPeriod]);

  // Keep the selected chip in view (scroll only the chip row, never the page).
  const firstScroll = useRef(true);
  useEffect(() => {
    const box = scroller.current;
    const el = box?.querySelector<HTMLElement>(`[data-key="${currentKey}"]`);
    if (!box || !el) return;
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const left = box.scrollLeft + (r.left - b.left) - b.width / 2 + r.width / 2;
    box.scrollTo({ left, behavior: firstScroll.current ? "auto" : "smooth" });
    firstScroll.current = false;
  }, [currentKey]);

  const togglePlay = () => {
    if (playing) return setPlaying(false);
    if (app.period.kind === "latest" || periodKey(app.period) === periodKey(app.periods[app.periods.length - 1])) app.setPeriod(app.periods[0]);
    setPlaying(true);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="label">Time period</span>
        <span className="text-[11px] text-ink-400">Pre = May · Post = Nov</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={togglePlay}
          className={cx(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition",
            playing ? "bg-ink-900 text-white" : "bg-brand-50 text-brand-700 hover:bg-brand-100",
          )}
          aria-label={playing ? "Pause" : "Play through the years"}
          title={playing ? "Pause" : "Play through the years"}
        >
          {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>
        <div ref={scroller} className="no-scrollbar -mr-4 flex min-w-0 flex-1 gap-1.5 overflow-x-auto pr-4 md:-mr-5 md:pr-5">
          {all.map((p) => {
            const key = periodKey(p);
            const active = key === currentKey;
            return (
              <button
                key={key}
                data-key={key}
                onClick={() => {
                  setPlaying(false);
                  app.setPeriod(p);
                }}
                className={cx(
                  "flex h-9 shrink-0 flex-col items-center justify-center rounded-xl border px-2.5 leading-none transition",
                  active ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 bg-white text-ink-600 hover:border-ink-300",
                )}
              >
                {p.kind === "latest" ? (
                  <span className="text-xs font-semibold">Latest</span>
                ) : (
                  <>
                    <span className="text-[10px] font-medium opacity-70">{SEASON_SHORT[p.season]}</span>
                    <span className="mt-0.5 text-xs font-semibold tabular">{p.year}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
