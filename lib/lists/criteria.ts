/**
 * Backend Schema §7.4 — compute_smart_list_members()'s whitelist, mirrored
 * exactly. The UI must make it structurally impossible to submit anything
 * the function would reject (Implementation Plan Milestone 7), so each
 * field here only exposes the operators the function actually accepts for
 * it: contains is text-only, before/after are timestamp-only.
 */
export type CriteriaFieldKey =
  | "status_id"
  | "owner_id"
  | "company_id"
  | "source"
  | "title"
  | "email"
  | "created_at";

export type CriteriaOp = "eq" | "neq" | "contains" | "before" | "after";

export interface CriteriaFieldDef {
  key: CriteriaFieldKey;
  label: string;
  ops: CriteriaOp[];
  valueType: "select-status" | "select-owner" | "select-company" | "select-source" | "text" | "date";
}

export const CRITERIA_FIELDS: CriteriaFieldDef[] = [
  { key: "status_id", label: "Status", ops: ["eq", "neq"], valueType: "select-status" },
  { key: "owner_id", label: "Owner", ops: ["eq", "neq"], valueType: "select-owner" },
  { key: "company_id", label: "Company", ops: ["eq", "neq"], valueType: "select-company" },
  { key: "source", label: "Source", ops: ["eq", "neq"], valueType: "select-source" },
  { key: "title", label: "Title", ops: ["eq", "neq", "contains"], valueType: "text" },
  { key: "email", label: "Email", ops: ["eq", "neq", "contains"], valueType: "text" },
  { key: "created_at", label: "Created", ops: ["before", "after"], valueType: "date" },
];

export const OP_LABELS: Record<CriteriaOp, string> = {
  eq: "is",
  neq: "is not",
  contains: "contains",
  before: "before",
  after: "after",
};

export interface CriteriaCondition {
  field: CriteriaFieldKey;
  op: CriteriaOp;
  value: string;
}

export interface SmartListCriteria {
  match: "all" | "any";
  conditions: CriteriaCondition[];
}
