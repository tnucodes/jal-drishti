import { useApp } from "../../app-state";
import { useIsMobile } from "../../lib/useMedia";
import { cx } from "../ui";
import { AreaDetail } from "./AreaDetail";
import { CriticalList } from "./CriticalList";
import { Overview } from "./Overview";
import { StationDetail } from "./StationDetail";

const SHEET_HEIGHT = { min: "84px", peek: "46%", full: "92%" } as const;

export default function Sidebar() {
  const app = useApp();
  const mobile = useIsMobile();
  const official = app.mode === "official";

  let body: JSX.Element;
  let key: string;
  if (app.selectedStationId) {
    body = <StationDetail stationId={app.selectedStationId} />;
    key = "station-" + app.selectedStationId;
  } else if (official && app.tab === "critical" && app.areaStationId) {
    body = <AreaDetail />;
    key = "area-" + app.areaStationId;
  } else {
    key = "tab-" + app.tab;
    body = (
      <>
        {official && (
          <div className="sticky top-0 z-10 bg-white/95 px-4 pb-2 pt-3 backdrop-blur md:px-5 md:pt-4">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-ink-100 p-1">
              {(["overview", "critical"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => app.setTab(t)}
                  className={cx(
                    "flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition",
                    app.tab === t ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800",
                  )}
                >
                  {t === "overview" ? "City overview" : "Critical areas"}
                  {t === "critical" && (
                    <span className="rounded-full bg-orange-100 px-1.5 text-[10px] font-bold text-orange-700 tabular">{app.criticalAreas.length}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        {official && app.tab === "critical" ? <CriticalList /> : <Overview />}
      </>
    );
  }

  return (
    <aside
      className={cx(
        "flex flex-col bg-white",
        mobile ? "sheet absolute inset-x-0 bottom-0 z-[800] rounded-t-3xl shadow-[0_-8px_30px_rgba(20,26,35,.18)]" : "relative z-10 h-full w-[400px] shrink-0 border-r border-ink-200/70 lg:w-[420px]",
      )}
      style={mobile ? { height: SHEET_HEIGHT[app.sheet] } : undefined}
    >
      {mobile && (
        <button
          className="flex w-full shrink-0 flex-col items-center pb-1 pt-2.5"
          onClick={() => app.setSheet(app.sheet === "full" ? "peek" : app.sheet === "peek" ? "full" : "peek")}
          aria-label={app.sheet === "full" ? "Make panel smaller" : "Make panel bigger"}
        >
          <span className="h-1.5 w-10 rounded-full bg-ink-200" />
        </button>
      )}
      <div key={key} className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {body}
      </div>
    </aside>
  );
}
