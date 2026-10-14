import type PDFDocument from "pdfkit";

import { drawLogoChip } from "@/lib/pdf/brand";
import { POPPINS } from "@/lib/pdf/poppins";
import type { KpiStat } from "@/lib/growth-mission/playbook";
import { CREDITS_PER_HOUR } from "@/lib/growth-mission/capacity";
import {
  PRIORITIES,
  PRIORITY_LABEL,
  PRIORITY_MEANING,
  ORDER_TYPE_LABEL,
  TASK_STATE_LABEL,
  byPosition,
  orderType,
  rankOrders,
  type Task,
} from "@/lib/growth-mission/tasks";

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
  hours: { required: number; committed: number; completed: number };
  /** AdvocateDash only: it is measured in drop-bys, so the strip counts targets instead of hours. */
  dropbys?: { targets: number; scheduled: number; completed: number };
}

const PRIORITY_BAR: Record<string, string> = { high: RED_500, medium: AMBER_400, low: RULE };
/** Order type tags, the same three the Mission Orders table shows. */
const TYPE_BG: Record<string, string> = { internal: "#e7ecf3", outsourced: "#e5f2f5", growthmission: NAVY_900 };
const TYPE_INK: Record<string, string> = { internal: "#113c7b", outsourced: "#056a80", growthmission: WHITE };
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
  // Measured, not fixed: a two-line discipline name ("Email Campaigning &
  // Nurture Sequences") pushed the subtitle off the navy at a fixed 150.
  doc.font(POPPINS.bold).fontSize(24);
  const titleH = doc.heightOfString(data.stepTitle, { width: W });
  const bandH = Math.max(150, 60 + titleH + 40);
  doc.rect(0, 0, doc.page.width, bandH).fill(NAVY_950);

  // Top-right, on its own white chip: half the wordmark is #113c7b,
  // which measures 1.64:1 against this navy and would vanish.
  drawLogoChip(doc, doc.page.width - M - 122, 30);

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
  let y = bandH + 24;
  // AdvocateDash shows its drop-bys, as its card on screen does (2026-10-14).
  const cells: [string, string][] = data.dropbys
    ? [
        ["Targets", String(data.dropbys.targets)],
        ["Scheduled", String(data.dropbys.scheduled)],
        ["Completed", String(data.dropbys.completed)],
      ]
    : [
        ["Required this quarter", `${Math.round(data.hours.required)} hrs`],
        ["Committed this quarter", `${Math.round(data.hours.committed)} hrs`],
        ["Completed this quarter", `${Math.round(data.hours.completed)} hrs`],
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

  // ---- Mission Orders ----------------------------------------------
  // Client-confirmed (2026-10-14): Must / Should / Could, each tier in its
  // ABC-123 order, open orders numbered and completed ones last.
  if (data.tasks.length > 0) {
    y = breakFor(doc, y, 44 + 40);
    y = heading(doc, "Mission Orders – Tasks/Tickets", y, W);
    const rank = rankOrders(data.tasks);

    for (const priority of PRIORITIES) {
      const group = data.tasks
        .filter((t) => t.priority === priority)
        .sort((a, b) => Number(a.state === "complete") - Number(b.state === "complete") || byPosition(a, b));
      if (group.length === 0) continue;

      // Keep a group label with at least its first row.
      y = breakFor(doc, y, 24 + 44);
      const groupHours = group.reduce((sum, t) => sum + t.hours, 0);
      doc.font(POPPINS.bold).fontSize(10).fillColor(PRIORITY_INK[priority]);
      doc.text(`${PRIORITY_LABEL[priority]} · ${PRIORITY_MEANING[priority]}`, M, y, { width: W / 2, lineBreak: false });
      doc.font(POPPINS.regular).fontSize(9).fillColor(FAINT);
      doc.text(`${group.length} ${group.length === 1 ? "order" : "orders"} · ${fmt(groupHours)} hrs`, M + W / 2, y, {
        width: W / 2,
        align: "right",
        lineBreak: false,
      });
      y += 20;

      for (const task of group) {
        const textW = W - 168;
        const n = rank.get(task.id);
        const title = n ? `${n}.  ${task.title}` : task.title;
        // Both the title and the detail can wrap, so both count toward the
        // row's height. Measuring only the detail used to let a two-line
        // title overlap the row below it.
        doc.font(POPPINS.semibold).fontSize(10);
        const titleH = doc.heightOfString(title, { width: textW });
        doc.font(POPPINS.regular).fontSize(8.5);
        const detailH = task.detail ? doc.heightOfString(task.detail, { width: textW }) : 0;
        const rowH = Math.max(42, 16 + titleH + (detailH ? detailH + 3 : 0));

        y = breakFor(doc, y, rowH + 5);

        doc.rect(M, y, 3, rowH).fill(PRIORITY_BAR[priority]);
        doc.rect(M, y + rowH + 2, W, 0.7).fill(RULE);

        doc.font(POPPINS.semibold).fontSize(10).fillColor(NAVY_900);
        doc.text(title, M + 14, y + 8, { width: textW });
        if (task.detail) {
          doc.font(POPPINS.regular).fontSize(8.5).fillColor(MUTED);
          doc.text(task.detail, M + 14, doc.y + 2, { width: textW });
        }

        // Right rail: the order's type tag and who has it, then state ·
        // hours (· credits) · due. The tag matches the Mission Orders table
        // (client-confirmed, 2026-10-14); a GrowthMission order has no person.
        const rx = M + W - 150;
        const type = orderType(task);
        const owner = type === "growthmission" ? null : (task.assignee?.name ?? null);
        const right = rx + 146;
        let nameW = 0;
        if (owner || !type) {
          doc.font(POPPINS.medium).fontSize(8.5).fillColor(owner ? MUTED : FAINT);
          nameW = Math.min(doc.widthOfString(owner ?? "Unassigned"), type ? 96 : 146);
          doc.text(owner ?? "Unassigned", right - nameW, y + 9, { width: nameW, lineBreak: false, ellipsis: true });
        }
        if (type) {
          const label = ORDER_TYPE_LABEL[type].toUpperCase();
          doc.font(POPPINS.bold).fontSize(6.5);
          const tw = doc.widthOfString(label, { characterSpacing: 0.3 }) + 10;
          const tx = right - nameW - (nameW ? 5 : 0) - tw;
          doc.roundedRect(tx, y + 8, tw, 12, 3).fill(TYPE_BG[type]);
          doc.fillColor(TYPE_INK[type]).text(label, tx + 5, y + 10.6, { characterSpacing: 0.3, lineBreak: false });
        }

        const stateInk = task.state === "complete" ? GREEN_600 : task.state === "on_hold" ? FAINT : TEAL_700;
        const due = task.due_date
          ? new Date(`${task.due_date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })
          : null;
        const credits = task.delegated ? `${task.hours * CREDITS_PER_HOUR} cr` : null;
        const rail = [TASK_STATE_LABEL[task.state], `${fmt(task.hours)} hrs`, credits, due].filter(Boolean).join("  ·  ");
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
