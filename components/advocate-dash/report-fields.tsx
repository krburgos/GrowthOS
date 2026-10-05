"use client";

import { Check, Minus } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ReportAnswers, ReportField, ReportSection } from "@/lib/advocate-dash/report-form";

/**
 * One renderer for the VictoryVisit report's fields, used by both the
 * editable form and the read-only sample (client-confirmed, 2026-10-05).
 *
 * Sharing it is what keeps the sample honest: the "Sample Victory Visit
 * Report" button shows the same component with `readOnly`, so it cannot
 * display a field the real form lacks or miss one it has.
 *
 * Read-only is a genuinely different rendering, not a disabled form. A
 * disabled checkbox grid makes a reader hunt for the four ticks among
 * fifty-five boxes, so the read-only view lists what was ticked and says
 * "None recorded" where nothing was — the difference between a form and a
 * report.
 */

export function SectionShell({
  section,
  index,
  children,
}: {
  section: ReportSection;
  index: number;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-neutral-100 px-5 py-5 first:border-t-0">
      <div className="mb-3">
        <h3 className="flex items-baseline gap-2 text-body font-semibold text-primary-900">
          {/* Numbered because the source document is a numbered sequence an
              advocate works through in order, not because numbers decorate
              a heading. */}
          <span className="text-caption font-bold tabular-nums text-neutral-400">
            {String(index + 1).padStart(2, "0")}
          </span>
          {section.title}
        </h3>
        {section.intro && <p className="mt-0.5 text-body-sm text-neutral-500">{section.intro}</p>}
      </div>
      {children}
    </section>
  );
}

export function FieldControl({
  field,
  answers,
  readOnly,
  onChange,
}: {
  field: ReportField;
  answers: ReportAnswers;
  readOnly: boolean;
  onChange: (key: string, value: ReportAnswers[string]) => void;
}) {
  const value = answers[field.key];

  switch (field.kind) {
    case "checklist":
      return (
        <ChecklistField field={field} answers={answers} readOnly={readOnly} onChange={onChange} />
      );

    case "choice":
      return <ChoiceField field={field} value={asText(value)} readOnly={readOnly} onChange={onChange} />;

    case "yesno":
      return <YesNoField field={field} value={typeof value === "boolean" ? value : null} readOnly={readOnly} onChange={onChange} />;

    case "textarea":
      return (
        <div>
          <Label htmlFor={field.key}>{field.label}</Label>
          {readOnly ? (
            <Prose text={asText(value)} />
          ) : (
            <Textarea
              id={field.key}
              rows={4}
              value={asText(value)}
              placeholder={field.placeholder}
              onChange={(e) => onChange(field.key, e.target.value)}
            />
          )}
        </div>
      );

    case "number":
      return (
        <div>
          <Label htmlFor={field.key}>{field.label}</Label>
          {readOnly ? (
            <p className="text-body-sm font-semibold tabular-nums text-neutral-900">
              {typeof value === "number" ? value : "—"}
            </p>
          ) : (
            <Input
              id={field.key}
              type="number"
              min="0"
              className="w-28"
              value={value === null || value === undefined ? "" : String(value)}
              onChange={(e) => onChange(field.key, e.target.value === "" ? null : Number(e.target.value))}
            />
          )}
        </div>
      );

    default:
      return (
        <div>
          <Label htmlFor={field.key}>{field.label}</Label>
          {readOnly ? (
            <p className="text-body-sm text-neutral-900">{displayText(field, asText(value))}</p>
          ) : (
            <Input
              id={field.key}
              type={field.kind === "date" ? "date" : field.kind === "time" ? "time" : "text"}
              value={asText(value)}
              placeholder={field.placeholder}
              onChange={(e) => onChange(field.key, e.target.value)}
            />
          )}
        </div>
      );
  }
}

function ChecklistField({
  field,
  answers,
  readOnly,
  onChange,
}: {
  field: ReportField;
  answers: ReportAnswers;
  readOnly: boolean;
  onChange: (key: string, value: ReportAnswers[string]) => void;
}) {
  const raw = answers[field.key];
  const ticked = Array.isArray(raw) ? raw : [];
  const options = field.options ?? [];
  const otherText = field.otherKey ? asText(answers[field.otherKey]) : "";

  if (readOnly) {
    const chosen = options.filter((o) => ticked.includes(o));
    return (
      <div>
        <p className="mb-1 text-caption text-neutral-700">{field.label}</p>
        {chosen.length === 0 ? (
          <p className="text-body-sm text-neutral-400">None recorded</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {chosen.map((o) => (
              <li key={o} className="flex items-start gap-2 text-body-sm text-neutral-900">
                <Check className="mt-0.5 size-3.5 shrink-0 text-success-600" strokeWidth={3} />
                <span>
                  {o === "Other" && otherText ? `Other — ${otherText}` : o}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const toggle = (option: string) => {
    const next = ticked.includes(option) ? ticked.filter((t) => t !== option) : [...ticked, option];
    onChange(field.key, next);
  };

  return (
    <div>
      <p className="mb-1.5 text-caption text-neutral-700">{field.label}</p>
      <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
        {options.map((option) => {
          const id = `${field.key}-${slug(option)}`;
          const checked = ticked.includes(option);
          return (
            <div key={option} className="flex items-start gap-2">
              <Checkbox
                id={id}
                className="mt-0.5"
                checked={checked}
                onCheckedChange={() => toggle(option)}
              />
              <label htmlFor={id} className="text-body-sm leading-snug text-neutral-700">
                {option}
              </label>
            </div>
          );
        })}
      </div>
      {field.otherKey && ticked.includes("Other") && (
        <Input
          className="mt-2"
          value={otherText}
          placeholder="Say what"
          aria-label={`${field.label} — other`}
          onChange={(e) => onChange(field.otherKey!, e.target.value)}
        />
      )}
    </div>
  );
}

function ChoiceField({
  field,
  value,
  readOnly,
  onChange,
}: {
  field: ReportField;
  value: string;
  readOnly: boolean;
  onChange: (key: string, value: ReportAnswers[string]) => void;
}) {
  const options = field.options ?? [];

  if (readOnly) {
    return (
      <div>
        <p className="mb-1 text-caption text-neutral-700">{field.label}</p>
        {value ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-50 px-3 py-1 text-body-sm font-semibold text-secondary-800">
            {value}
          </span>
        ) : (
          <p className="text-body-sm text-neutral-400">Not recorded</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="mb-1.5 text-caption text-neutral-700">{field.label}</p>
      {/* A segmented row rather than a Select: five options the advocate
          compares against each other read better side by side, and the
          paper form presents them that way too. */}
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={field.label}>
        {options.map((option) => {
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(field.key, selected ? "" : option)}
              className={`rounded-full border px-3 py-1.5 text-body-sm font-medium transition-colors motion-reduce:transition-none ${
                selected
                  ? "border-secondary-600 bg-secondary-600 text-white"
                  : "border-neutral-300 bg-white text-neutral-600 hover:border-secondary-500 hover:text-secondary-700"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function YesNoField({
  field,
  value,
  readOnly,
  onChange,
}: {
  field: ReportField;
  value: boolean | null;
  readOnly: boolean;
  onChange: (key: string, value: ReportAnswers[string]) => void;
}) {
  if (readOnly) {
    return (
      <div className="flex items-center justify-between gap-3 border-b border-neutral-100 py-1.5 last:border-b-0">
        <span className="text-body-sm text-neutral-700">{field.label}</span>
        {value === null ? (
          <span className="inline-flex items-center gap-1 text-body-sm text-neutral-400">
            <Minus className="size-3.5" />
            Not recorded
          </span>
        ) : (
          <span
            className={`inline-flex items-center gap-1 text-body-sm font-semibold ${
              value ? "text-success-700" : "text-neutral-500"
            }`}
          >
            {value ? <Check className="size-3.5" strokeWidth={3} /> : <Minus className="size-3.5" />}
            {value ? "Yes" : "No"}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2 last:border-b-0">
      <span className="text-body-sm text-neutral-700">{field.label}</span>
      <span className="flex gap-1.5">
        {[true, false].map((option) => (
          <button
            key={String(option)}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(field.key, value === option ? null : option)}
            className={`rounded-full border px-3 py-1 text-body-sm font-medium transition-colors motion-reduce:transition-none ${
              value === option
                ? option
                  ? "border-success-600 bg-success-600 text-white"
                  : "border-neutral-400 bg-neutral-400 text-white"
                : "border-neutral-300 bg-white text-neutral-600 hover:border-secondary-500"
            }`}
          >
            {option ? "Yes" : "No"}
          </button>
        ))}
      </span>
    </div>
  );
}

/** Multi-paragraph answers keep their breaks when read back. */
function Prose({ text }: { text: string }) {
  if (!text.trim()) return <p className="text-body-sm text-neutral-400">Not recorded</p>;
  return (
    <div className="flex flex-col gap-2">
      {text.split(/\n\s*\n/).map((para, i) => (
        <p key={i} className="whitespace-pre-line text-body-sm leading-relaxed text-neutral-700">
          {para}
        </p>
      ))}
    </div>
  );
}

function displayText(field: ReportField, value: string): string {
  if (!value) return "—";
  if (field.kind === "date") {
    const [y, m, d] = value.slice(0, 10).split("-").map(Number);
    if (y && m && d) {
      return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
    }
  }
  return value;
}

function asText(value: ReportAnswers[string]): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
