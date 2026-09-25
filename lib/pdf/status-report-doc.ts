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
const TEAL_100 = "#e5f2f5";
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

const PRIORITY_COLOR: Record<string, string> = {
  high: RED_500,
  medium: AMBER_400,
  low: RULE,
};

const PRIORITY_INK: Record<string, string> = {
  high: RED_700,
  medium: AMBER_800,
  low: MUTED,
};

/**
 * The Status Report export (client-confirmed, 2026-09-25): a PDF, matching
 * the Vision Board and Questionnaire exports rather than the Reports
 * spreadsheet, because this is a document someone reads rather than a
 * dataset someone filters.
 *
 * It carries the report and the tasks that follow from it, in the order
 * the screen shows them, so the exported page answers both "where does
 * this workstream stand" and "what happens next" — a report without the
 * tasks would leave the reader with only half of what the page says.
 *
 * Poppins throughout, never pdfkit's Helvetica. The font set has no
 * italic, so de-emphasized text goes lighter in colour instead.
 */
export function renderStatusReport(doc: InstanceType<typeof PDFDocument>, data: StatusReportDoc) {
  const W = doc.page.width - M * 2;

  // ---- Masthead ----------------------------------------------------
  doc.rect(0, 0, doc.page.width, 148).fill(NAVY_950);

  doc.font(POPPINS.semibold).fontSize(9).fillColor(TEAL_300);
  doc.text(data.phaseTitle.toUpperCase(), M, 40, { characterSpacing: 1.1 });

  doc.font(POPPINS.bold).fontSize(26).fillColor(WHITE);
  doc.text(data.stepTitle, M, 58, { width: W });

  doc.font(POPPINS.regular).fontSize(10.5).fillColor("#8fa3c4");
  doc.text(`${data.accountName}  ·  Status Report  ·  ${data.quarterLabel}`, M, doc.y + 4, { width: W });

  // ---- Hours strip -------------------------------------------------
  let y = 168;
  const cells: [string, string][] = [
    ["Needed", `${fmt(data.hours.needed)} hrs`],
    ["Committed this quarter", `${fmt(data.hours.committed)} hrs`],
    ["Achieved this quarter", `${fmt(data.hours.achieved)} hrs`],
  ];
  const cw = W / 3;
  doc.rect(M, y, W, 54).fill(TINT);
  cells.forEach(([label, value], i) => {
    const x = M + cw * i;
    if (i > 0) doc.rect(x, y + 10, 0.8, 34).fill(RULE);
    doc.font(POPPINS.bold).fontSize(15).fillColor(NAVY_900).text(value, x + 16, y + 12, { width: cw - 32 });
    doc.font(POPPINS.regular).fontSize(8.5).fillColor(FAINT).text(label, x + 16, y + 33, { width: cw - 32 });
  });
  y += 54 + 26;

  // ---- Summary -----------------------------------------------------
  y = heading(doc, "Where this stands", y, W);
  if (data.summary?.trim()) {
    doc.font(POPPINS.regular).fontSize(10.5).fillColor(INK);
    doc.text(data.summary.trim(), M, y, { width: W, lineGap: 4.5 });
    y = doc.y + 22;
  } else {
    doc.font(POPPINS.regular).fontSize(10).fillColor(FAINT);
    doc.text("No status report written yet.", M, y, { width: W });
    y = doc.y + 22;
  }

  // ---- Figures -----------------------------------------------------
  if (data.stats.length > 0) {
    y = heading(doc, "The numbers", y, W);
    const perRow = 2;
    const gap = 12;
    const bw = (W - gap) / perRow;
    data.stats.forEach((s, i) => {
      const col = i % perRow;
      if (col === 0 && i > 0) y += 62;
      y = pageBreak(doc, y, 62);
      const x = M + (bw + gap) * col;
      doc.roundedRect(x, y, bw, 52, 6).fill(TINT);
      doc.font(POPPINS.bold).fontSize(15).fillColor(NAVY_900).text(s.value, x + 14, y + 9, { width: bw - 28 });
      doc.font(POPPINS.regular).fontSize(8.5).fillColor(MUTED).text(s.label, x + 14, y + 29, { width: bw - 28 });
      if (s.target) {
        doc.font(POPPINS.medium).fontSize(8).fillColor(TEAL_700).text(s.target, x + 14, y + 40, { width: bw - 28 });
      }
    });
    y += 52 + 26;
  }

  // ---- Tasks -------------------------------------------------------
  const live = data.tasks;
  if (live.length > 0) {
    y = pageBreak(doc, y, 90);
    y = heading(doc, "What to do next", y, W);

    for (const priority of ["high", "medium", "low"] as const) {
      const group = live.filter((t) => t.priority === priority);
      if (group.length === 0) continue;

      y = pageBreak(doc, y, 60);
      const groupHours = group.reduce((sum, t) => sum + t.hours, 0);
      doc.font(POPPINS.bold).fontSize(10).fillColor(PRIORITY_INK[priority]);
      doc.text(`${cap(priority)} priority`, M, y);
      doc.font(POPPINS.regular).fontSize(9).fillColor(FAINT);
      doc.text(`${group.length} ${group.length === 1 ? "task" : "tasks"} · ${fmt(groupHours)} hrs`, M, y, {
        width: W,
        align: "right",
      });
      y += 18;

      for (const task of group) {
        const detailH = task.detail
          ? doc.font(POPPINS.regular).fontSize(8.5).heightOfString(task.detail, { width: W - 150 })
          : 0;
        const rowH = Math.max(40, 26 + detailH);
        y = pageBreak(doc, y, rowH + 6);

        doc.rect(M, y, 3, rowH).fill(PRIORITY_COLOR[priority]);
        doc.rect(M + 3, y, W - 3, rowH).fill(WHITE);
        doc.rect(M, y + rowH, W, 0.7).fill(RULE);

        doc.font(POPPINS.semibold).fontSize(10).fillColor(NAVY_900);
        doc.text(task.title, M + 14, y + 8, { width: W - 160 });
        if (task.detail) {
          doc.font(POPPINS.regular).fontSize(8.5).fillColor(MUTED);
          doc.text(task.detail, M + 14, doc.y + 1, { width: W - 160 });
        }

        // Right rail: who, what state, when, how long.
        const rx = M + W - 140;
        doc.font(POPPINS.medium).fontSize(8.5).fillColor(task.assignee ? MUTED : FAINT);
        doc.text(task.assignee ? task.assignee.name : "Unassigned", rx, y + 9, { width: 136, align: "right" });

        const stateInk = task.state === "complete" ? GREEN_600 : task.state === "on_hold" ? FAINT : TEAL_700;
        doc.font(POPPINS.semibold).fontSize(8).fillColor(stateInk);
        const due = task.due_date
          ? new Date(`${task.due_date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })
          : null;
        const rail = [TASK_STATE_LABEL[task.state], `${fmt(task.hours)} hrs`, due].filter(Boolean).join("  ·  ");
        doc.text(rail, rx, y + 22, { width: 136, align: "right" });

        y += rowH + 6;
      }
      y += 10;
    }
  }

  // ---- Footer on every page ----------------------------------------
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const fy = doc.page.height - 40;
    doc.rect(M, fy - 12, W, 0.7).fill(RULE);
    doc.font(POPPINS.regular).fontSize(8).fillColor(FAINT);
    doc.text(`${data.accountName} · ${data.stepTitle} · GrowthOS`, M, fy, { width: W / 2 });
    doc.text(`${i - range.start + 1} of ${range.count}`, M + W / 2, fy, { width: W / 2, align: "right" });
  }
}

function heading(doc: InstanceType<typeof PDFDocument>, text: string, y: number, width: number) {
  const top = pageBreak(doc, y, 44);
  doc.rect(M, top + 2, 3, 13).fill(TEAL_500);
  doc.font(POPPINS.bold).fontSize(12).fillColor(NAVY_900);
  doc.text(text, M + 12, top, { width: width - 12 });
  return top + 24;
}

/** Starts a fresh page when the next block would not fit on this one. */
function pageBreak(doc: InstanceType<typeof PDFDocument>, y: number, needed: number) {
  if (y + needed > doc.page.height - 64) {
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
