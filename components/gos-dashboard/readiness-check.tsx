"use client";

import { Check, ChevronDown, ChevronUp, Minus, OctagonAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { DocReadiness, Readiness } from "@/lib/gos-dashboard/queries";

/**
 * The Playbook doc's "Before You Begin — STOP".
 *
 * Client-confirmed (2026-09-24): it sits above the hero rather than below
 * it, and it measures the three account documents — Company Profile,
 * Solution Questionnaire, Vision Board — instead of the doc's original
 * website-and-ICP pair. That is a stricter test rather than a looser one,
 * since the website is one of the Company Profile's eleven fields and the
 * written ICP is one of the Questionnaire's questions; both foundations are
 * still required, just as part of finishing the documents that hold them.
 * Each incomplete document links to itself.
 *
 * Client-confirmed (2026-09-18): the strip can be hidden. Collapsed it
 * leaves a single line saying whether the foundations are in place, so the
 * state is never lost — just quiet. The choice is remembered per browser;
 * unreadable storage simply falls back to showing it.
 *
 * The storage key carries a version: the strip now checks something
 * different, so anyone who hid the old one should see the new one once
 * rather than inherit a dismissal of a different question.
 */
const STORAGE_KEY = "gos-readiness-hidden-v2";

interface Item {
  label: string;
  href: string;
  action: string;
  doc: DocReadiness;
}

export function ReadinessCheck({ readiness }: { readiness: Readiness }) {
  const [hidden, setHidden] = useState(false);
  const { ready } = readiness;

  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // Blocked storage just means the strip stays visible.
    }
  }, []);

  const toggle = () => {
    setHidden((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Ignore — the toggle still works for this page view.
      }
      return next;
    });
  };

  const items: Item[] = [
    { label: "Company Profile", href: "/settings/company", action: "Complete it", doc: readiness.profile },
    {
      label: "Solution Questionnaire",
      href: "/settings/growth-questionnaire",
      action: readiness.questionnaire.done === 0 ? "Start it" : "Finish it",
      doc: readiness.questionnaire,
    },
    {
      label: "Vision Board",
      href: "/settings/vision-board",
      action: readiness.visionBoard.done === 0 ? "Start it" : "Finish it",
      doc: readiness.visionBoard,
    },
  ];

  const outstanding = items.filter((i) => !i.doc.complete);

  const ToggleButton = () => (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={!hidden}
      className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-caption font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40 ${
        ready ? "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700" : "text-warning-800 hover:bg-warning-100"
      }`}
    >
      {hidden ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
      {hidden ? "Show" : "Hide"}
    </button>
  );

  if (hidden) {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg border px-4 py-2 ${
          ready ? "border-neutral-200 bg-white" : "border-warning-300 bg-warning-50"
        }`}
      >
        {ready ? (
          <span className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-neutral-700">
            <ShieldCheck className="size-4 text-success-600" />
            Ready to run the GrowthOS Strategy &amp; Assignments
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-warning-800">
            <OctagonAlert className="size-4" />
            Before You Begin — {outstanding.length} of 3 foundations still to complete
          </span>
        )}
        <ToggleButton />
      </div>
    );
  }

  if (ready) {
    return (
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-neutral-700">
          <ShieldCheck className="size-4 text-success-600" />
          Ready to run the GrowthOS Strategy &amp; Assignments
        </span>
        {items.map((item) => (
          <CheckItem key={item.label} ok>
            {item.label}
          </CheckItem>
        ))}
        <ToggleButton />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 rounded-lg border border-warning-300 bg-warning-50 px-4 py-3">
      <span className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-warning-800">
        <OctagonAlert className="size-4" />
        Before You Begin
      </span>
      <ToggleButton />
      <p className="basis-full text-body-sm leading-relaxed text-neutral-600">
        Nothing in the GrowthOS Strategy &amp; Assignments will work until all three foundations are complete: your
        Company Profile, your Solution Questionnaire and your Vision Board.
      </p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {items.map((item) => (
          <CheckItem key={item.label} ok={item.doc.complete}>
            {item.label}
            <span className="text-neutral-400"> · {describe(item.doc)}</span>
            {!item.doc.complete && (
              <>
                {" · "}
                <Link href={item.href} className="font-semibold text-secondary-700 hover:underline">
                  {item.action} →
                </Link>
              </>
            )}
          </CheckItem>
        ))}
      </div>
    </div>
  );
}

function describe(doc: DocReadiness) {
  if (doc.complete) return `${doc.total} of ${doc.total}`;
  if (doc.done === 0) return "not started";
  return `${doc.done} of ${doc.total}`;
}

function CheckItem({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-body-sm text-neutral-700">
      <span
        className={`flex size-[18px] shrink-0 items-center justify-center rounded-full ${
          ok ? "bg-success-100 text-success-700" : "bg-warning-200 text-warning-800"
        }`}
      >
        {ok ? <Check className="size-3" strokeWidth={2.5} /> : <Minus className="size-3" strokeWidth={2.5} />}
      </span>
      <span>{children}</span>
    </span>
  );
}
