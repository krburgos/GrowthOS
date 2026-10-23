/**
 * Contacts table filters (client-confirmed, 2026-10-22, approved mockup
 * "Contacts Filters"): GlassHive-style rows, "Where Contact Status is MQC",
 * "And Employee Size is from 11 to 50". Every row must match (And only, by
 * the mockup's decision). They only narrow the table: nothing is saved as
 * a view, because saved views would bring back the Smart Lists the client
 * removed on 2026-09-06.
 *
 * Shared by the page (server), the filter panel (client) and bulk
 * "Select all N" (client), so all three narrow by exactly the same rules.
 * Rules travel in the address as repeated `f` params.
 */

export type RuleField =
  | "status"
  | "owner"
  | "temp"
  | "score"
  | "lists"
  | "activity"
  | "subscribed"
  | "bounced"
  | "employees"
  | "pv"
  | "company"
  | "city"
  | "state"
  | "industry"
  | "title";

export type RuleKind = "select" | "range" | "list" | "days" | "text";

export interface ContactRule {
  field: RuleField;
  op: string;
  /** select / list / days / text */
  value?: string;
  /** range */
  from?: string;
  to?: string;
}

export interface FieldDef {
  label: string;
  group: "Contact" | "Marketing" | "Company";
  kind: RuleKind;
  ops: { value: string; label: string }[];
  money?: boolean;
}

const IS = [
  { value: "is", label: "is" },
  { value: "is_not", label: "is not" },
];

export const FIELDS: Record<RuleField, FieldDef> = {
  status: { label: "Contact Status", group: "Contact", kind: "select", ops: IS },
  owner: { label: "Owner", group: "Contact", kind: "select", ops: IS },
  temp: { label: "Temp", group: "Contact", kind: "select", ops: IS },
  score: { label: "Score", group: "Contact", kind: "range", ops: [{ value: "between", label: "is from" }] },
  lists: {
    label: "Lists",
    group: "Contact",
    kind: "list",
    ops: [
      { value: "in", label: "is in" },
      { value: "not_in", label: "is not in" },
      { value: "none", label: "is in no list" },
    ],
  },
  activity: {
    label: "Last activity",
    group: "Contact",
    kind: "days",
    ops: [
      { value: "within", label: "within the last" },
      { value: "not_within", label: "none in the last" },
    ],
  },
  subscribed: { label: "Subscribed", group: "Marketing", kind: "select", ops: [{ value: "is", label: "is" }] },
  bounced: { label: "Bounced", group: "Marketing", kind: "select", ops: [{ value: "is", label: "is" }] },
  employees: { label: "Employee Size", group: "Company", kind: "range", ops: [{ value: "between", label: "is from" }] },
  pv: { label: "Prospect Value", group: "Company", kind: "range", money: true, ops: [{ value: "between", label: "is from" }] },
  company: { label: "Company", group: "Company", kind: "text", ops: [{ value: "contains", label: "contains" }] },
  city: { label: "Company City", group: "Company", kind: "text", ops: [{ value: "contains", label: "contains" }] },
  state: { label: "Company State", group: "Company", kind: "select", ops: IS },
  // Client-confirmed (2026-10-23, approved mockup "ICP & List Building
  // Cards"): the ICP is matched by industry and job title, both free text, so
  // each takes several values (comma or "|" separated) and matches any of them.
  industry: { label: "Industry", group: "Company", kind: "text", ops: [{ value: "any", label: "is any of" }] },
  title: { label: "Job title", group: "Contact", kind: "text", ops: [{ value: "any", label: "contains any of" }] },
};

export const RULE_FIELDS = Object.keys(FIELDS) as RuleField[];

export const DAY_OPTIONS = ["7", "30", "90"];
export const TEMP_OPTIONS = [
  { value: "hot", label: "Hot" },
  { value: "cold", label: "Cold" },
  { value: "none", label: "Not set" },
];
export const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];
export const NO_OWNER = "none";

/** Longest typed value a rule keeps; an ICP title list with its spelled-out forms runs past 120. */
export const MAX_TEXT = 300;

/** The values of an "is any of" rule: split before cleaning, so a comma inside a value can't break or(). */
export function anyValues(v: string): string[] {
  return v
    .split(/[|,]/)
    .map(clean)
    .filter(Boolean);
}

/** Prospect Value = $200 × employees × 12 (lib/companies/value.ts), so a value range is an employee range. */
const PV_PER_EMPLOYEE = 200 * 12;

export function newRule(field: RuleField): ContactRule {
  const def = FIELDS[field];
  if (def.kind === "range") return { field, op: "between", from: "", to: "" };
  if (def.kind === "days") return { field, op: def.ops[0].value, value: "30" };
  return { field, op: def.ops[0].value, value: "" };
}

/** A rule that narrows anything: a half-filled row is ignored until it has a value. */
export function isActive(r: ContactRule): boolean {
  const def = FIELDS[r.field];
  if (!def) return false;
  if (def.kind === "range") return !!r.from || !!r.to;
  if (def.kind === "list" && r.op === "none") return true;
  return !!r.value;
}

// ---- The address -----------------------------------------------------------

const SEP = "~";

/** encodeURIComponent leaves "~" alone, and "~" separates the parts, so a typed one is escaped too. */
const encodePart = (s: string) => encodeURIComponent(s).replace(/~/g, "%7E");

export function encodeRule(r: ContactRule): string {
  return [r.field, r.op, r.value ?? "", r.from ?? "", r.to ?? ""].map(encodePart).join(SEP);
}

export function decodeRule(s: string): ContactRule | null {
  const [field, op, value, from, to] = s.split(SEP).map((p) => {
    try {
      return decodeURIComponent(p ?? "");
    } catch {
      return "";
    }
  });
  const def = FIELDS[field as RuleField];
  if (!def || !def.ops.some((o) => o.value === op)) return null;
  const num = (v: string) => (/^\d{1,9}$/.test(v) ? v : "");
  if (def.kind === "range") return { field: field as RuleField, op, from: num(from), to: num(to) };
  if (def.kind === "days") return DAY_OPTIONS.includes(value) ? { field: field as RuleField, op, value } : null;
  return { field: field as RuleField, op, value: value.slice(0, MAX_TEXT) };
}

export function decodeRules(params: string | string[] | undefined): ContactRule[] {
  const list = Array.isArray(params) ? params : params ? [params] : [];
  return list
    .slice(0, 12)
    .map(decodeRule)
    .filter((r): r is ContactRule => !!r);
}

// ---- The query -------------------------------------------------------------

/** Characters that would break PostgREST's or()/ilike syntax. */
const clean = (s: string) => s.replace(/[,()%*\\]/g, " ").trim();

/**
 * The embeds the active rules need, to append to a contacts `select`. Each
 * rule gets its own alias (f0, f1…) so two rules on the same table (in
 * list A, not in list B) never collide.
 */
export function ruleEmbeds(rules: ContactRule[]): string {
  return rules
    .filter(isActive)
    .map((r, i) => {
      const a = `f${i}`;
      switch (r.field) {
        case "lists":
          return r.op === "in" ? `,${a}:list_members!inner(list_id)` : `,${a}:list_members!left(list_id)`;
        case "activity":
          return r.op === "within" ? `,${a}:activities!inner(id)` : `,${a}:activities!left(id)`;
        case "state":
          return r.op === "is" ? `,${a}:companies!inner(id)` : `,${a}:companies!left(id)`;
        case "employees":
        case "pv":
        case "company":
        case "city":
        case "industry":
          return `,${a}:companies!inner(id)`;
        default:
          return "";
      }
    })
    .join("");
}

/**
 * Narrows a contacts query (built with `ruleEmbeds` in its select) by
 * every active rule. `now` is passed in so the server and client agree.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyRules<Q extends { [k: string]: any }>(query: Q, rules: ContactRule[], now = new Date()): Q {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = query;
  rules.filter(isActive).forEach((r, i) => {
    const a = `f${i}`;
    const v = r.value ?? "";
    switch (r.field) {
      case "status":
        q = r.op === "is" ? q.eq("status_id", v) : q.neq("status_id", v);
        break;
      case "owner":
        if (v === NO_OWNER) q = r.op === "is" ? q.is("owner_id", null) : q.not("owner_id", "is", null);
        else q = r.op === "is" ? q.eq("owner_id", v) : q.or(`owner_id.neq.${v},owner_id.is.null`);
        break;
      case "temp":
        if (v === "none") q = r.op === "is" ? q.is("temperature", null) : q.not("temperature", "is", null);
        else q = r.op === "is" ? q.eq("temperature", v) : q.or(`temperature.neq.${v},temperature.is.null`);
        break;
      case "score":
        if (r.from) q = q.gte("score", Number(r.from));
        if (r.to) q = q.lte("score", Number(r.to));
        break;
      case "subscribed":
        q = q.eq("email_opt_out", v === "no");
        break;
      case "bounced":
        q = v === "yes" ? q.not("email_bounced_at", "is", null) : q.is("email_bounced_at", null);
        break;
      case "lists":
        if (r.op === "in") q = q.eq(`${a}.list_id`, v);
        else if (r.op === "not_in") q = q.eq(`${a}.list_id`, v).is(a, null);
        else q = q.is(a, null);
        break;
      case "activity": {
        const since = new Date(now.getTime() - Number(v) * 86_400_000).toISOString();
        q = q.gte(`${a}.occurred_at`, since).is(`${a}.archived_at`, null);
        if (r.op === "not_within") q = q.is(a, null);
        break;
      }
      case "employees":
        if (r.from) q = q.gte(`${a}.employee_count`, Number(r.from));
        if (r.to) q = q.lte(`${a}.employee_count`, Number(r.to));
        if (!r.from) q = q.not(`${a}.employee_count`, "is", null);
        break;
      case "pv":
        if (r.from) q = q.gte(`${a}.employee_count`, Math.ceil(Number(r.from) / PV_PER_EMPLOYEE));
        if (r.to) q = q.lte(`${a}.employee_count`, Math.floor(Number(r.to) / PV_PER_EMPLOYEE));
        if (!r.from) q = q.not(`${a}.employee_count`, "is", null);
        break;
      case "company":
        if (clean(v)) q = q.ilike(`${a}.name`, `%${clean(v)}%`);
        break;
      case "city":
        if (clean(v)) q = q.ilike(`${a}.city`, `%${clean(v)}%`);
        break;
      case "state":
        q = q.eq(`${a}.state`, v);
        if (r.op === "is_not") q = q.is(a, null);
        break;
      case "industry": {
        const parts = anyValues(v);
        if (parts.length) q = q.or(parts.map((p) => `industry.ilike.%${p}%`).join(","), { referencedTable: a });
        break;
      }
      case "title": {
        const parts = anyValues(v);
        if (parts.length) q = q.or(parts.map((p) => `title.ilike.%${p}%`).join(","));
        break;
      }
    }
  });
  return q as Q;
}

// ---- Chips -----------------------------------------------------------------

export interface RuleOptions {
  statuses: { id: string; label: string; color?: string | null }[];
  owners: { id: string; label: string }[];
  lists: { id: string; label: string }[];
  states: string[];
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** "Contact Status" + "is MQC", for a chip. */
export function describeRule(r: ContactRule, o: RuleOptions): [string, string] {
  const def = FIELDS[r.field];
  const opLabel = def.ops.find((x) => x.value === r.op)?.label ?? r.op;
  const v = r.value ?? "";
  if (def.kind === "range") {
    const fmt = (n: string) => (def.money ? usd.format(Number(n)) : Number(n).toLocaleString());
    if (r.from && r.to) return [def.label, `${fmt(r.from)}–${fmt(r.to)}`];
    if (r.from) return [def.label, `at least ${fmt(r.from)}`];
    return [def.label, `at most ${fmt(r.to ?? "0")}`];
  }
  if (def.kind === "days") return [def.label, `${opLabel} ${v} days`];
  if (def.kind === "list") {
    if (r.op === "none") return [def.label, "in no list"];
    const name = o.lists.find((l) => l.id === v)?.label ?? "a list";
    return [def.label, `${r.op === "in" ? "includes" : "excludes"} ${name}`];
  }
  if (def.kind === "text" && r.op === "any") return [def.label, `${opLabel} ${anyValues(v).join(", ")}`];
  if (def.kind === "text") return [def.label, `contains “${v}”`];
  const valueLabel =
    r.field === "status"
      ? o.statuses.find((s) => s.id === v)?.label
      : r.field === "owner"
        ? v === NO_OWNER
          ? "No owner"
          : o.owners.find((s) => s.id === v)?.label
        : r.field === "temp"
          ? TEMP_OPTIONS.find((t) => t.value === v)?.label
          : r.field === "subscribed" || r.field === "bounced"
            ? YES_NO.find((t) => t.value === v)?.label
            : v;
  return [def.label, `${opLabel} ${valueLabel ?? v}`];
}
