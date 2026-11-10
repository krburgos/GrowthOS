/**
 * The finished-import summary, carried in the address of the page the
 * import lands on (client-confirmed 2026-11-10, approved mockup "Import
 * Finish Mockup"), so a reload can't lose it. Every key starts with "imp_",
 * so the banner can drop them all when it's closed.
 */

/** Row numbers listed per kind; beyond this the count still shows. */
const MAX_ROWS = 100;

export interface ImportSummary {
  file: string;
  /** Present only for an upload into a list. */
  addedToList?: number;
  imported: number;
  updated: number;
  unchanged: number;
  kept: number;
  restoredCompanies: number;
  noEmailCount: number;
  noEmailRows: number[];
  repeatCount: number;
  repeatRows: number[];
}

export function importSummaryParams(s: {
  file: string;
  addedToList?: number;
  imported: number;
  updated: number;
  unchanged: number;
  kept: number;
  restoredCompanies: number;
  noEmailRows: number[];
  repeatRows: number[];
}): string {
  const p = new URLSearchParams({ imp_file: s.file, imp_new: String(s.imported), imp_upd: String(s.updated) });
  if (s.addedToList !== undefined) p.set("imp_list", String(s.addedToList));
  if (s.unchanged) p.set("imp_same", String(s.unchanged));
  if (s.kept) p.set("imp_kept", String(s.kept));
  if (s.restoredCompanies) p.set("imp_rest", String(s.restoredCompanies));
  if (s.noEmailRows.length) {
    p.set("imp_ne", String(s.noEmailRows.length));
    p.set("imp_ner", s.noEmailRows.slice(0, MAX_ROWS).join("."));
  }
  if (s.repeatRows.length) {
    p.set("imp_rep", String(s.repeatRows.length));
    p.set("imp_repr", s.repeatRows.slice(0, MAX_ROWS).join("."));
  }
  return p.toString();
}

export function readImportSummary(params: URLSearchParams): ImportSummary | null {
  if (!params.has("imp_file")) return null;
  const n = (k: string) => Math.max(0, Number(params.get(k)) || 0);
  const rows = (k: string) =>
    (params.get(k) ?? "")
      .split(".")
      .map(Number)
      .filter((r) => Number.isFinite(r) && r > 0);
  return {
    file: params.get("imp_file") ?? "",
    addedToList: params.has("imp_list") ? n("imp_list") : undefined,
    imported: n("imp_new"),
    updated: n("imp_upd"),
    unchanged: n("imp_same"),
    kept: n("imp_kept"),
    restoredCompanies: n("imp_rest"),
    noEmailCount: n("imp_ne"),
    noEmailRows: rows("imp_ner"),
    repeatCount: n("imp_rep"),
    repeatRows: rows("imp_repr"),
  };
}
