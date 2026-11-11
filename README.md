# Jal Drishti: groundwater monitoring for Visakhapatnam

A web prototype for an Environmental Science course project.

- A **heatmap** shows how deep the groundwater is across Visakhapatnam (colours follow the CGWB depth classes).
- **Officials** add readings at monitoring stations, and the heatmap updates right away.
- The app finds **critical areas** and suggests a **recharge method for each building** nearby
  (recharge pit, trench, borewell recharge, recharge shaft, storage, percolation pits, contour trenches).
  It also estimates the litres of rain saved per year.

> Water levels are **sample data** (made up, but realistic). Station places, city outline and buildings are real map data.

## Run it

You need [Bun](https://bun.sh).

```bash
bun install
bun run dev        # open http://localhost:5173
```

Build a static site (the `dist/` folder works on Netlify, GitHub Pages, or any web host):

```bash
bun run build
bun run preview    # check the built site locally
```

## Deploy

The app is a plain static site: no server, no database, no API keys. Build it once, then upload the `dist/` folder.

1. Install [Bun](https://bun.sh) on the machine, then in this folder run `bun install` and `bun run build`.
2. Upload `dist/` to any static host. For example:
   - **Netlify:** open app.netlify.com/drop and drag the `dist` folder onto the page.
   - **GitHub Pages:** push this repo, then publish the `dist` folder (for example with the `actions/deploy-pages` workflow).
   - **Any web server:** copy the files inside `dist/` to the web root.
3. Open the site link on a phone and check the map, a station, and one critical area.

The build uses relative paths (`base: "./"` in `vite.config.ts`), so it also works from a sub-folder such as
`username.github.io/jal-drishti/`. Pages use `#/...` links, so no server redirect rules are needed.

## 3-minute demo script

1. **Citizen view.** Show the heatmap and the legend. Press ▶ on the time bar: the map plays from 2021 to 2026, and you can see
   the city "breathe" (deep in May, higher in November) while the north-east (Madhurawada, Kommadi) gets worse every year.
2. Tap anywhere on the map: it shows the **estimated depth** at that spot and how confident the estimate is.
3. Tap **Madhurawada**: the chart shows the seasonal swing and the falling trend line.
4. Switch to **Official** (top right). Open a station → **Add reading** (for example 12 m today) → the heatmap changes at once.
5. Open **Critical areas** → pick **Gajuwaka** or **Dwaraka Nagar** → see buildings coloured by suggested method, public buildings first,
   the total water saved, and "water for N people". Switch to **satellite view** to see the real roofs. Download the CSV.
6. Open **Methods** to explain the science (IDW formula, trend, rules, water-saving formula). You can change rainfall there.
7. **Reset demo data** (in Official tools) before the next demo.

## How it works (short)

| Part | Where |
|---|---|
| Colour classes (CGWB) | `src/lib/bands.ts` |
| Seasons, trend (least squares on pre-monsoon), critical rules | `src/lib/analysis.ts` |
| Heatmap (IDW, power 2, fades out 1.5–3.5 km from stations) | `src/lib/heatmap.ts` |
| Recharge rules and water-saving formula | `src/lib/suggestions.ts` |
| Buildings from OpenStreetMap + satellite footprints | `src/lib/osm.ts`, `src/lib/areas.ts` |
| Saving data in the browser (only your changes are stored) | `src/lib/store.tsx` |
| Screens | `src/components/…`, `src/pages/Methods.tsx` |

The full explanation, in plain words, is on the **Methods** page inside the app.

## Data

| Data | Source | Script |
|---|---|---|
| City outline | GVMC boundary from OpenStreetMap, cut to the core city | `bun run data:boundary` |
| Stations + readings | 47 real localities, **sample** depths 2021–2026 | `bun run data:seed` |
| Buildings per area | OpenStreetMap + Microsoft Global ML Building Footprints | `bun run data:buildings` |

The results are already saved in `src/data/`, so you do not need to run the scripts. Run them only to change the data.
`data:buildings` is slow (OpenStreetMap servers are often busy) and downloads a 12 MB footprint file into `scripts/.cache/`.

Credits: © OpenStreetMap contributors (ODbL) · Microsoft Global ML Building Footprints (ODbL) · base maps and imagery © Esri.

## Limits (say these in the report)

- Water levels are sample data. Real data could come from CGWB, India-WRIS or APWRIMS.
- IDW uses distance only; it does not know rock type, slopes or streams.
- Many buildings have no type in OpenStreetMap; the list is a start for a field survey.
- "Official mode" is a demo switch with no real login. Data stays in one browser (localStorage).
- Rainfall (1,000 mm) and other numbers are first estimates; check them against IMD / CGWB before submitting.
