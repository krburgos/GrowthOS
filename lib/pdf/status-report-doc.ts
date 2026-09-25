import type PDFDocument from "pdfkit";

import { POPPINS } from "@/lib/pdf/poppins";
import type { KpiStat } from "@/lib/gos-dashboard/playbook";
import { TASK_STATE_LABEL, type Task } from "@/lib/gos-dashboard/tasks";

/** Design System §9 tokens, as hex — pdfkit has no CSS variables. */
const NAVY_950 = "#0a192e";
const NAVY_900 = "#022a66";
const TEAL_700 = "#028eab";
const TEAL_500 = "#03b8de";
const TEAL_300 = "#95dfee";
const GREEN_600 = "#50af28";
const AMBER_400 = "#ffde00";
const AMBER_800 = "#817103";
const RED_500 = "#ff5757";
const RED_700 = "#ad0000";
const INK = "#1e293b";
const MUTED = "#475569";
const FAINT = "#94a3b8";
const RULE = "#e2e8f0";
const TINT = "#f8fafc";
const WHITE = "#ffffff";

const M = 54;
/** Content stops here; the footer lives in the band below it. */
const FOOT = 64;

export interface StatusReportDoc {
  accountName: string;
  stepTitle: string;
  phaseTitle: string;
  quarterLabel: string;
  summary: string | null;
  stats: KpiStat[];
  tasks: Task[];
  hours: { needed: number; committed: number; achieved: number };
}

const PRIORITY_BAR: Record<string, string> = { high: RED_500, medium: AMBER_400, low: RULE };
const PRIORITY_INK: Record<string, string> = { high: RED_700, medium: AMBER_800, low: MUTED };

/**
 * The Status Report export (client-confirmed, 2026-09-25): a PDF, matching
 * the Vision Board and Questionnaire exports rather than the Reports
 * spreadsheet, because this is a document someone reads rather than a
 * dataset someone filters. It carries the report and the tasks that follow
 * from it, so the exported page answers both "where does this workstream
 * stand" and "what happens next".
 *
 * Poppins throughout, never pdfkit's Helvetica. The font set has no italic,
 * so de-emphasized text goes lighter in colour instead.
 *
 * Pagination is done by hand, through `fits`/`breakFor`, rather than by
 * letting pdfkit flow: every block here is positioned absolutely, and a
 * block that would cross the footer band starts a page instead of being
 * split down the middle. Two rules matter and are easy to get wrong —
 *
 *   1. Nothing may be drawn below `page.height - FOOT` during layout. A
 *      `doc.text()` whose baseline falls past the bottom margin makes
 *      pdfkit "continue on a new page", which is how this document once
 *      grew four blank pages: the per-page footer was written at
 *      `height - 40`, below the 54pt margin, and each write spawned a page.
 *      The footer pass therefore drops the bottom margin to zero first.
 *   2. A page break inside a multi-column row must happen before the row
 *      starts, never between its columns, or the left card lands on one
 *      page and the right card on the next.
 */
export function renderStatusReport(doc: InstanceType<typeof PDFDocument>, data: StatusReportDoc) {
  const W = doc.page.width - M * 2;

  // ---- Masthead ----------------------------------------------------
  doc.rect(0, 0, doc.page.width, 150).fill(NAVY_950);

  doc.font(POPPINS.semibold).fontSize(9).fillColor(TEAL_300);
  doc.text(data.phaseTitle.toUpperCase(), M, 40, { width: W, characterSpacing: 1.1, lineBreak: false });

  doc.font(POPPINS.bold).fontSize(24).fillColor(WHITE);
  doc.text(data.stepTitle, M, 60, { width: W });

  doc.font(POPPINS.regular).fontSize(10).fillColor("#8fa3c4");
  doc.text(`${data.accountName}  ·  Status Report  ·  ${data.quarterLabel}`, M, doc.y + 6, {
    width: W,
    lineBreak: false,
  });

  // ---- Hours strip -------------------------------------------------
  let y = 174;
  const cells: [string, string][] = [
    ["Needed", `${fmt(data.hours.needed)} hrs`],
    ["Committed this quarter", `${fmt(data.hours.committed)} hrs`],
    ["Achieved this quarter", `${fmt(data.hours.achieved)} hrs`],
  ];
  const cw = W / 3;
  doc.roundedRect(M, y, W, 56, 6).fill(TINT);
  cells.forEach(([label, value], i) => {
    const x = M + cw * i;
    if (i > 0) doc.rect(x, y + 11, 0.8, 34).fill(RULE);
    doc.font(POPPINS.bold).fontSize(15).fillColor(NAVY_900);
    doc.text(value, x + 16, y + 13, { width: cw - 32, lineBreak: false });
    doc.font(POPPINS.regular).fontSize(8.5).fillColor(FAINT);
    doc.text(label, x + 16, y + 34, { width: cw - 32, lineBreak: false });
  });
  y += 56 + 28;

  // ---- Where this stands -------------------------------------------
  y = heading(doc, "Where this stands", y, W);
  const summary = data.summary?.trim();
  if (summary) {
    doc.font(POPPINS.regular).fontSize(10.5).fillColor(INK);
    // The only block allowed to flow across pages, because a long report
    // genuinely can. Its own height decides where the next block starts.
    doc.text(summary, M, y, { width: W, lineGap: 4.5 });
    y = doc.y + 26;
  } else {
    doc.font(POPPINS.regular).fontSize(10).fillColor(FAINT);
    doc.text("No status report written yet.", M, y, { width: W, lineBreak: false });
    y += 26;
  }

  // ---- The numbers -------------------------------------------------
  if (data.stats.length > 0) {
    y = breakFor(doc, y, 44 + 60);
    y = heading(doc, "The numbers", y, W);

    const gap = 12;
    const bw = (W - gap) / 2;
    const bh = 56;
    for (let i = 0; i < data.stats.length; i += 2) {
      // Break before the row, so both cards in it land on the same page.
      y = breakFor(doc, y, bh);
      const row = data.stats.slice(i, i + 2);
      row.forEach((s, col) => {
        const x = M + (bw + gap) * col;
        doc.roundedRect(x, y, bw, bh, 6).fill(TINT);
        doc.font(POPPINS.bold).fontSize(15).fillColor(NAVY_900);
        doc.text(s.value, x + 14, y + 10, { width: bw - 28, lineBreak: false });
        doc.font(POPPINS.regular).fontSize(8.5).fillColor(MUTED);
        doc.text(s.label, x + 14, y + 30, { width: bw - 28, lineBreak: false });
        if (s.target) {
          doc.font(POPPINS.medium).fontSize(8).fillColor(TEAL_700);
          doc.text(s.target, x + 14, y + 42, { width: bw - 28, lineBreak: false });
        }
      });
      y += bh + gap;
    }
    y += 14;
  }

  // ---- What to do next ---------------------------------------------
  if (data.tasks.length > 0) {
    y = breakFor(doc, y, 44 + 40);
    y = heading(doc, "What to do next", y, W);

    for (const priority of ["high", "medium", "low"] as const) {
      const group = data.tasks.filter((t) => t.priority === priority);
      if (group.length === 0) continue;

      // Keep a group label with at least its first row.
      y = breakFor(doc, y, 24 + 44);
      const groupHours = group.reduce((sum, t) => sum + t.hours, 0);
      doc.font(POPPINS.bold).fontSize(10).fillColor(PRIORITY_INK[priority]);
      doc.text(`${cap(priority)} priority`, M, y, { width: W / 2, lineBreak: false });
      doc.font(POPPINS.regular).fontSize(9).fillColor(FAINT);
      doc.text(`${group.length} ${group.length === 1 ? "task" : "tasks"} · ${fmt(groupHours)} hrs`, M + W / 2, y, {
        width: W / 2,
        align: "right",
        lineBreak: false,
      });
      y += 20;

      for (const task of group) {
        const textW = W - 168;
        // Both the title and the detail can wrap, so both count toward the
        // row's height. Measuring only the detail used to let a two-line
        // title overlap the row below it.
        doc.font(POPPINS.semibold).fontSize(10);
        const titleH = doc.heightOfString(task.title, { width: textW });
        doc.font(POPPINS.regular).fontSize(8.5);
        const detailH = task.detail ? doc.heightOfString(task.detail, { width: textW }) : 0;
        const rowH = Math.max(42, 16 + titleH + (detailH ? detailH + 3 : 0));

        y = breakFor(doc, y, rowH + 5);

        doc.rect(M, y, 3, rowH).fill(PRIORITY_BAR[priority]);
        doc.rect(M, y + rowH + 2, W, 0.7).fill(RULE);

        doc.font(POPPINS.semibold).fontSize(10).fillColor(NAVY_900);
        doc.text(task.title, M + 14, y + 8, { width: textW });
        if (task.detail) {
          doc.font(POPPINS.regular).fontSize(8.5).fillColor(MUTED);
          doc.text(task.detail, M + 14, doc.y + 2, { width: textW });
        }

        // Right rail: who has it, then state · hours · due.
        const rx = M + W - 150;
        doc.font(POPPINS.medium).fontSize(8.5).fillColor(task.assignee ? MUTED : FAINT);
        doc.text(task.assignee ? task.assignee.name : "Unassigned", rx, y + 9, {
          width: 146,
          align: "right",
          lineBreak: false,
        });

        const stateInk = task.state === "complete" ? GREEN_600 : task.state === "on_hold" ? FAINT : TEAL_700;
        const due = task.due_date
          ? new Date(`${task.due_date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })
          : null;
        const rail = [TASK_STATE_LABEL[task.state], `${fmt(task.hours)} hrs`, due].filter(Boolean).join("  ·  ");
        doc.font(POPPINS.semibold).fontSize(8).fillColor(stateInk);
        doc.text(rail, rx, y + 23, { width: 146, align: "right", lineBreak: false });

        y += rowH + 5;
      }
      y += 12;
    }
  }

  // ---- Footer on every page ----------------------------------------
  // Must run last, and must not paginate: see rule 1 in the header comment.
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const keep = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const fy = doc.page.height - 42;
    doc.rect(M, fy - 13, W, 0.7).fill(RULE);
    doc.font(POPPINS.regular).fontSize(8).fillColor(FAINT);
    doc.text(`${data.accountName} · ${data.stepTitle}`, M, fy, { width: W * 0.7, lineBreak: false });
    doc.text(`${i - range.start + 1} of ${range.count}`, M + W * 0.7, fy, {
      width: W * 0.3,
      align: "right",
      lineBreak: false,
    });

    doc.page.margins.bottom = keep;
  }
}

function heading(doc: InstanceType<typeof PDFDocument>, text: string, y: number, width: number) {
  const top = breakFor(doc, y, 34);
  doc.rect(M, top + 2, 3, 13).fill(TEAL_500);
  doc.font(POPPINS.bold).fontSize(12).fillColor(NAVY_900);
  doc.text(text, M + 12, top, { width: width - 12, lineBreak: false });
  return top + 26;
}

/** Starts a fresh page when the next block would run into the footer band. */
function breakFor(doc: InstanceType<typeof PDFDocument>, y: number, needed: number) {
  if (y + needed > doc.page.height - FOOT) {
    doc.addPage();
    return M;
  }
  return y;
}

function fmt(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function cap(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
