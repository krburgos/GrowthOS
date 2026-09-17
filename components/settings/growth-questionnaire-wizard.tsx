"use client";

import {
  Building2,
  Cog,
  Download,
  GraduationCap,
  Magnet,
  Megaphone,
  Target,
  Users,
  Globe as GlobeIcon,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import {
  QUESTIONNAIRE_SECTIONS,
  TOTAL_QUESTION_COUNT,
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
};

type Answers = Record<string, string | number | null>;

function QuestionField({
  q,
  value,
  onChange,
  disabled,
}: {
  q: QuestionDef;
  value: string | number | null | undefined;
  onChange: (v: string | number | null) => void;
  disabled: boolean;
}) {
  if (q.type === "number") {
    return (
      <Input
        type="number"
        className="max-w-[160px]"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        placeholder="Enter a number"
      />
    );
  }
  if (q.type === "text") {
    return (
      <textarea
        className="h-16 w-full resize-y rounded-md border border-neutral-300 px-3 py-2 text-body focus-visible:outline-none focus-visible:border-secondary-500 focus-visible:ring-2 focus-visible:ring-secondary-500/40"
        value={(value as string) ?? ""}
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
        value={(value as string) ?? ""}
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

/**
 * Client-confirmed (2026-09-15), Concept A — Stepped: one of the
 * questionnaire's 8 sections per screen, a dot-and-line progress
 * stepper, Save & Continue / Back, and "Skip for now" always available
 * (App Flow has no real Onboarding Wizard built to attach this to
 * despite documenting one — see the redirect in AcceptInviteForm for
 * where this hooks in for a fresh Owner instead). Answers save to
 * growth_questionnaire_responses (one row per account, jsonb keyed by
 * question key) on every Continue/Skip/Finish, not per keystroke.
 */
export function GrowthQuestionnaireWizard({
  accountId,
  initialAnswers,
  canEdit,
  exitHref,
}: {
  accountId: string;
  initialAnswers: Answers;
  canEdit: boolean;
  exitHref: string;
}) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [saving, setSaving] = useState(false);

  const section = QUESTIONNAIRE_SECTIONS[stepIndex];
  const answeredCount = countAnswered(answers);
  const complete = isComplete(answers);

  const setAnswer = (key: string, value: string | number | null) => {
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

  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-h1 text-primary-900">GrowthOS Solution Questionnaire</h1>
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

      <div className="mb-6 flex items-center gap-1.5">
        {QUESTIONNAIRE_SECTIONS.map((s, i) => (
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
            {i < QUESTIONNAIRE_SECTIONS.length - 1 && (
              <div className={cn("h-0.5 flex-1", i < stepIndex ? "bg-success-400" : "bg-neutral-200")} />
            )}
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-neutral-100 px-5 py-4">
          {(() => {
            const Icon = SECTION_ICON[section.icon];
            return (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
                <Icon className="size-4" />
              </span>
            );
          })()}
          <span className="flex-1 text-h4 text-primary-900">{section.name}</span>
          <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-caption font-semibold text-neutral-500">
            Section {stepIndex + 1} of {QUESTIONNAIRE_SECTIONS.length}
          </span>
        </div>
        <div className="flex flex-col px-5">
          {section.questions.map((q, i) => (
            <div key={q.key} className={cn("grid grid-cols-[1fr_260px] items-start gap-6 py-4", i > 0 && "border-t border-neutral-100")}>
              <p className="pt-2 text-body-sm text-neutral-800">{q.label}</p>
              <QuestionField q={q} value={answers[q.key]} onChange={(v) => setAnswer(q.key, v)} disabled={!canEdit} />
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
