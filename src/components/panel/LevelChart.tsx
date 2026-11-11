import { useMemo } from "react";
import { CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate, SEASON_LABEL, seasonOf } from "../../lib/analysis";
import { BANDS, bandFor } from "../../lib/bands";
import type { Reading } from "../../lib/types";

interface Point {
  t: number;
  level: number;
  date: string;
  id: string;
}

const toT = (date: string) => new Date(date + "T00:00:00Z").getTime();
const YEAR_MS = 365.25 * 86400000;

/** Depth over time. The axis is upside down: deeper water is lower on the chart, like in a real well. */
export function LevelChart({ readings, highlightId }: { readings: Reading[]; highlightId?: string }) {
  const data = useMemo<Point[]>(() => readings.map((r) => ({ t: toT(r.date), level: r.level, date: r.date, id: r.id })), [readings]);

  const yMax = Math.max(10, Math.ceil((Math.max(...data.map((d) => d.level)) + 3) / 5) * 5);

  // Straight-line trend through the pre-monsoon points (same as the trend number above the chart).
  const trend = useMemo(() => {
    const pre = data.filter((d) => seasonOf(d.date)?.season === "pre");
    const pts = pre.length >= 3 ? pre : data;
    if (pts.length < 2) return null;
    const mx = pts.reduce((a, p) => a + p.t, 0) / pts.length;
    const my = pts.reduce((a, p) => a + p.level, 0) / pts.length;
    let num = 0, den = 0;
    for (const p of pts) {
      num += (p.t - mx) * (p.level - my);
      den += (p.t - mx) ** 2;
    }
    if (!den) return null;
    const slope = num / den;
    const x0 = data[0].t, x1 = data[data.length - 1].t;
    return [
      { x: x0, y: my + slope * (x0 - mx) },
      { x: x1, y: my + slope * (x1 - mx) },
    ];
  }, [data]);

  if (data.length === 0) return <div className="flex h-48 items-center justify-center text-sm text-ink-400">No readings yet</div>;

  const firstYear = new Date(data[0].t).getUTCFullYear();
  const lastYear = new Date(data[data.length - 1].t).getUTCFullYear();
  const ticks: number[] = [];
  for (let y = firstYear; y <= lastYear + 1; y++) ticks.push(Date.UTC(y, 0, 1));
  const domain: [number, number] = [Math.min(data[0].t, ticks[0]) - YEAR_MS * 0.05, data[data.length - 1].t + YEAR_MS * 0.15];

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: -14 }}>
          {BANDS.filter((b) => b.min < yMax).map((b) => (
            <ReferenceArea key={b.name} y1={b.min} y2={Math.min(b.max, yMax)} fill={b.color} fillOpacity={0.08} strokeOpacity={0} ifOverflow="hidden" />
          ))}
          <CartesianGrid stroke="#e6ebf0" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={domain}
            ticks={ticks.filter((t) => t >= domain[0] && t <= domain[1])}
            tickFormatter={(t) => `'${String(new Date(t).getUTCFullYear()).slice(2)}`}
            tick={{ fontSize: 11, fill: "#8d99a8" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            reversed
            domain={[0, yMax]}
            tick={{ fontSize: 11, fill: "#8d99a8" }}
            tickFormatter={(v) => `${v} m`}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <ReferenceLine y={20} stroke="#ea580c" strokeDasharray="4 4" strokeOpacity={0.6} />
          {trend && <ReferenceLine segment={trend} stroke="#141a23" strokeDasharray="6 4" strokeOpacity={0.45} ifOverflow="extendDomain" />}
          <Tooltip
            cursor={{ stroke: "#c3ccd7" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as Point;
              const s = seasonOf(p.date);
              return (
                <div className="rounded-xl bg-ink-900 px-3 py-2 text-xs text-white shadow-float">
                  <div className="font-semibold">{p.level.toFixed(1)} m below ground</div>
                  <div className="text-white/60">
                    {formatDate(p.date)}
                    {s ? ` · ${SEASON_LABEL[s.season]}` : ""}
                  </div>
                </div>
              );
            }}
          />
          <Line
            dataKey="level"
            type="monotone"
            stroke="#364050"
            strokeWidth={2}
            isAnimationActive={false}
            dot={(props: { cx?: number; cy?: number; payload?: Point }) => {
              const { cx, cy, payload } = props;
              if (cx === undefined || cy === undefined || !payload) return <g key={Math.random()} />;
              const hl = payload.id === highlightId;
              return (
                <circle
                  key={payload.id}
                  cx={cx}
                  cy={cy}
                  r={hl ? 6 : 4}
                  fill={bandFor(payload.level).color}
                  stroke={hl ? "#141a23" : "#fff"}
                  strokeWidth={hl ? 2.5 : 1.5}
                />
              );
            }}
            activeDot={{ r: 6, stroke: "#141a23", strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
