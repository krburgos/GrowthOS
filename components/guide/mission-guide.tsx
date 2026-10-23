"use client";

import { ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import type { UserRole } from "@/lib/auth/get-current-user";
import { getGuideSteps, type GuideAction, type GuideStep } from "@/lib/guide/steps";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const today = () => new Date().toISOString().slice(0, 10);
const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

/** Per-browser conveniences only; the guide works the same without storage. */
function readStore(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStore(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private window or blocked storage: nothing to remember */
  }
}

const KIND_HINT: Record<GuideAction["kind"], string> = {
  do: "Do it yourself",
  assign: "Assign it",
  delegate: "Delegate · credits",
};

/**
 * Mission Control, option A (preview branch, 2026-10-23, mockup "Mission
 * Guide Options"): the GrowthMission figure in the bottom-right corner of
 * every page, with a count of waiting steps. It opens by itself once a day
 * when something is waiting; "Remind me tomorrow" keeps it closed until
 * the next day. The steps come from lib/guide/steps.ts and are re-read on
 * every page change, so finishing one ticks it off.
 */
export function MissionGuide({ accountId, role }: { accountId: string; role: UserRole }) {
  const pathname = usePathname();
  const [steps, setSteps] = useState<GuideStep[] | null>(null);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const snoozeKey = `growthmission.guide.snooze.${accountId}`;
  const seenKey = `growthmission.guide.seen.${accountId}`;

  useEffect(() => {
    let live = true;
    getGuideSteps(createClient(), accountId, role)
      .then((s) => {
        if (!live) return;
        setSteps(s);
        setIndex((i) => (i < s.length ? i : 0));
        const snoozed = (readStore(snoozeKey) ?? "") > today();
        if (s.length > 0 && !snoozed && readStore(seenKey) !== today()) {
          writeStore(seenKey, today());
          setOpen(true);
        }
      })
      .catch(() => live && setSteps([]));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, role, pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (steps === null) return null;
  const step = steps[index];
  const waiting = steps.length;

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 sm:bottom-7 sm:right-7">
      {open && (
        <section
          aria-label="Mission Control"
          className="pointer-events-auto w-[min(380px,calc(100vw-40px))] animate-guide-in overflow-hidden rounded-2xl border border-primary-200 bg-white shadow-raised"
        >
          <div className="flex items-center justify-between border-b border-primary-200 bg-primary-50 px-4 py-2.5">
            <span className="text-caption font-bold uppercase tracking-wide text-primary-700">
              {step ? `Next step · ${index + 1} of ${waiting}` : "Mission Control"}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close Mission Control"
              className="flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-primary-100"
            >
              <X className="size-4" />
            </button>
          </div>

          {step ? (
            <div className="flex flex-col gap-3 p-4">
              <p className="text-h4 text-primary-900">{step.title}</p>
              <p className="text-body text-neutral-700">{step.body}</p>
              <div className="flex flex-col gap-2">
                {step.actions.map((a) => (
                  <Link
                    key={a.kind}
                    href={a.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex min-h-[44px] items-center justify-between gap-3 rounded-lg px-3.5 py-2 text-body font-semibold transition-colors",
                      a.kind === "do"
                        ? "bg-primary-700 text-white hover:bg-primary-800"
                        : a.kind === "delegate"
                          ? "border border-primary-300 bg-primary-50 text-primary-900 hover:bg-primary-100"
                          : "border border-primary-200 text-primary-900 hover:bg-primary-50"
                    )}
                  >
                    <span>{a.label}</span>
                    <span className={cn("text-caption font-medium", a.kind === "do" ? "text-secondary-200" : "text-neutral-500")}>
                      {KIND_HINT[a.kind]}
                    </span>
                  </Link>
                ))}
              </div>
              <div className="flex items-center justify-between text-body-sm">
                <button
                  type="button"
                  onClick={() => {
                    writeStore(snoozeKey, tomorrow());
                    setOpen(false);
                  }}
                  className="font-medium text-neutral-500 hover:text-neutral-700"
                >
                  Remind me tomorrow
                </button>
                {waiting > 1 && (
                  <button
                    type="button"
                    onClick={() => setIndex((i) => (i + 1) % waiting)}
                    className="inline-flex items-center gap-0.5 font-semibold text-secondary-700 hover:text-secondary-800"
                  >
                    Next step
                    <ChevronRight className="size-4" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4">
              <p className="text-h4 text-primary-900">You&apos;re all caught up.</p>
              <p className="mt-1 text-body text-neutral-700">Nothing is waiting on you right now.</p>
            </div>
          )}
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={waiting ? `Mission Control, ${waiting} next ${waiting === 1 ? "step" : "steps"}` : "Mission Control, all caught up"}
        className="pointer-events-auto relative flex size-16 items-center justify-center rounded-full border-[3px] border-white bg-white shadow-raised transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40 sm:size-[72px]"
      >
        <MissionFigure waving={waiting > 0} className="h-[42px] w-9 sm:h-[46px] sm:w-10" />
        {waiting > 0 && (
          <span className="absolute -right-0.5 -top-0.5 size-[22px]" aria-hidden="true">
            <span className="absolute inset-0 animate-ping rounded-full bg-error-500" />
            <span className="absolute inset-0 flex items-center justify-center rounded-full border-2 border-white bg-error-600 text-[11px] font-bold text-white">
              {waiting}
            </span>
          </span>
        )}
      </button>
    </div>
  );
}

/** The GrowthMission mark, drawn so the arm can wave: head, raised arm, body. */
export function MissionFigure({ waving, className }: { waving?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 380 440" className={cn("overflow-visible", className)} aria-hidden="true">
      <path
        d="M0 440 C20 300 120 175 230 168 C290 165 310 230 296 328 C285 250 260 210 215 212 C130 216 50 310 0 440 Z"
        className="fill-secondary-500"
      />
      <path
        d="M62 238 C90 160 170 110 260 98 C320 90 360 50 380 0 C372 80 330 140 250 150 C170 160 100 185 62 238 Z"
        className={cn("fill-primary-900 origin-bottom-left [transform-box:fill-box]", waving && "animate-wave")}
      />
      <circle cx="222" cy="42" r="40" className="fill-primary-900" />
    </svg>
  );
}
