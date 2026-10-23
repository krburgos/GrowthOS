"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { RuleRow } from "@/components/contacts/contacts-filter-panel";
import { NAVY_GRADIENT } from "@/components/shell/hero-band";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { chunk } from "@/lib/contacts/bulk-actions";
import {
  RULE_FIELDS,
  applyRules,
  encodeRule,
  isActive,
  newRule,
  ruleEmbeds,
  type ContactRule,
  type RuleOptions,
} from "@/lib/contacts/filters";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { icpDefaultListName, icpRules } from "@/lib/icp/rules";
import { createClient } from "@/lib/supabase/client";
import type { IcpAnswers } from "@/lib/vision-board/icp";

/** The most a list gets in one go, the same cap as "Select all" on Contacts. */
const MAX_CONTACTS = 5000;
const NO_OPTIONS: RuleOptions = { statuses: [], owners: [], lists: [], states: [] };
const CLEAN_RULES: ContactRule[] = [
  { field: "bounced", op: "is", value: "no" },
  { field: "subscribed", op: "is", value: "yes" },
];
const ORDER_TITLE = encodeURIComponent("Source more ICP contacts");

/**
 * Build ICP list (client-confirmed, 2026-10-23, approved mockup "ICP & List
 * Building Cards"): a new list of every contact matching the ICP, filled
 * once (lists are never live; smart lists were removed 2026-09-06). The
 * rows start from the ICP's industries, size and decision makers and are
 * the Contacts filter rows, so anything can be changed for this list.
 * Location is not filled in: the questionnaire's coverage area is free
 * text. When the CRM is short, the three tiles do it yourself, assign it,
 * or delegate it to GrowthMission for credits.
 */
export function BuildIcpListDialog({
  open,
  onOpenChange,
  accountId,
  icp,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  icp: IcpAnswers;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [rules, setRules] = useState<ContactRule[]>([]);
  const [leaveOut, setLeaveOut] = useState(true);
  const [options, setOptions] = useState<RuleOptions>(NO_OPTIONS);
  const [count, setCount] = useState<number | null>(null);
  const [noTitle, setNoTitle] = useState(0);
  const [pending, setPending] = useState(false);

  // Each opening starts again from the ICP.
  useEffect(() => {
    if (!open) return;
    setName(icpDefaultListName(icp));
    setRules(icpRules(icp));
    setLeaveOut(true);
    const supabase = createClient();
    Promise.all([
      supabase.from("contact_statuses").select("id, name").eq("account_id", accountId).is("archived_at", null).order("sort_order"),
      supabase.from("users").select("id, full_name").eq("account_id", accountId).is("archived_at", null).order("full_name"),
      supabase.from("lists").select("id, name").eq("account_id", accountId).is("archived_at", null).order("name"),
      supabase.from("companies").select("state").eq("account_id", accountId).is("archived_at", null).not("state", "is", null).limit(1000),
    ]).then(([s, u, l, c]) =>
      setOptions({
        statuses: (s.data ?? []).map((x) => ({ id: x.id, label: x.name })),
        owners: (u.data ?? []).map((x) => ({ id: x.id, label: x.full_name })),
        lists: (l.data ?? []).map((x) => ({ id: x.id, label: x.name })),
        states: [...new Set((c.data ?? []).map((x) => (x.state as string).trim()).filter(Boolean))].sort(),
      })
    );
  }, [open, icp, accountId]);

  const active = useMemo(() => rules.filter(isActive), [rules]);
  const applied = useMemo(() => [...active, ...(leaveOut ? CLEAN_RULES : [])], [active, leaveOut]);
  const key = applied.map(encodeRule).join("&");

  // The live count waits for a pause in typing, like the Contacts filters.
  useEffect(() => {
    if (!open) return;
    if (active.length === 0) {
      setCount(null);
      setNoTitle(0);
      return;
    }
    const supabase = createClient();
    const countOf = (rs: ContactRule[], blankTitle = false) => {
      let q = supabase
        .from("contacts")
        .select(`id${ruleEmbeds(rs)}`, { count: "exact", head: true })
        .eq("account_id", accountId)
        .is("archived_at", null);
      if (blankTitle) q = q.is("title", null);
      return applyRules(q, rs).then((r) => r.count ?? 0);
    };
    const withoutTitle = applied.filter((r) => r.field !== "title");
    const hasTitle = active.some((r) => r.field === "title");
    const timer = setTimeout(async () => {
      const [n, m] = await Promise.all([countOf(applied), hasTitle ? countOf(withoutTitle, true) : Promise.resolve(0)]);
      setCount(n);
      setNoTitle(m);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key, accountId]);

  const noTitleHref = `/contacts?${applied
    .filter((r) => r.field !== "title")
    .map((r) => `f=${encodeURIComponent(encodeRule(r))}`)
    .join("&")}`;

  const update = (i: number, patch: Partial<ContactRule>) => setRules((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () => {
    const used = new Set(rules.map((r) => r.field));
    setRules([...rules, newRule(RULE_FIELDS.find((f) => !used.has(f)) ?? "city")]);
  };

  const create = async () => {
    if (!name.trim() || !count) return;
    setPending(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: list, error: listError } = await supabase
      .from("lists")
      .insert({ account_id: accountId, name: name.trim(), created_by: user!.id, built_from_icp: true })
      .select("id")
      .single();
    if (listError || !list) {
      setPending(false);
      toast.error(getFriendlyErrorMessage(listError));
      return;
    }

    const ids: string[] = [];
    for (let lo = 0; lo < MAX_CONTACTS; lo += 1000) {
      const q = supabase
        .from("contacts")
        .select(`id${ruleEmbeds(applied)}`)
        .eq("account_id", accountId)
        .is("archived_at", null)
        .order("id")
        .range(lo, Math.min(lo + 999, MAX_CONTACTS - 1));
      const { data } = await applyRules(q, applied);
      const page = (data ?? []) as unknown as { id: string }[];
      ids.push(...page.map((r) => r.id));
      if (page.length < 1000) break;
    }

    for (const part of chunk(ids, 500)) {
      const { error } = await supabase
        .from("list_members")
        .upsert(
          part.map((contactId) => ({ list_id: list.id, contact_id: contactId, added_by: user!.id })),
          { onConflict: "list_id,contact_id", ignoreDuplicates: true }
        );
      if (error) {
        setPending(false);
        toast.error(getFriendlyErrorMessage(error));
        router.refresh();
        return;
      }
    }

    setPending(false);
    toast.success(`Created ${name.trim()} with ${ids.length.toLocaleString()} contacts.`);
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[720px] overflow-y-auto p-0 [&>button:last-child]:text-white/80 [&>button:last-child]:hover:text-white">
        <div className={`px-5 py-4 pr-12 ${NAVY_GRADIENT}`}>
          <DialogTitle className="text-h4 text-white">Build ICP list</DialogTitle>
          <DialogDescription className="mt-0.5 text-body-sm text-secondary-300">Filled in from your ICP</DialogDescription>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-caption font-semibold text-primary-700">List name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 rounded-md border border-neutral-300 px-3 text-body text-neutral-800 outline-none focus-visible:border-secondary-500 focus-visible:ring-2 focus-visible:ring-secondary-500/40"
            />
          </label>

          <div className="flex flex-col gap-2.5 rounded-lg border border-primary-200 bg-primary-50 p-3.5">
            {rules.length === 0 ? (
              <p className="py-2 text-center text-body-sm text-neutral-500">
                Your ICP has no industries, sizes or decision makers yet.{" "}
                <Link href="/growth-mission/icp-development" className="font-semibold text-secondary-700 hover:underline">
                  Answer the ICP first
                </Link>
                , or add a filter.
              </p>
            ) : (
              rules.map((r, i) => (
                <RuleRow
                  key={i}
                  index={i}
                  rule={r}
                  options={options}
                  onField={(field) => setRules((rs) => rs.map((x, j) => (j === i ? newRule(field) : x)))}
                  onChange={(patch) => update(i, patch)}
                  onRemove={() => setRules((rs) => rs.filter((_, j) => j !== i))}
                />
              ))
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={addRow}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-neutral-300 bg-white px-3 text-body-sm font-medium text-secondary-700 hover:border-secondary-300 hover:bg-secondary-50"
              >
                <Plus className="size-3.5" />
                Add filter
              </button>
              <label className="inline-flex items-center gap-2 text-body-sm text-primary-900">
                <input type="checkbox" checked={leaveOut} onChange={(e) => setLeaveOut(e.target.checked)} className="size-4 accent-primary-700" />
                Leave out bounced and unsubscribed
              </label>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-lg border border-secondary-200 bg-secondary-50 px-4 py-3.5" aria-live="polite">
            <div className="flex flex-col">
              <span className="text-h2 font-bold tabular-nums text-primary-900">{count === null ? "—" : count.toLocaleString()}</span>
              <span className="text-caption font-semibold text-secondary-800">contacts match</span>
            </div>
            <div className="h-10 w-px bg-secondary-200" />
            <div className="flex flex-col gap-1 text-body-sm text-neutral-700">
              {noTitle > 0 && (
                <span>
                  <b className="tabular-nums text-primary-900">{noTitle.toLocaleString()}</b> more have no job title yet{" "}
                  <Link href={noTitleHref} className="font-semibold text-secondary-700 hover:underline">
                    Review them
                  </Link>
                </span>
              )}
              {count !== null && count > MAX_CONTACTS && <span>Only the first {MAX_CONTACTS.toLocaleString()} are added.</span>}
              {count === 0 && <span>No contacts match. Change a filter, or get more contacts below.</span>}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-caption font-bold uppercase tracking-wide text-primary-700">Not enough contacts?</span>
            <div className="grid gap-2 sm:grid-cols-3">
              <Tile href="/lists/upload" title="Import a file" sub="Do it yourself" />
              <Tile href={`/growth-mission/list-building?issue=1&type=internal&title=${ORDER_TITLE}`} title="Assign a Mission Order" sub="A teammate sources more" />
              <Tile
                href={`/growth-mission/list-building?issue=1&type=growthmission&title=${ORDER_TITLE}`}
                title="Order from GrowthMission"
                sub="Delegate with credits"
                strong
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3.5">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={create} disabled={pending || !name.trim() || !count || active.length === 0}>
            {pending ? "Creating…" : count ? `Create list of ${Math.min(count, MAX_CONTACTS).toLocaleString()}` : "Create list"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Tile({ href, title, sub, strong }: { href: string; title: string; sub: string; strong?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 transition-colors hover:border-primary-300 ${strong ? "border-primary-300 bg-primary-50" : "border-neutral-200"}`}
    >
      <span className="text-body-sm font-semibold text-primary-900">{title}</span>
      <span className="text-caption text-neutral-500">{sub}</span>
    </Link>
  );
}
