import { Download } from "lucide-react";
import type { ReactNode } from "react";

/** App Flow §4.8 — every Reports section gets its own Export to Spreadsheet button, not one export for the whole page. */
export function ReportCard({
  title,
  subtitle,
  exportHref,
  children,
}: {
  title: string;
  subtitle?: string;
  exportHref: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3.5">
        <div>
          <h2 className="text-h4 text-primary-900">{title}</h2>
          {subtitle && <p className="text-caption text-neutral-500">{subtitle}</p>}
        </div>
        <a
          href={exportHref}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-caption font-semibold text-primary-700 transition-colors hover:border-primary-300"
        >
          <Download className="size-3.5" />
          Export
        </a>
      </div>
      {children}
    </div>
  );
}
