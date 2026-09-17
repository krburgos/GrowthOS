"use client";

import {
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  Eye,
  Flag,
  Heart,
  Megaphone,
  PenTool,
  Target,
  TrendingDown,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { VisionBoardSummary, type IcpAnswers } from "@/components/settings/vision-board-summary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { createClient } from "@/lib/supabase/client";
import {
  TOTAL_FIELD_COUNT,
  VISION_BOARD_SECTIONS,
  countAnswered,
  isComplete,
  type FieldDef,
} from "@/lib/vision-board/sections";
import { cn } from "@/lib/utils";

const SECTION_ICON: Record<string, LucideIcon> = {
  heart: Heart,
  target: Target,
  flag: Flag,
  megaphone: Megaphone,
  eye: Eye,
  calendar: CalendarCheck,
  alert: AlertTriangle,
  bars: BarChart3,
  trenddown: TrendingDown,
  pen: PenTool,
};

const SELF_CHECK_PROMPTS = [
  "Does our leadership team agree with these answers?",
  "Are our goals measurable and achievable?",
  "Is everyone clear on what success looks like?",
  "Do our priorities align with our long-term vision?",
  "Are we focusing on the right activities to drive growth?",
];


type Answers = Record<string, string | string[] | null>;

function ListFieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FieldDef;
  value: string[] | undefined;
  onChange: (items: string[]) => void;
  disabled: boolean;
}) {
  const items = value ?? [];
  const [draft, setDraft] = useState("");
  const atMax = field.maxItems !== undefined && items.length >= field.maxItems;

  const add = () => {
    const v = draft.trim();
    if (!v || atMax) return;
    onChange([...items, v]);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-body-sm">
            <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-secondary-100 text-[10.5px] font-bold text-secondary-800">
              {i + 1}
            </span>
            <span className="flex-1 text-neutral-800">{item}</span>
            {!disabled && (
              <button
                type="button"
                aria-label="Remove"
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                className="shrink-0 text-neutral-400 hover:text-error-700"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      {!disabled && (
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={field.placeholder ?? "Add an item…"}
            disabled={atMax}
            className="flex-1"
          />
          <Button type="button" variant="secondary" size="sm" onClick={add} disabled={atMax}>
            + Add
          </Button>
        </div>
      )}
      <span className={cn("text-caption", items.length >= (field.minItems ?? 0) ? "text-success-700" : "text-neutral-400")}>
        {items.length} added{field.maxItems ? ` (up to ${field.maxItems})` : ""}
        {field.minItems ? ` — at least ${field.minItems} needed` : ""}
      </span>
    </div>
  );
}

function TextFieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FieldDef;
  value: string | undefined;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  if (field.multiline) {
    return (
      <textarea
        className="h-20 w-full resize-y rounded-md border border-neutral-300 px-3 py-2 text-body focus-visible:outline-none focus-visible:border-secondary-500 focus-visible:ring-2 focus-visible:ring-secondary-500/40"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your answer…"
      />
    );
  }
  return (
    <Input value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="max-w-xs" />
  );
}

/**
 * Client-confirmed (2026-09-16) — the GrowthOS Vision Board wizard,
 * modeled on GrowthQuestionnaireWizard's stepped pattern (one section
 * per screen, dot stepper, Save & Continue) but for this document's own
 * field shape: mostly free text plus several add/remove list fields
 * (Core Values, Three Uniques' supporting process stages, Priorities,
 * Obstacles, Metrics) instead of the Questionnaire's scored/choice
 * questions. Answers save to vision_board_responses (one row per
 * account, jsonb keyed by field key) on every Continue/Skip/Finish.
 *
 * The Marketing Strategy step's ICP box is read-only, built from the
 * account's GrowthOS Solution Questionnaire answers rather than asked
 * again here — client-confirmed (2026-09-16). The real Questionnaire
 * doesn't carry a structured company-size/revenue-range/decision-maker
 * breakdown, so this shows the fields it actually has (target market,
 * and the handful of related yes/no questions) rather than the richer
 * illustrative set from the first mockup pass.
 *
 * Client-confirmed (2026-09-16), round two: finishing while complete no
 * longer redirects straight to the Dashboard — it shows the completed
 * view (VisionBoardSummary: every answer as a strategy document, plus
 * PDF export; client-confirmed 2026-09-17, replacing the earlier
 * sign-off banner and "Coming soon" deliverables preview). Finishing
 * while still incomplete (or Skip) behaves as before
 * (save progress, redirect). Reopening the page after it's already
 * complete lands straight on this screen too, via `initialComplete`;
 * "Edit Vision Board" goes back into the stepper without losing that
 * completed state until something is actually changed and re-saved.
 */
export function VisionBoardWizard({
  accountId,
  initialAnswers,
  initialComplete,
  canEdit,
  exitHref,
  icpAnswers,
}: {
  accountId: string;
  initialAnswers: Answers;
  initialComplete: boolean;
  canEdit: boolean;
  exitHref: string;
  icpAnswers: IcpAnswers;
}) {
  const router = useRouter();
  const [view, setView] = useState<"wizard" | "complete">(initialComplete ? "complete" : "wizard");
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [saving, setSaving] = useState(false);

  const section = VISION_BOARD_SECTIONS[stepIndex];
  const answeredCount = countAnswered(answers);

  const setField = (key: string, value: string | string[] | null) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const save = async (markCompleteIfDone: boolean) => {
    setSaving(true);
    const supabase = createClient();
    const nowComplete = isComplete(answers);
    const { error } = await supabase.from("vision_board_responses").upsert(
      {
        account_id: accountId,
        answers,
        // An already-completed board stays complete through "Skip for now"
        // as long as every answer is still filled in.
        completed_at: nowComplete && (markCompleteIfDone || initialComplete) ? new Date().toISOString() : null,
      },
      { onConflict: "account_id" }
    );
    setSaving(false);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return false;
    }
    return true;
  };

  const handleContinue = async () => {
    const ok = await save(true);
    if (!ok) return;
    if (stepIndex < VISION_BOARD_SECTIONS.length - 1) {
      setStepIndex((i) => i + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (isComplete(answers)) {
      toast.success("Vision Board complete.");
      setView("complete");
      window.scrollTo({ top: 0, behavior: "smooth" });
      router.refresh();
    } else {
      toast.success("Progress saved.");
      router.push(exitHref);
      router.refresh();
    }
  };

  const handleSkip = async () => {
    await save(false);
    router.push(exitHref);
    router.refresh();
  };

  const Icon = SECTION_ICON[section.icon];

  if (view === "complete") {
    return (
      <VisionBoardSummary
        accountId={accountId}
        answers={answers}
        icpAnswers={icpAnswers}
        canEdit={canEdit}
        onEdit={() => {
          setStepIndex(0);
          setView("wizard");
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  return (
    <div className="flex max-w-[900px] flex-col gap-1">
      <h1 className="text-h1 text-primary-900">GrowthOS Vision Board</h1>
      <p className="mb-5 max-w-[62ch] text-body-sm text-neutral-500">
        Your company&apos;s strategic operating plan — core values, target market, financial goals, and the
        priorities your leadership team is aligned on. Signed off, it drives your Strategic Vision Dashboard and
        Growth Scorecard.
      </p>

      <div className="mb-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-secondary-500 to-success-500"
            style={{ width: `${Math.round((answeredCount / TOTAL_FIELD_COUNT) * 100)}%` }}
          />
        </div>
        <span className="shrink-0 text-caption font-semibold tabular-nums text-neutral-600">
          {answeredCount} of {TOTAL_FIELD_COUNT} answered
        </span>
      </div>

      <div className="mb-6 flex items-center gap-1.5">
        {VISION_BOARD_SECTIONS.map((s, i) => (
          <div key={s.key} className="flex flex-1 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStepIndex(i)}
              title={s.name}
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-caption font-bold",
                i < stepIndex
                  ? "bg-success-500 text-white"
                  : i === stepIndex
                    ? "bg-primary-700 text-white ring-4 ring-secondary-100"
                    : "bg-neutral-200 text-neutral-500"
              )}
            >
              {i < stepIndex ? "✓" : i + 1}
            </button>
            {i < VISION_BOARD_SECTIONS.length - 1 && (
              <div className={cn("h-0.5 flex-1", i < stepIndex ? "bg-success-400" : "bg-neutral-200")} />
            )}
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-neutral-100 px-5 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
            <Icon className="size-4" />
          </span>
          <span className="flex-1 text-h4 text-primary-900">{section.name}</span>
          <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-caption font-semibold text-neutral-500">
            Section {stepIndex + 1} of {VISION_BOARD_SECTIONS.length}
          </span>
        </div>
        <div className="flex flex-col gap-4 px-5 py-4">
          {section.hint && <p className="-mt-1 text-body-sm text-neutral-500">{section.hint}</p>}

          {section.key === "marketing" && (
            <div className="rounded-md border border-dashed border-secondary-300 bg-secondary-50 p-4">
              <p className="mb-2 text-caption font-bold uppercase tracking-wide text-secondary-800">
                Ideal Customer Profile — from your GrowthOS Solution Questionnaire
              </p>
              <div className="grid grid-cols-1 gap-2 text-body-sm sm:grid-cols-3">
                <div>
                  <p className="text-caption text-neutral-500">Target Market</p>
                  <p className="font-medium text-neutral-800">{icpAnswers.targetMarket || "Not answered yet"}</p>
                </div>
                <div>
                  <p className="text-caption text-neutral-500">Focuses on Specific Verticals</p>
                  <p className="font-medium text-neutral-800">
                    {icpAnswers.focusesOnVerticals === null ? "Not answered yet" : icpAnswers.focusesOnVerticals ? "Yes" : "No"}
                  </p>
                </div>
                <div>
                  <p className="text-caption text-neutral-500">High-Value Client Defined</p>
                  <p className="font-medium text-neutral-800">
                    {icpAnswers.hvcDefined === null ? "Not answered yet" : icpAnswers.hvcDefined ? "Yes" : "No"}
                  </p>
                </div>
              </div>
              <a href="/settings/growth-questionnaire" className="mt-2 inline-block text-caption font-semibold text-secondary-700 hover:underline">
                Edit these in the GrowthOS Solution Questionnaire →
              </a>
            </div>
          )}

          {section.key === "signoff" && (
            <div className="flex flex-col gap-1.5 rounded-md bg-neutral-50 p-4">
              {SELF_CHECK_PROMPTS.map((p) => (
                <p key={p} className="text-body-sm text-neutral-600">
                  • {p}
                </p>
              ))}
            </div>
          )}

          {section.fields.map((f, i) => (
            <div key={f.key} className={cn("flex flex-col gap-2", i > 0 && "border-t border-neutral-100 pt-4")}>
              <div>
                <label className="text-body-sm font-semibold text-neutral-700">{f.label}</label>
                {f.help && <p className="text-caption text-neutral-400">{f.help}</p>}
              </div>
              {f.type === "list" ? (
                <ListFieldInput
                  field={f}
                  value={answers[f.key] as string[] | undefined}
                  onChange={(items) => setField(f.key, items)}
                  disabled={!canEdit}
                />
              ) : (
                <TextFieldInput
                  field={f}
                  value={answers[f.key] as string | undefined}
                  onChange={(v) => setField(f.key, v)}
                  disabled={!canEdit}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <div>
          {stepIndex > 0 && (
            <Button variant="secondary" onClick={() => setStepIndex((i) => i - 1)} disabled={saving}>
              ← Back
            </Button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button type="button" className="text-body-sm font-semibold text-secondary-700 hover:underline" onClick={handleSkip} disabled={saving}>
            Skip for now, remind me later
          </button>
          {canEdit && (
            <Button onClick={handleContinue} disabled={saving}>
              {saving ? "Saving…" : stepIndex < VISION_BOARD_SECTIONS.length - 1 ? "Save & Continue →" : "Finish"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
