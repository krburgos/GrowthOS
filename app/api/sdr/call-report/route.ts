import PDFDocument from "pdfkit";
import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/get-current-user";
import { renderCallReport } from "@/lib/pdf/call-report-doc";
import { registerPoppins } from "@/lib/pdf/poppins";
import { OUTCOME_ORDER } from "@/lib/sdr/call-style";
import { CONNECTED_OUTCOMES, OUTCOME_LABEL, VIEW_ANY_QUEUE_ROLES, type CallOutcome } from "@/lib/sdr/desk";
import { createClient } from "@/lib/supabase/server";

const PAGE = 1000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

interface CallRow {
  user_id: string | null;
  call_outcome: CallOutcome | null;
  contact_id: string | null;
  body?: string | null;
  contacts?: { full_name: string | null; companies: { name: string | null } | null } | null;
}

/**
 * GET /api/sdr/call-report — the Call Logs totals as a one-page PDF
 * (client-confirmed, 2026-11-08, approved mockup "Call Logs PDF Export
 * Mockup").
 *
 * Query: start, end (ISO instants, [start, end) in the viewer's timezone,
 * the same bounds Call Logs reads with), fromDay, toDay (YYYY-MM-DD, the
 * period as the viewer sees it, for the label), tz (the viewer's IANA
 * timezone, for the export date), and the optional filters sdr, outcome,
 * list and q, applied exactly as Call Logs applies them on screen.
 *
 * Ordinary session client under RLS, like the other PDF routes. Someone
 * who may only see their own queue gets only their own calls, whatever
 * `sdr` says, matching Call Logs. Unlike the screen, which stops at the
 * latest 2,000 calls, this pages through every call in the period, so the
 * totals are complete.
 *
 * Poppins and the logo are read from disk, so this route is listed under
 * `outputFileTracingIncludes` in next.config.ts.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.account_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const accountId = user.account_id;

  const p = request.nextUrl.searchParams;
  const start = new Date(p.get("start") ?? "");
  const end = new Date(p.get("end") ?? "");
  const fromDay = p.get("fromDay") ?? "";
  const toDay = p.get("toDay") ?? "";
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start || !DAY.test(fromDay) || !DAY.test(toDay)) {
    return NextResponse.json({ error: "Pick a valid date range." }, { status: 400 });
  }
  const canViewAny = VIEW_ANY_QUEUE_ROLES.includes(user.role);
  const sdr = canViewAny ? p.get("sdr") || null : user.id;
  const outcomeParam = p.get("outcome");
  const outcome = outcomeParam && outcomeParam in OUTCOME_LABEL ? (outcomeParam as CallOutcome) : null;
  const listId = p.get("list") || null;
  const q = (p.get("q") ?? "").trim().toLowerCase().slice(0, 200);
  const tz = validTimeZone(p.get("tz"));

  const supabase = await createClient();

  // Every call in the period, a page at a time. Search needs the contact and note.
  const calls: CallRow[] = [];
  const select = q
    ? "id, user_id, call_outcome, contact_id, body, contacts(full_name, companies(name))"
    : "id, user_id, call_outcome, contact_id";
  for (let from = 0; ; from += PAGE) {
    let query = supabase
      .from("activities")
      .select(select)
      .eq("account_id", accountId)
      .eq("type", "call")
      .is("archived_at", null)
      .gte("occurred_at", start.toISOString())
      .lt("occurred_at", end.toISOString())
      .order("id")
      .range(from, from + PAGE - 1);
    if (sdr) query = query.eq("user_id", sdr);
    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: "Couldn't load calls." }, { status: 500 });
    }
    calls.push(...((data ?? []) as unknown as CallRow[]));
    if (!data || data.length < PAGE) break;
  }

  // The list's members, when a list is chosen, and its name for the filters line.
  let listName = "All lists";
  let members: Set<string> | null = null;
  if (listId) {
    const { data: list } = await supabase.from("lists").select("name").eq("id", listId).eq("account_id", accountId).maybeSingle();
    if (!list) return NextResponse.json({ error: "No such list." }, { status: 404 });
    listName = list.name;
    members = new Set();
    for (let from = 0; ; from += PAGE) {
      const { data } = await supabase.from("list_members").select("contact_id").eq("list_id", listId).range(from, from + PAGE - 1);
      for (const r of data ?? []) members.add(r.contact_id);
      if (!data || data.length < PAGE) break;
    }
  }

  // The same filters, in the same order, as Call Logs' `searched` and `shown`.
  const searched = calls.filter(
    (c) =>
      (!members || (c.contact_id && members.has(c.contact_id))) &&
      (!q || [c.contacts?.full_name, c.contacts?.companies?.name, c.body].filter(Boolean).join(" ").toLowerCase().includes(q))
  );
  const shown = outcome ? searched.filter((c) => c.call_outcome === outcome) : searched;
  const count = (o: CallOutcome) => shown.filter((c) => c.call_outcome === o).length;

  const [{ data: account }, sdrName] = await Promise.all([
    supabase.from("accounts").select("name").eq("id", accountId).maybeSingle(),
    sdr ? nameOf(supabase, accountId, sdr) : Promise.resolve("Everyone"),
  ]);
  const accountName = account?.name ?? "GrowthMission Account";

  const filters: [string, string][] = [
    ["SDR", sdrName],
    ["List", listName],
  ];
  if (outcome) filters.push(["Outcome", OUTCOME_LABEL[outcome]]);
  if (q) filters.push(["Search", `“${p.get("q")!.trim().slice(0, 60)}”`]);

  const doc = new PDFDocument({ size: "LETTER", margin: 54, bufferPages: true });
  registerPoppins(doc);
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  renderCallReport(doc, {
    accountName,
    periodLabel: periodLabel(fromDay, toDay),
    exportedLabel: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: tz }),
    filters,
    calls: shown.length,
    connects: shown.filter((c) => c.call_outcome && CONNECTED_OUTCOMES.includes(c.call_outcome)).length,
    meetings: count("meeting_booked"),
    mix: (outcome ? [outcome] : OUTCOME_ORDER).map((o) => [o, count(o)] as [CallOutcome, number]),
  });

  doc.end();
  const buffer = await done;

  const fileName = `${accountName} - Call Report - ${fileDays(fromDay, toDay)}.pdf`.replace(/[\\/:*?"<>|]+/g, "");
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName.replace(/[^\x20-\x7e]/g, "")}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}

/** The SDR's name, from this account's SDRs, falling back to the user row. */
async function nameOf(supabase: Awaited<ReturnType<typeof createClient>>, accountId: string, id: string) {
  const { data: people } = await supabase.rpc("sdr_candidates", { p_account_id: accountId });
  const hit = (people as { id: string; full_name: string }[] | null)?.find((x) => x.id === id);
  if (hit) return hit.full_name;
  const { data } = await supabase.from("users").select("full_name").eq("id", id).maybeSingle();
  return data?.full_name ?? "CRO Leader";
}

const parseDay = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
};
const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-US", { ...o, timeZone: "UTC" });

/** "November 6, 2026", "November 1 – 6, 2026", "October 19 – November 6, 2026", "Dec 29, 2025 – Jan 4, 2026". */
function periodLabel(fromDay: string, toDay: string) {
  const a = parseDay(fromDay);
  const b = parseDay(toDay);
  if (fromDay === toDay) return fmt(a, { month: "long", day: "numeric", year: "numeric" });
  if (a.getUTCFullYear() !== b.getUTCFullYear()) {
    return `${fmt(a, { month: "long", day: "numeric", year: "numeric" })} – ${fmt(b, { month: "long", day: "numeric", year: "numeric" })}`;
  }
  if (a.getUTCMonth() === b.getUTCMonth()) {
    return `${fmt(a, { month: "long", day: "numeric" })} – ${b.getUTCDate()}, ${b.getUTCFullYear()}`;
  }
  return `${fmt(a, { month: "long", day: "numeric" })} – ${fmt(b, { month: "long", day: "numeric", year: "numeric" })}`;
}

/** "Nov 6 2026", "Nov 1 to Nov 6 2026". */
function fileDays(fromDay: string, toDay: string) {
  const a = parseDay(fromDay);
  const b = parseDay(toDay);
  const short = (d: Date) => fmt(d, { month: "short", day: "numeric" });
  if (fromDay === toDay) return `${short(a)} ${b.getUTCFullYear()}`;
  if (a.getUTCFullYear() !== b.getUTCFullYear()) return `${short(a)} ${a.getUTCFullYear()} to ${short(b)} ${b.getUTCFullYear()}`;
  return `${short(a)} to ${short(b)} ${b.getUTCFullYear()}`;
}

function validTimeZone(tz: string | null) {
  if (!tz) return "America/New_York";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "America/New_York";
  }
}
