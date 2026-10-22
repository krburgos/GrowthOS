"use client";

import { ChevronDown, Filter, Plus, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { FilterField } from "@/components/ui/filter-bar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DAY_OPTIONS,
  FIELDS,
  NO_OWNER,
  RULE_FIELDS,
  TEMP_OPTIONS,
  YES_NO,
  decodeRules,
  describeRule,
  encodeRule,
  isActive,
  newRule,
  type ContactRule,
  type RuleField,
  type RuleOptions,
} from "@/lib/contacts/filters";
import { cn } from "@/lib/utils";

const CONTROL = "h-9 w-full min-w-0 rounded-md border bg-white px-3 text-body-sm text-neutral-800";
const on = (active: boolean) => (active ? "border-primary-700 bg-primary-50 font-semibold text-primary-900" : "border-neutral-300");

/** The rules in the address, and a way to write them back (dropping the page, like every filter). */
function useAddressRules() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const encoded = params.getAll("f");
  const rules = useMemo(() => decodeRules(encoded), [encoded.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const write = (next: ContactRule[]) => {
    const p = new URLSearchParams(params.toString());
    p.delete("f");
    p.delete("page");
    next.filter(isActive).forEach((r) => p.append("f", encodeRule(r)));
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return { rules, write };
}

const sameRules = (a: ContactRule[], b: ContactRule[]) =>
  JSON.stringify(a.filter(isActive).map(encodeRule)) === JSON.stringify(b.filter(isActive).map(encodeRule));

/**
 * The Filter control on the Contacts toolbar (client-confirmed, 2026-10-22,
 * approved mockup "Contacts Filters"): a panel of "Where / And" rows like
 * GlassHive's, with no "Save as view". A half-filled row waits until it has
 * a value; typing waits for a pause, like Search.
 */
export function ContactsFilterButton({ options }: { options: RuleOptions }) {
  const { rules, write } = useAddressRules();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ContactRule[]>(rules);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A chip removed outside the panel, or Back: follow the address.
  useEffect(() => {
    setDraft((d) => (sameRules(d, rules) ? d : rules));
  }, [rules]);

  const commit = (next: ContactRule[], wait = 0) => {
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    if (sameRules(next, rules)) return;
    timer.current = setTimeout(() => write(next), wait);
  };
  const update = (i: number, patch: Partial<ContactRule>, wait = 0) =>
    commit(
      draft.map((r, j) => (j === i ? { ...r, ...patch } : r)),
      wait
    );

  const active = rules.filter(isActive).length;

  const addRow = () => {
    const used = new Set(draft.map((r) => r.field));
    const field = RULE_FIELDS.find((f) => !used.has(f)) ?? "status";
    setDraft([...draft, newRule(field)]);
  };

  return (
    <FilterField label="Filter">
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          // Closing drops rows that never got a value.
          if (!o) setDraft((d) => d.filter(isActive));
          if (o && draft.length === 0) setDraft([newRule("status")]);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-button transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40",
              active > 0
                ? "border-primary-700 bg-primary-50 font-semibold text-primary-900"
                : "border-neutral-300 bg-white text-primary-700 hover:border-primary-700"
            )}
          >
            <Filter className="size-4 text-secondary-700" aria-hidden="true" />
            {active > 0 ? `${active} active` : "Add filter"}
            <ChevronDown className="size-3.5 text-neutral-400" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(720px,calc(100vw-32px))] p-0" align="start">
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
            <p className="text-body font-semibold text-primary-900">Filters</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close filters"
              className="flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex max-h-[60vh] flex-col gap-2.5 overflow-y-auto px-4 py-4">
            {draft.length === 0 ? (
              <p className="py-3 text-center text-body-sm text-neutral-500">No filters yet. Add one to narrow the table.</p>
            ) : (
              draft.map((r, i) => (
                <RuleRow
                  key={i}
                  index={i}
                  rule={r}
                  options={options}
                  onField={(field) => commit(draft.map((x, j) => (j === i ? newRule(field) : x)))}
                  onChange={(patch, wait) => update(i, patch, wait)}
                  onRemove={() => commit(draft.filter((_, j) => j !== i))}
                />
              ))
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-neutral-100 px-4 py-3">
            <button
              type="button"
              onClick={addRow}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-3 text-body-sm font-medium text-secondary-700 hover:border-secondary-300 hover:bg-secondary-50"
            >
              <Plus className="size-3.5" />
              Add filter
            </button>
            <button
              type="button"
              onClick={() => commit([])}
              disabled={draft.length === 0}
              className="text-body-sm font-semibold text-secondary-700 hover:text-secondary-800 disabled:opacity-40"
            >
              Clear all
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </FilterField>
  );
}

function RuleRow({
  index,
  rule,
  options,
  onField,
  onChange,
  onRemove,
}: {
  index: number;
  rule: ContactRule;
  options: RuleOptions;
  onField: (field: RuleField) => void;
  onChange: (patch: Partial<ContactRule>, wait?: number) => void;
  onRemove: () => void;
}) {
  const def = FIELDS[rule.field];
  const groups = ["Contact", "Marketing", "Company"] as const;

  const valueOptions: { value: string; label: string }[] =
    rule.field === "status"
      ? options.statuses.map((s) => ({ value: s.id, label: s.label }))
      : rule.field === "owner"
        ? [...options.owners.map((o) => ({ value: o.id, label: o.label })), { value: NO_OWNER, label: "No owner" }]
        : rule.field === "temp"
          ? TEMP_OPTIONS
          : rule.field === "subscribed" || rule.field === "bounced"
            ? YES_NO
            : rule.field === "state"
              ? options.states.map((s) => ({ value: s, label: s }))
              : rule.field === "lists"
                ? options.lists.map((l) => ({ value: l.id, label: l.label }))
                : rule.field === "activity"
                  ? DAY_OPTIONS.map((d) => ({ value: d, label: `${d} days` }))
                  : [];

  const numberBox = (key: "from" | "to", placeholder: string) => (
    <span className="relative min-w-0 flex-1">
      {def.money && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body-sm text-neutral-400">$</span>
      )}
      <input
        inputMode="numeric"
        value={rule[key] ?? ""}
        placeholder={placeholder}
        aria-label={`${def.label} ${key === "from" ? "minimum" : "maximum"}`}
        onChange={(e) => onChange({ [key]: e.target.value.replace(/\D/g, "").slice(0, 9) }, 400)}
        className={cn(CONTROL, on(!!rule[key]), "tabular-nums outline-none focus-visible:border-secondary-500 focus-visible:ring-2 focus-visible:ring-secondary-500/40", def.money && "pl-6")}
      />
    </span>
  );

  let value: React.ReactNode;
  if (def.kind === "range") {
    value = (
      <div className="flex items-center gap-2">
        {numberBox("from", "Min")}
        <span className="text-body-sm text-neutral-500">to</span>
        {numberBox("to", "Max")}
      </div>
    );
  } else if (def.kind === "list" && rule.op === "none") {
    value = <span className="flex h-9 items-center text-body-sm text-neutral-400">—</span>;
  } else if (def.kind === "text") {
    value = (
      <input
        value={rule.value ?? ""}
        placeholder="Type a name"
        aria-label={def.label}
        onChange={(e) => onChange({ value: e.target.value.slice(0, 120) }, 400)}
        className={cn(CONTROL, on(!!rule.value), "outline-none focus-visible:border-secondary-500 focus-visible:ring-2 focus-visible:ring-secondary-500/40")}
      />
    );
  } else {
    value = (
      <Select value={rule.value || undefined} onValueChange={(v) => onChange({ value: v })}>
        <SelectTrigger className={cn("h-9 text-body-sm", on(!!rule.value))} aria-label={def.label}>
          <SelectValue placeholder="Choose…" />
        </SelectTrigger>
        <SelectContent>
          {valueOptions.length === 0 ? (
            <SelectItem value="__none" disabled>
              Nothing to choose yet
            </SelectItem>
          ) : (
            valueOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="grid grid-cols-[56px_minmax(0,1fr)_32px] items-center gap-x-2 gap-y-2 sm:grid-cols-[56px_190px_150px_minmax(0,1fr)_32px]">
      <span className="text-body-sm font-medium text-neutral-500">{index === 0 ? "Where" : "And"}</span>
      <div className="min-w-0">
        <Select value={rule.field} onValueChange={(v) => onField(v as RuleField)}>
          <SelectTrigger className="h-9 text-body-sm" aria-label="Field">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {groups.map((g) => (
              <SelectGroup key={g}>
                <SelectLabel>{g}</SelectLabel>
                {RULE_FIELDS.filter((f) => FIELDS[f].group === g).map((f) => (
                  <SelectItem key={f} value={f}>
                    {FIELDS[f].label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove filter"
        title="Remove filter"
        className="col-start-3 row-start-1 flex size-8 items-center justify-center rounded-md text-neutral-400 hover:bg-error-100 hover:text-error-700 sm:col-start-5"
      >
        <X className="size-4" />
      </button>
      <div className="col-start-2 min-w-0 sm:col-start-3 sm:row-start-1">
        {def.ops.length === 1 ? (
          <span className="flex h-9 items-center px-1 text-body-sm text-neutral-600">{def.ops[0].label}</span>
        ) : (
          <Select value={rule.op} onValueChange={(v) => onChange({ op: v })}>
            <SelectTrigger className="h-9 text-body-sm" aria-label="Condition">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {def.ops.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="col-start-2 min-w-0 sm:col-start-4 sm:row-start-1">{value}</div>
    </div>
  );
}

/**
 * One removable chip per active rule under the toolbar, with the count and
 * Clear filters (the mockup's "Showing 8 of 24 contacts").
 */
export function ContactsFilterChips({ options, shown, total }: { options: RuleOptions; shown: number; total: number }) {
  const { rules, write } = useAddressRules();
  const active = rules.filter(isActive);
  if (active.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" aria-live="polite">
      <span className="text-caption text-neutral-600">
        Showing <b className="font-semibold tabular-nums text-primary-900">{shown.toLocaleString()}</b> of{" "}
        <b className="font-semibold tabular-nums text-primary-900">{total.toLocaleString()}</b> contacts
      </span>
      {active.map((r, i) => {
        const [label, text] = describeRule(r, options);
        return (
          <span
            key={`${encodeRule(r)}-${i}`}
            className="inline-flex h-7 items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 pl-3 pr-1 text-body-sm text-primary-900"
          >
            <span className="text-neutral-500">{label}</span>
            <b className="font-semibold">{text}</b>
            <button
              type="button"
              onClick={() => write(active.filter((_, j) => j !== i))}
              aria-label={`Remove the ${label} filter`}
              className="flex size-5 items-center justify-center rounded-full text-primary-700 hover:bg-primary-100"
            >
              <X className="size-3" />
            </button>
          </span>
        );
      })}
      <button
        type="button"
        onClick={() => write([])}
        className="inline-flex items-center gap-1 rounded text-caption font-semibold text-secondary-700 hover:text-secondary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40"
      >
        <X className="size-3.5" aria-hidden="true" />
        Clear filters
      </button>
    </div>
  );
}
