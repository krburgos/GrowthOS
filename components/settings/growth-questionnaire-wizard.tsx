"use client";

import {
  Briefcase,
  Building2,
  Check,
  Cog,
  Crosshair,
  Download,
  GraduationCap,
  Magnet,
  Megaphone,
  MessageSquare,
  Signal,
  Target,
  UserRound,
  Users,
  Globe as GlobeIcon,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { Input } from "@/components/ui/input";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import {
  QUESTIONNAIRE_SECTIONS,
  TOTAL_QUESTION_COUNT,
  arrayAnswer,
  countAnswered,
  isComplete,
  type QuestionDef,
} from "@/lib/questionnaire/questions";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const SECTION_ICON: Record<string, LucideIcon> = {
  building: Building2,
  users: Users,
  target: Target,
  megaphone: Megaphone,
  magnet: Magnet,
  globe: GlobeIcon,
  grad: GraduationCap,
  gear: Cog,
  crosshair: Crosshair,
  user: UserRound,
  briefcase: Briefcase,
  message: MessageSquare,
  signal: Signal,
};

type AnswerValue = string | number | string[] | null;
export type QuestionnaireAnswers = Record<string, AnswerValue>;

/** Tick lists, rankings, lists and paragraphs take the full row width, with the label above. */
const isWide = (q: QuestionDef) => q.type === "multi" || q.type === "rank" || q.type === "list" || !!q.long;

const TEXTAREA_CLASS =
  "w-full resize-y rounded-md border border-neutral-300 px-3 py-2 text-body focus-visible:outline-none focus-visible:border-secondary-500 focus-visible:ring-2 focus-visible:ring-secondary-500/40";

function OtherBox({
  id,
  label,
  value,
  onChange,
  disabled,
  placeholder,
  type = "text",
}: {
  id: string;
  label: string;
  value: AnswerValue | undefined;
  onChange: (v: string | number | null) => void;
  disabled: boolean;
  placeholder: string;
  type?: "text" | "number";
}) {
  return (
    <div className="mt-2.5 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
      <label htmlFor={id} className="shrink-0 text-body-sm text-neutral-500">
        {label}
      </label>
      <Input
        id={id}
        type={type}
        className={type === "number" ? "max-w-[160px]" : "sm:max-w-[420px]"}
        value={typeof value === "string" || typeof value === "number" ? value : ""}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : type === "number" ? Number(e.target.value) : e.target.value)
        }
      />
    </div>
  );
}

function ChoiceChips({
  q,
  answers,
  setAnswer,
  disabled,
}: {
  q: QuestionDef;
  answers: QuestionnaireAnswers;
  setAnswer: (key: string, v: AnswerValue) => void;
  disabled: boolean;
}) {
  const picked = arrayAnswer(answers[q.key]);
  const ranked = q.type === "rank";
  const max = q.max ?? Infinity;

  const toggle = (option: string) => {
    if (picked.includes(option)) {
      setAnswer(q.key, picked.filter((p) => p !== option));
      // Unticking the typed option clears what was typed for it.
      if (q.otherOption === option) setAnswer(`${q.key}_other`, null);
      if (q.detail?.option === option) setAnswer(q.detail.key, null);
    } else if (picked.length < max) {
      setAnswer(q.key, [...picked, option]);
    } else {
      toast.message(`Rank up to ${max}. Click a ranked one to remove it first.`);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={q.label}>
        {q.options?.map((option) => {
          const index = picked.indexOf(option);
          const on = index > -1;
          return (
            <button
              key={option}
              type="button"
              disabled={disabled}
              aria-pressed={on}
              onClick={() => toggle(option)}
              className={cn(
                "inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 text-left text-body-sm transition-colors disabled:cursor-not-allowed",
                on
                  ? "border-primary-700 bg-primary-100 font-semibold text-primary-900"
                  : "border-neutral-300 bg-white text-neutral-700 hover:border-primary-300"
              )}
            >
              {ranked ? (
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full text-caption font-bold",
                    on ? "bg-primary-700 text-white" : "border-[1.5px] border-dashed border-neutral-300"
                  )}
                >
                  {on ? index + 1 : ""}
                </span>
              ) : (
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded border-[1.5px]",
                    on ? "border-primary-700 bg-primary-700 text-white" : "border-neutral-400"
                  )}
                >
                  {on && <Check className="size-3" strokeWidth={3} />}
                </span>
              )}
              {option}
            </button>
          );
        })}
      </div>

      {q.otherOption && picked.includes(q.otherOption) && (
        <OtherBox
          id={`${q.key}_other`}
          label="Other position(s):"
          value={answers[`${q.key}_other`]}
          onChange={(v) => setAnswer(`${q.key}_other`, v)}
          disabled={disabled}
          placeholder="e.g. Practice Administrator, Office Manager"
        />
      )}
      {q.detail && picked.includes(q.detail.option) && (
        <OtherBox
          id={q.detail.key}
          label={`${q.detail.label}:`}
          type={q.detail.type}
          value={answers[q.detail.key]}
          onChange={(v) => setAnswer(q.detail!.key, v)}
          disabled={disabled}
          placeholder={q.detail.type === "number" ? "e.g. 1500" : "Which ones?"}
        />
      )}
      {q.other && (
        <OtherBox
          id={`${q.key}_other`}
          label="Others:"
          value={answers[`${q.key}_other`]}
          onChange={(v) => setAnswer(`${q.key}_other`, v)}
          disabled={disabled}
          placeholder="Anything not listed"
        />
      )}
    </div>
  );
}

function QuestionField({
  q,
  answers,
  setAnswer,
  disabled,
}: {
  q: QuestionDef;
  answers: QuestionnaireAnswers;
  setAnswer: (key: string, v: AnswerValue) => void;
  disabled: boolean;
}) {
  const value = answers[q.key];
  const onChange = (v: AnswerValue) => setAnswer(q.key, v);

  if (q.type === "multi" || q.type === "rank") {
    return <ChoiceChips q={q} answers={answers} setAnswer={setAnswer} disabled={disabled} />;
  }
  if (q.type === "list") {
    const items = Array.isArray(value) ? value : [];
    const boxes = q.max ?? 5;
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
        {Array.from({ length: boxes }, (_, i) => (
          <label key={i} className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-caption font-bold text-neutral-400">
              {i + 1}
            </span>
            <Input
              className="pl-7"
              aria-label={`${q.label} ${i + 1}`}
              value={items[i] ?? ""}
              disabled={disabled}
              placeholder="Competitor"
              onChange={(e) => {
                const next = Array.from({ length: boxes }, (_, j) => (j === i ? e.target.value : (items[j] ?? "")));
                onChange(next.some((v) => v.trim()) ? next : null);
              }}
            />
          </label>
        ))}
      </div>
    );
  }
  if (q.type === "number") {
    return (
      <Input
        type="number"
        className="max-w-[160px]"
        value={typeof value === "number" || typeof value === "string" ? value : ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        placeholder="Enter a number"
      />
    );
  }
  if (q.type === "text") {
    return (
      <textarea
        className={cn(TEXTAREA_CLASS, q.long ? "h-24" : "h-16")}
        value={typeof value === "string" ? value : ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        placeholder="Type your answer…"
      />
    );
  }
  if (q.type === "select") {
    return (
      <select
        className="h-9 w-full rounded-md border border-neutral-300 bg-white px-3 text-body text-neutral-800 focus-visible:outline-none focus-visible:border-secondary-500 focus-visible:ring-2 focus-visible:ring-secondary-500/40"
        value={typeof value === "string" ? value : ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
      >
        <option value="">Choose…</option>
        {q.options?.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  if (q.type === "scale") {
    return (
      <div className="inline-flex gap-1.5 justify-self-start">
        {[1, 2, 3, 4].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(value === n ? null : n)}
            className={cn(
              "flex size-9 items-center justify-center rounded-md border text-body-sm font-bold",
              value === n
                ? "border-primary-700 bg-primary-700 text-white"
                : "border-neutral-300 bg-white text-neutral-600 hover:border-primary-300"
            )}
          >
            {n}
          </button>
        ))}
      </div>
    );
  }
  // yesno — a fixed-width segmented control with two equal halves. As a
  // grid cell it used to stretch to the full 260px answer column, leaving
  // all the spare width trailing after "No" inside the border.
  return (
    <div
      role="group"
      aria-label="Yes or no"
      className="grid w-40 grid-cols-2 overflow-hidden rounded-md border border-neutral-300 justify-self-start"
    >
      {(["yes", "no"] as const).map((option) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onChange(selected ? null : option)}
            className={cn(
              "h-9 text-body-sm font-semibold transition-colors focus-visible:relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-secondary-500/60 disabled:cursor-not-allowed",
              option === "no" && "border-l border-neutral-300",
              selected
                ? option === "yes"
                  ? "bg-success-100 text-success-800"
                  : "bg-error-100 text-error-700"
                : "bg-white text-neutral-600 hover:bg-neutral-50"
            )}
          >
            {option === "yes" ? "Yes" : "No"}
          </button>
        );
      })}
    </div>
  );
}

const PARTS = [
  { part: "growth" as const, label: "Growth Solution" },
  { part: "icp" as const, label: "Ideal Customer Profile" },
];

/**
 * Client-confirmed (2026-09-15), Concept A — Stepped: one of the
 * questionnaire's sections per screen, a dot-and-line progress stepper,
 * Save & Continue / Back, and "Skip for now" always available (App Flow has
 * no real Onboarding Wizard built to attach this to despite documenting one
 * — see the redirect in AcceptInviteForm for where this hooks in for a
 * fresh Owner instead). Answers save to growth_questionnaire_responses (one
 * row per account, jsonb keyed by question key) on every Continue/Skip/
 * Finish, not per keystroke.
 *
 * Client-confirmed (2026-10-14, approved mockup "ICP Questionnaire Steps"):
 * the SniperLeads ICP Worksheet follows as five more steps, so the stepper
 * is now two labelled parts. Tick lists, rankings and the competitor list
 * take the full row, with the label above.
 */
export function GrowthQuestionnaireWizard({
  accountId,
  initialAnswers,
  canEdit,
  exitHref,
  initialStepKey,
}: {
  accountId: string;
  initialAnswers: QuestionnaireAnswers;
  canEdit: boolean;
  exitHref: string;
  /** Open on this section (?step=), e.g. from the ICP Mission Card's Edit links. */
  initialStepKey?: string;
}) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(() => Math.max(0, QUESTIONNAIRE_SECTIONS.findIndex((s) => s.key === initialStepKey)));
  const [answers, setAnswers] = useState<QuestionnaireAnswers>(initialAnswers);
  const [saving, setSaving] = useState(false);

  const section = QUESTIONNAIRE_SECTIONS[stepIndex];
  const answeredCount = countAnswered(answers);
  const complete = isComplete(answers);

  const setAnswer = (key: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const save = async (markCompleteIfDone: boolean) => {
    setSaving(true);
    const supabase = createClient();
    const nowComplete = isComplete(answers);
    const { error } = await supabase.from("growth_questionnaire_responses").upsert(
      {
        account_id: accountId,
        answers,
        completed_at: markCompleteIfDone && nowComplete ? new Date().toISOString() : null,
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
    if (stepIndex < QUESTIONNAIRE_SECTIONS.length - 1) {
      setStepIndex((i) => i + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      toast.success(isComplete(answers) ? "Questionnaire complete." : "Progress saved.");
      router.push(exitHref);
      router.refresh();
    }
  };

  const handleSkip = async () => {
    await save(false);
    router.push(exitHref);
    router.refresh();
  };

  const handleExportPdf = () => {
    window.open(`/api/questionnaire/export?account_id=${accountId}`, "_blank");
  };

  const Icon = SECTION_ICON[section.icon];

  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-h1 text-primary-900">GrowthMission Solution Questionnaire</h1>
      <p className="mb-5 max-w-[62ch] text-body-sm text-neutral-500">
        Designed to support MSPs during onboarding and surface where CRO Leader can help accelerate growth.
        Answering it often highlights opportunities on its own — and unlocks a free consultation to review your
        results.
      </p>

      <div className="mb-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-secondary-500 to-success-500"
            style={{ width: `${Math.round((answeredCount / TOTAL_QUESTION_COUNT) * 100)}%` }}
          />
        </div>
        <span className="shrink-0 text-caption font-semibold tabular-nums text-neutral-600">
          {answeredCount} of {TOTAL_QUESTION_COUNT} answered
        </span>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-[8fr_5fr]">
        {PARTS.map(({ part, label }) => {
          const steps = QUESTIONNAIRE_SECTIONS.map((s, i) => ({ s, i })).filter(({ s }) => s.part === part);
          return (
            <div key={part}>
              <p
                className={cn(
                  "mb-1.5 text-caption font-bold uppercase tracking-wide",
                  part === "icp" ? "text-secondary-800" : "text-neutral-400"
                )}
              >
                {label} · {steps.length} {part === "icp" ? "steps" : "sections"}
              </p>
              <div className="flex items-center gap-1.5">
                {steps.map(({ s, i }, n) => (
                  <div key={s.key} className={cn("flex items-center gap-1.5", n < steps.length - 1 && "flex-1")}>
                    <button
                      type="button"
                      onClick={() => setStepIndex(i)}
                      title={s.name}
                      aria-label={`${i + 1}. ${s.name}`}
                      aria-current={i === stepIndex ? "step" : undefined}
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
                    {n < steps.length - 1 && (
                      <div className={cn("h-0.5 flex-1", i < stepIndex ? "bg-success-400" : "bg-neutral-200")} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-neutral-100 px-5 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
            <Icon className="size-4" />
          </span>
          <span className="flex-1">
            {section.part === "icp" && (
              <span className="block text-caption font-bold uppercase tracking-wide text-secondary-700">
                Ideal Customer Profile
              </span>
            )}
            <span className="block text-h4 text-primary-900">{section.name}</span>
          </span>
          <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-caption font-semibold text-neutral-500">
            Section {stepIndex + 1} of {QUESTIONNAIRE_SECTIONS.length}
          </span>
        </div>
        {section.intro && (
          <p className="mx-5 mt-4 rounded-md border border-dashed border-secondary-300 bg-secondary-50 px-3 py-2 text-body-sm text-secondary-800">
            {section.intro}
          </p>
        )}
        <div className="flex flex-col px-5">
          {section.questions.map((q, i) => {
            const wide = isWide(q);
            return (
              <div
                key={q.key}
                className={cn(
                  "grid items-start py-4",
                  wide ? "grid-cols-1 gap-2.5" : "grid-cols-1 gap-2.5 sm:grid-cols-[1fr_260px] sm:gap-6",
                  i > 0 && "border-t border-neutral-100"
                )}
              >
                <div className={cn("text-body-sm text-neutral-800", !wide && "sm:pt-2")}>
                  <p className="flex items-center gap-1.5">
                    {q.label}
                    {q.tip && <InfoTip text={q.tip} label={`About ${q.label}`} />}
                  </p>
                  {q.hint && <p className="mt-0.5 text-caption text-neutral-500">{q.hint}</p>}
                </div>
                <QuestionField q={q} answers={answers} setAnswer={setAnswer} disabled={!canEdit} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          {stepIndex > 0 && (
            <Button variant="secondary" onClick={() => setStepIndex((i) => i - 1)} disabled={saving}>
              ← Back
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {complete && (
            <Button variant="ghost" onClick={handleExportPdf}>
              <Download className="mr-1.5 size-4" />
              Export PDF
            </Button>
          )}
          <button type="button" className="text-body-sm font-semibold text-secondary-700 hover:underline" onClick={handleSkip} disabled={saving}>
            Skip for now, remind me later
          </button>
          {canEdit && (
            <Button onClick={handleContinue} disabled={saving}>
              {saving ? "Saving…" : stepIndex < QUESTIONNAIRE_SECTIONS.length - 1 ? "Save & Continue →" : "Finish"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
