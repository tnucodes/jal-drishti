import { X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { bandFor } from "../lib/bands";
import { STATUS_META, type Status } from "../lib/analysis";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

type Variant = "primary" | "secondary" | "ghost" | "danger" | "official";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  icon,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; icon?: ReactNode }) {
  return (
    <button
      {...rest}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        variant === "primary" && "bg-brand-600 text-white shadow-sm hover:bg-brand-700",
        variant === "official" && "bg-amber-500 text-white shadow-sm hover:bg-amber-600",
        variant === "secondary" && "border border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50",
        variant === "ghost" && "text-ink-600 hover:bg-ink-100",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={cx("inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-100 hover:text-ink-800", className)}
    >
      {children}
    </button>
  );
}

export function BandChip({ level, size = "md" }: { level: number; size?: "sm" | "md" }) {
  const b = bandFor(level);
  return (
    <span
      className={cx("inline-flex items-center gap-1.5 rounded-full font-semibold", size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs")}
      style={{ background: b.soft, color: b.text }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: b.color }} />
      {b.name}
    </span>
  );
}

export function StatusChip({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: m.soft, color: m.text }}>
      {m.label}
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cx("inline-flex rounded-xl bg-ink-100 p-1", className)} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cx(
            "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition",
            value === o.value ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, subtitle, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-ink-900/40 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[92vh] w-full overflow-hidden rounded-t-3xl bg-white shadow-float sm:max-w-md sm:rounded-3xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-ink-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-ink-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <div className="scroll-thin max-h-[65vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-ink-100 bg-ink-50/60 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-ink-600">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs font-medium text-red-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-ink-400">{hint}</span> : null}
    </label>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-current border-r-transparent"
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}

/* ---------- Toasts ---------- */

interface Toast {
  id: number;
  text: ReactNode;
  tone: "success" | "info" | "error";
}

const ToastCtx = createContext<(text: ReactNode, tone?: Toast["tone"]) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const push = useCallback((text: ReactNode, tone: Toast["tone"] = "success") => {
    const id = next.current++;
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-16 z-[3000] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              "pointer-events-auto flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium shadow-float",
              t.tone === "success" && "bg-ink-900 text-white",
              t.tone === "info" && "bg-white text-ink-800",
              t.tone === "error" && "bg-red-600 text-white",
            )}
          >
            {t.tone === "success" && <span className="h-2 w-2 rounded-full bg-emerald-400" />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
