type Cell = string | number | null | undefined;

function escape(v: Cell): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Builds a CSV file and asks the browser to save it. */
export function downloadCsv(filename: string, header: string[], rows: Cell[][]): void {
  const text = [header, ...rows].map((r) => r.map(escape).join(",")).join("\r\n");
  // BOM so Excel opens Indian-language names correctly.
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
