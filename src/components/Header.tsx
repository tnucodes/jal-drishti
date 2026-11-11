import { BookOpen, Check, Map as MapIcon, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useApp } from "../app-state";
import { useData } from "../lib/store";
import { cx, useToast } from "./ui";

export type Route = "map" | "methods";

export function Header({ route }: { route: Route }) {
  const app = useApp();
  const official = app.mode === "official";
  const toast = useToast();

  return (
    <header className="no-print relative z-[1000] flex h-14 shrink-0 items-center gap-1.5 border-b border-ink-200/70 bg-white px-3 md:gap-4 md:px-4">
      <a href="#/" className="flex min-w-0 items-center gap-2.5">
        <img src="./favicon.svg" alt="" className="h-8 w-8 shrink-0" />
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[15px] font-bold tracking-tight text-ink-900">Jal Drishti</span>
          <span className="hidden truncate text-[11px] text-ink-500 sm:block">Groundwater monitor · Visakhapatnam</span>
        </span>
      </a>

      <nav className="flex items-center md:ml-4 md:gap-1">
        <NavLink href="#/" active={route === "map"} icon={<MapIcon size={16} />} label="Map" />
        <NavLink href="#/methods" active={route === "methods"} icon={<BookOpen size={16} />} label="Methods" />
      </nav>

      <div className="ml-auto flex items-center gap-2">
        {official && <OfficerName />}
        <div className="flex rounded-xl bg-ink-100 p-1" role="radiogroup" aria-label="Mode">
          <button
            role="radio"
            aria-checked={!official}
            onClick={() => app.setMode("citizen")}
            className={cx("flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition", !official ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800")}
          >
            <UserRound size={14} />
            <span className="hidden sm:inline">Citizen</span>
          </button>
          <button
            role="radio"
            aria-checked={official}
            onClick={() => {
              if (!official) toast("Official mode on: add readings and plan recharge", "info");
              app.setMode("official");
            }}
            className={cx("flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition", official ? "bg-amber-500 text-white shadow-sm" : "text-ink-500 hover:text-ink-800")}
          >
            <ShieldCheck size={14} />
            <span>Official</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, active, icon, label }: { href: string; active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold transition",
        active ? "bg-brand-50 text-brand-700" : "text-ink-500 hover:bg-ink-50 hover:text-ink-800",
      )}
      title={label}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </a>
  );
}

/** Name saved with each reading, so there is a simple record of who changed what. */
function OfficerName() {
  const { settings, dispatch } = useData();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(settings.officerName);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setValue(settings.officerName);
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, settings.officerName]);

  const save = () => {
    const v = value.trim();
    if (v) dispatch({ type: "updateSettings", settings: { officerName: v.slice(0, 40) } });
    setOpen(false);
  };

  return (
    <div className="relative hidden sm:block" ref={box}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 max-w-[180px] items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-2.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
        title="Change the name saved with readings"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
          {settings.officerName.trim().charAt(0).toUpperCase() || "F"}
        </span>
        <span className="truncate">{settings.officerName}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-11 w-64 rounded-2xl bg-white p-3.5 shadow-float">
          <div className="text-xs font-semibold text-ink-700">Your name</div>
          <p className="mb-2 text-[11px] text-ink-400">Saved with every reading you add.</p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <input className="input !py-2" value={value} onChange={(e) => setValue(e.target.value)} autoFocus maxLength={40} />
            <button type="submit" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white hover:bg-amber-600" aria-label="Save name">
              <Check size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
