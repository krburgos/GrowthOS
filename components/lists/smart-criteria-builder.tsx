"use client";

import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CRITERIA_FIELDS,
  OP_LABELS,
  type CriteriaCondition,
  type CriteriaFieldKey,
  type CriteriaOp,
  type SmartListCriteria,
} from "@/lib/lists/criteria";

export interface CriteriaOption {
  id: string;
  label: string;
}

/**
 * Backend Schema §7.4 — the criteria builder restricted to exactly the
 * seven whitelisted fields and their valid operators (Implementation
 * Plan Milestone 7), so nothing submittable here could be rejected by
 * compute_smart_list_members().
 */
export function SmartCriteriaBuilder({
  criteria,
  onChange,
  statuses,
  owners,
  companies,
}: {
  criteria: SmartListCriteria;
  onChange: (criteria: SmartListCriteria) => void;
  statuses: CriteriaOption[];
  owners: CriteriaOption[];
  companies: CriteriaOption[];
}) {
  const addCondition = () => {
    onChange({
      ...criteria,
      conditions: [...criteria.conditions, { field: "status_id", op: "eq", value: "" }],
    });
  };

  const updateCondition = (index: number, patch: Partial<CriteriaCondition>) => {
    const next = [...criteria.conditions];
    const updated = { ...next[index], ...patch };
    // Changing field resets op/value if the current op isn't valid for the
    // new field (keeps the UI structurally aligned with the whitelist).
    if (patch.field) {
      const fieldDef = CRITERIA_FIELDS.find((f) => f.key === patch.field)!;
      if (!fieldDef.ops.includes(updated.op)) {
        updated.op = fieldDef.ops[0];
      }
      updated.value = "";
    }
    next[index] = updated;
    onChange({ ...criteria, conditions: next });
  };

  const removeCondition = (index: number) => {
    onChange({ ...criteria, conditions: criteria.conditions.filter((_, i) => i !== index) });
  };

  const optionsFor = (valueType: string): CriteriaOption[] => {
    if (valueType === "select-status") return statuses;
    if (valueType === "select-owner") return owners;
    if (valueType === "select-company") return companies;
    if (valueType === "select-source") return [{ id: "import", label: "Import" }, { id: "manual", label: "Manual" }];
    return [];
  };

  return (
    <div className="flex flex-col gap-4">
      {criteria.conditions.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-body-sm text-neutral-600">Match</span>
          <Select
            value={criteria.match}
            onValueChange={(v) => onChange({ ...criteria, match: v as "all" | "any" })}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="any">Any</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-body-sm text-neutral-600">of the following conditions</span>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {criteria.conditions.map((condition, index) => {
          const fieldDef = CRITERIA_FIELDS.find((f) => f.key === condition.field)!;
          const options = optionsFor(fieldDef.valueType);

          return (
            <div key={index} className="flex items-center gap-2">
              <Select
                value={condition.field}
                onValueChange={(v) => updateCondition(index, { field: v as CriteriaFieldKey })}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CRITERIA_FIELDS.map((f) => (
                    <SelectItem key={f.key} value={f.key}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={condition.op}
                onValueChange={(v) => updateCondition(index, { op: v as CriteriaOp })}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fieldDef.ops.map((op) => (
                    <SelectItem key={op} value={op}>
                      {OP_LABELS[op]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {options.length > 0 ? (
                <Select value={condition.value} onValueChange={(v) => updateCondition(index, { value: v })}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type={fieldDef.valueType === "date" ? "date" : "text"}
                  value={condition.value}
                  onChange={(e) => updateCondition(index, { value: e.target.value })}
                  className="w-48"
                />
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeCondition(index)}
                aria-label="Remove condition"
              >
                <X className="size-4" />
              </Button>
            </div>
          );
        })}
      </div>

      <Button type="button" variant="secondary" size="sm" className="self-start" onClick={addCondition}>
        <Plus className="mr-1.5 size-4" />
        Add Condition
      </Button>
    </div>
  );
}
