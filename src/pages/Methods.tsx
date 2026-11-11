import { ArrowRight, BookOpen, CloudRain, Droplets, Gauge, Layers, MapPinned, Ruler, TriangleAlert } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { FAST_FALL } from "../lib/analysis";
import { BANDS, CRITICAL_DEPTH } from "../lib/bands";
import { FADE_END_KM, FADE_START_KM, IDW_POWER } from "../lib/heatmap";
import { AREA_RADIUS_M } from "../lib/osm";
import { DEFAULT_SETTINGS, useData } from "../lib/store";
import { formatLitres, harvestLitres, METHOD_ORDER, METHODS } from "../lib/suggestions";
import type { Settings } from "../lib/types";

export function Methods() {
  return (
    <article className="mx-auto max-w-3xl px-4 pb-24 pt-8 md:px-6 md:pt-12">
      <header>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">Environmental Science project</span>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Prototype · sample data</span>
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink-900 md:text-4xl">How Jal Drishti works</h1>
        <p className="mt-3 text-base leading-relaxed text-ink-600">
          A simple tool for a city to watch its groundwater, see where it is running low, and decide which buildings should start saving rainwater first.
          This page explains every number the app shows.
        </p>
      </header>

      <Section icon={<TriangleAlert size={18} />} title="1. The problem">
        <p>
          Visakhapatnam gets piped water from reservoirs and canals, but many homes, apartments and industries also pump groundwater through borewells. When a city
          grows faster than the rain can refill the ground, the water table falls a little every year.
        </p>
        <p>
          Much of Vizag sits on <b>hard crystalline rock</b> (mainly khondalite and charnockite of the Eastern Ghats). Hard rock holds water only in its cracks, so it fills
          up slowly and empties fast. Near the coast there is a second risk: if too much fresh water is pumped out, <b>seawater moves in</b> and wells turn salty.
        </p>
      </Section>

      <Section icon={<Ruler size={18} />} title="2. What we measure">
        <div className="grid items-center gap-5 md:grid-cols-[1fr_200px]">
          <div className="space-y-3">
            <p>
              Each station is a well (piezometer, borewell or open well). An official measures the <b>depth to water level</b>: how far down from the ground the water
              surface is, in <b>metres below ground level (m bgl)</b>.
            </p>
            <p>
              <b>Bigger number = deeper water = worse.</b> 3 m means water is close to the surface. 30 m means wells must be very deep and may go dry in summer.
            </p>
            <p>
              Like the Central Ground Water Board (CGWB), we look at two seasons: <b>pre-monsoon</b> (May, driest, water is deepest) and <b>post-monsoon</b> (November, after
              the rains). The app counts March–June as pre-monsoon and October–January as post-monsoon.
            </p>
          </div>
          <WellDiagram />
        </div>
      </Section>

      <Section icon={<Layers size={18} />} title="3. Colour classes">
        <p>The map uses the depth classes that CGWB uses on its depth-to-water maps. The names are our own simple labels.</p>
        <div className="mt-3 overflow-hidden rounded-2xl border border-ink-200/70 bg-white">
          {BANDS.map((b) => (
            <div key={b.name} className="flex items-center gap-3 border-b border-ink-100 px-4 py-2.5 last:border-0">
              <span className="h-5 w-5 shrink-0 rounded-md" style={{ background: b.color }} />
              <span className="w-16 text-sm font-semibold text-ink-800 tabular">{b.range}</span>
              <span className="w-28 text-sm font-semibold" style={{ color: b.text }}>
                {b.name}
              </span>
              <span className="text-sm text-ink-500">{b.hint}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={<MapPinned size={18} />} title="4. How the heatmap is drawn (IDW)">
        <p>
          We only know the depth at the stations. To colour the space between them, the app uses <b>Inverse Distance Weighting (IDW)</b>: for each small square of the
          map, it takes an average of all stations, where <b>nearer stations count more</b>.
        </p>
        <Formula>
          estimate = Σ ( depth<sub>i</sub> ÷ d<sub>i</sub>
          <sup>{IDW_POWER}</sup> ) ÷ Σ ( 1 ÷ d<sub>i</sub>
          <sup>{IDW_POWER}</sup> )
        </Formula>
        <p>
          Here d<sub>i</sub> is the distance to station i. With power {IDW_POWER}, a station twice as far away counts four times less.
        </p>
        <Example>
          Station A is 1 km away and shows 10 m. Station B is 2 km away and shows 30 m. Weights: A = 1 ÷ 1² = 1, B = 1 ÷ 2² = 0.25. Estimate = (10 × 1 + 30 × 0.25) ÷ (1 +
          0.25) = <b>14 m</b>. The answer is closer to A because A is nearer.
        </Example>
        <p>
          <b>Being honest about gaps:</b> far from every station the estimate is mostly a guess. So the colour is full up to {FADE_START_KM} km from the nearest station,
          fades out between {FADE_START_KM} and {FADE_END_KM} km, and is blank beyond that. Tap anywhere on the map to see the estimate and how confident it is.
        </p>
        <p>
          When an official saves a new reading, the app runs this calculation again for the whole city (a grid of about 68,000 squares, each roughly 110 m wide), so
          the heatmap updates at once.
        </p>
      </Section>

      <Section icon={<Gauge size={18} />} title="5. Trend and critical areas">
        <p>
          <b>Trend</b> = how many metres deeper the water gets each year. We fit a straight line (least squares) through the <b>pre-monsoon</b> readings only, like CGWB, so the
          normal up-and-down between seasons does not hide the long-term change.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <b>Critical</b>: water deeper than {CRITICAL_DEPTH} m.
          </li>
          <li>
            <b>At risk</b>: deeper than 10 m <i>and</i> falling {FAST_FALL} m or more per year.
          </li>
          <li>
            <b>Priority order</b> = depth + 6 × yearly fall. So a 22 m station falling 1 m/yr (score 28) comes before a 25 m station that is steady (score 25).
          </li>
        </ul>
      </Section>

      <Section icon={<Droplets size={18} />} title="6. Recharge methods">
        <p>
          For a critical area, the app looks at every building and open space within {AREA_RADIUS_M} m of the station (from OpenStreetMap) and suggests one method using
          simple rules. Methods follow the CGWB <i>Manual on Artificial Recharge of Ground Water</i>.
        </p>
        <div className="mt-3 overflow-hidden rounded-2xl border border-ink-200/70 bg-white text-sm">
          <RuleRow when="Water shallower than 3 m, or coastal and shallower than 8 m" then="storage" />
          <RuleRow when="Roof 1000 m² or more" then="shaft" />
          <RuleRow when="Roof 300–1000 m², water ≥ 15 m deep or hard rock" then="borewell" />
          <RuleRow when="Roof 300–1000 m², otherwise" then="trench" />
          <RuleRow when="Roof under 300 m²" then="pit" />
          <RuleRow when="Park / open ground on flat land" then="percolation" />
          <RuleRow when="Park / open ground in hill areas" then="contour" />
        </div>
        <p>
          <b>Public buildings come first</b> (schools, colleges, hospitals, government offices), because the city can act on them directly and they set an example. Then
          large commercial buildings, then apartments, then houses. Within each group, sites that can save more water come first.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {METHOD_ORDER.map((id) => {
            const m = METHODS[id];
            return (
              <div key={id} className="rounded-2xl border border-ink-200/70 bg-white p-4">
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded" style={{ background: m.color }} />
                  <span className="font-semibold text-ink-900">{m.name}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink-500">
                  <b className="text-ink-700">Use for:</b> {m.fit}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-500">
                  <b className="text-ink-700">How:</b> {m.build}
                </p>
              </div>
            );
          })}
        </div>
      </Section>

      <Section icon={<CloudRain size={18} />} title="7. How much water can be saved">
        <Formula>
          litres per year = area (m²) × rainfall (m) × runoff share × 1000
        </Formula>
        <p>
          <b>Runoff share</b> is the part of the rain that can be collected. A concrete roof sends most rain down the pipe; grass and soil soak up a lot themselves. To
          explain savings in human terms we divide by the city water norm of {DEFAULT_SETTINGS.lpcd} litres per person per day (CPHEEO).
        </p>
        <Assumptions />
      </Section>

      <Section icon={<BookOpen size={18} />} title="8. Data and limits">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <b>Water levels are sample data.</b> The 47 station places are real Vizag localities, but the depths are made up to follow realistic patterns (hard rock areas deep
            and falling, coastal areas shallow). Real readings could come from CGWB, India-WRIS or APWRIMS.
          </li>
          <li>
            <b>City outline</b>: the GVMC boundary from OpenStreetMap, cut to the core city (Bheemili and Anakapalli are left out).
          </li>
          <li>
            <b>Buildings</b>: OpenStreetMap (with type and name where mapped), plus roofs detected from satellite images by Microsoft (Global ML Building Footprints)
            where OpenStreetMap has gaps. A satellite roof inside a school campus or industrial area gets that type. Many buildings still have no type, so the list is a
            starting point for a field survey, not a final list.
          </li>
          <li>
            <b>IDW</b> only uses distance. It does not know about rock type, hills or streams, which also change groundwater a lot.
          </li>
          <li>
            <b>Official mode</b> is a simple switch for the demo, with no real login. Data is saved only in this browser. A real system would use a shared database and proper
            sign-in.
          </li>
        </ul>
      </Section>

      <Section icon={<BookOpen size={18} />} title="References (please check exact titles and years)">
        <ul className="list-disc space-y-1.5 pl-5 text-sm">
          <li>Central Ground Water Board (CGWB). Manual on Artificial Recharge of Ground Water, 2007.</li>
          <li>CGWB. Ground Water Year Book, Andhra Pradesh (depth-to-water classes, pre/post-monsoon surveys).</li>
          <li>CGWB. District Ground Water Brochure / Aquifer Mapping report, Visakhapatnam district.</li>
          <li>CPHEEO. Manual on Water Supply and Treatment (135 litres per person per day norm).</li>
          <li>India Meteorological Department (IMD). Rainfall normals for Visakhapatnam.</li>
          <li>India-WRIS and APWRIMS (Andhra Pradesh Water Resources Information and Management System).</li>
          <li>OpenStreetMap contributors (ODbL). Map data, GVMC boundary and building outlines.</li>
          <li>Microsoft. Global ML Building Footprints (ODbL), 2026 release.</li>
          <li>Base maps and satellite imagery © Esri and its data partners.</li>
        </ul>
      </Section>

      <div className="mt-10 flex justify-center">
        <a href="#/" className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
          Back to the map <ArrowRight size={16} />
        </a>
      </div>
    </article>
  );
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-ink-900">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-700">{icon}</span>
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-600">{children}</div>
    </section>
  );
}

function Formula({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-2xl bg-ink-900 px-5 py-4 text-center font-mono text-sm text-white md:text-base">{children}</div>;
}

function Example({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border-l-4 border-brand-400 bg-brand-50/60 px-4 py-3 text-sm text-ink-700">
      <span className="mr-1 font-semibold text-brand-800">Example.</span>
      {children}
    </div>
  );
}

function RuleRow({ when, then }: { when: string; then: keyof typeof METHODS }) {
  const m = METHODS[then];
  return (
    <div className="flex items-center gap-3 border-b border-ink-100 px-4 py-2.5 last:border-0">
      <span className="flex-1 text-ink-600">{when}</span>
      <ArrowRight size={14} className="shrink-0 text-ink-300" />
      <span className="flex w-40 shrink-0 items-center gap-2 font-semibold text-ink-800">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
        {m.name}
      </span>
    </div>
  );
}

function Assumptions() {
  const { settings, dispatch } = useData();
  const set = (patch: Partial<Settings>) => dispatch({ type: "updateSettings", settings: patch });
  const example = harvestLitres(200, settings, "building");

  return (
    <div className="mt-2 rounded-2xl border border-ink-200/70 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-ink-900">Assumptions (you can change them)</div>
        <button
          onClick={() =>
            set({ rainfallMm: DEFAULT_SETTINGS.rainfallMm, roofRunoff: DEFAULT_SETTINGS.roofRunoff, openRunoff: DEFAULT_SETTINGS.openRunoff, lpcd: DEFAULT_SETTINGS.lpcd })
          }
          className="text-xs font-semibold text-brand-700 hover:underline"
        >
          Reset
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <NumberField label="Yearly rainfall (mm)" hint="About 1,000 mm for Vizag. Check the IMD normal." value={settings.rainfallMm} min={300} max={3000} step={10} onChange={(v) => set({ rainfallMm: v })} />
        <NumberField label="Roof runoff share" hint="0.8 for concrete roofs" value={settings.roofRunoff} min={0.1} max={1} step={0.05} onChange={(v) => set({ roofRunoff: v })} />
        <NumberField label="Open ground runoff share" hint="0.2–0.3 for grass and soil" value={settings.openRunoff} min={0.05} max={1} step={0.05} onChange={(v) => set({ openRunoff: v })} />
        <NumberField label="Water per person (L/day)" hint="CPHEEO norm: 135" value={settings.lpcd} min={40} max={300} step={5} onChange={(v) => set({ lpcd: v })} />
      </div>
      <Example>
        A 200 m² concrete roof: 200 × {(settings.rainfallMm / 1000).toFixed(2)} × {settings.roofRunoff} × 1000 = <b>{formatLitres(example)}</b> a year. That is enough for about{" "}
        <b>{(example / (settings.lpcd * 365)).toFixed(1)} people</b> for a whole year.
      </Example>
    </div>
  );
}

function NumberField({ label, hint, value, min, max, step, onChange }: { label: string; hint: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  // Keep what the person types (e.g. "1" on the way to "1100"); save only valid numbers.
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const v = parseFloat(text);
  const valid = !isNaN(v) && v >= min && v <= max;

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink-600">{label}</span>
      <input
        type="number"
        className="input tabular"
        value={text}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseFloat(e.target.value);
          if (!isNaN(n) && n >= min && n <= max) onChange(n);
        }}
        // Leaving the box with a wrong value puts back the last saved one.
        onBlur={() => !valid && setText(String(value))}
      />
      {valid ? (
        <span className="mt-1 block text-[11px] text-ink-400">{hint}</span>
      ) : (
        <span className="mt-1 block text-[11px] font-medium text-red-600">
          Enter a number from {min} to {max}
        </span>
      )}
    </label>
  );
}

function WellDiagram() {
  return (
    <svg viewBox="0 0 200 220" className="mx-auto w-full max-w-[200px]" role="img" aria-label="Diagram: depth to water is measured from the ground surface down to the water in the well">
      <rect x="0" y="40" width="200" height="180" fill="#efe6d8" />
      <rect x="0" y="130" width="200" height="90" fill="#bcd7f0" />
      <path d="M0 130 Q50 124 100 130 T200 130" fill="none" stroke="#3b82f6" strokeWidth="2" />
      <rect x="0" y="34" width="200" height="8" fill="#86b36b" />
      <rect x="86" y="20" width="28" height="200" fill="#fff" stroke="#364050" strokeWidth="2" />
      <rect x="88" y="130" width="24" height="88" fill="#60a5fa" />
      <line x1="140" y1="38" x2="140" y2="128" stroke="#141a23" strokeWidth="1.5" markerEnd="url(#arr)" markerStart="url(#arr)" />
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="#141a23" />
        </marker>
      </defs>
      <text x="148" y="80" fontSize="11" fontWeight="700" fill="#141a23">Depth to</text>
      <text x="148" y="93" fontSize="11" fontWeight="700" fill="#141a23">water</text>
      <text x="148" y="106" fontSize="10" fill="#4a5566">(m bgl)</text>
      <text x="6" y="30" fontSize="10" fill="#4a5566">Ground</text>
      <text x="6" y="150" fontSize="10" fill="#1d4ed8">Water table</text>
      <text x="6" y="200" fontSize="10" fill="#1e40af">Aquifer</text>
    </svg>
  );
}
