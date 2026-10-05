export function toCsv(rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

export function csvDisposition(baseName: string): string {
  const ascii = baseName.replace(/[^A-Za-z0-9._-]/g, "_");
  return `attachment; filename="${ascii}.csv"; filename*=UTF-8''${encodeURIComponent(baseName)}.csv`;
}
