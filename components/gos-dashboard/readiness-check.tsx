"use client";

import { Check, ChevronDown, ChevronUp, Minus, OctagonAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { Readiness } from "@/lib/gos-dashboard/queries";
import { cn } from "@/lib/utils";

function CheckItem({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-body-sm text-neutral-600">
      <span
        className={cn(
          "flex size-[18px] shrink-0 items-center justify-center rounded-full",
          ok ? "bg-success-100 text-success-700" : "bg-warning-100 text-warning-800"
        )}
      >
        {ok ? <Check className="size-3" strokeWidth={2.5} /> : <Minus className="size-3" strokeWidth={2.5} />}
      </span>
      {children}
    </span>
  );
}

function displayWebsite(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/**
 * The Playbook doc's "Before You Begin — STOP" (client-confirmed,
 * 2026-09-17): a website on file in Company settings, and a written ICP —
 * counted as the GrowthOS Solution Questionnaire's target-market answer.
 *
 * Client-confirmed (2026-09-18): the strip can be hidden. Collapsed, it
 * leaves a single line saying whether the foundations are in place, so the
 * state is never lost — just quiet. The choice is remembered per browser;
 * unreadable storage simply falls back to showing it.
 */
const STORAGE_KEY = "gos-readiness-hidden";

export function ReadinessCheck({ readiness }: { readiness: Readiness }) {
  const { website, targetMarket } = readiness;
  const [hidden, setHidden] = useState(false);
  const ready = !!website && !!targetMarket;

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

  const ToggleButton = ({ tone }: { tone: "neutral" | "warning" }) => (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={!hidden}
      className={
        "ml-auto inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-caption font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40 " +
        (tone === "warning"
          ? "text-warning-800 hover:bg-warning-100"
          : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700")
      }
    >
      {hidden ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
      {hidden ? "Show" : "Hide"}
    </button>
  );

  if (hidden) {
    return (
      <div
        className={
          "flex items-center gap-2 rounded-lg border px-4 py-2 " +
          (ready ? "border-neutral-200 bg-white" : "border-warning-300 bg-warning-50")
        }
      >
        {ready ? (
          <span className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-neutral-700">
            <ShieldCheck className="size-4 text-success-600" />
            Ready to run The GrowthOS Strategy and Assignment
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-warning-800">
            <OctagonAlert className="size-4" />
            Before You Begin — {[!website && "website", !targetMarket && "ICP"].filter(Boolean).join(" and ")} still missing
          </span>
        )}
        <ToggleButton tone={ready ? "neutral" : "warning"} />
      </div>
    );
  }

  if (ready) {
    return (
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-neutral-700">
          <ShieldCheck className="size-4 text-success-600" />
          Ready to run The GrowthOS Strategy and Assignment
        </span>
        <CheckItem ok>
          Website on file · <b className="font-semibold text-neutral-800">{displayWebsite(website)}</b>
        </CheckItem>
        <CheckItem ok>
          ICP written · <b className="line-clamp-1 max-w-[40ch] font-semibold text-neutral-800">{targetMarket}</b>
        </CheckItem>
        <ToggleButton tone="neutral" />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-start gap-x-5 gap-y-2 rounded-lg border border-warning-300 bg-warning-50 px-4 py-3.5">
      <span className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-warning-800">
        <OctagonAlert className="size-4" />
        Before You Begin
      </span>
      <div className="flex min-w-[240px] flex-1 flex-col gap-2">
        <p className="max-w-[72ch] text-body-sm text-warning-800">
          Nothing in The GrowthOS Strategy and Assignment will work until both foundations are in place: a functioning website and a written Ideal
          Client Profile.
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <CheckItem ok={!!website}>
            {website ? (
              <>
                Website on file · <b className="font-semibold text-neutral-800">{displayWebsite(website)}</b>
              </>
            ) : (
              <>
                No website on file ·{" "}
                <Link href="/settings/company" className="font-semibold text-primary-700 hover:underline">
                  Add it in Company settings →
                </Link>
              </>
            )}
          </CheckItem>
          <CheckItem ok={!!targetMarket}>
            {targetMarket ? (
              "ICP written"
            ) : (
              <>
                ICP not written yet ·{" "}
                <Link href="/settings/growth-questionnaire" className="font-semibold text-primary-700 hover:underline">
                  Answer the target market question →
                </Link>
              </>
            )}
          </CheckItem>
        </div>
      </div>
      <ToggleButton tone="warning" />
    </div>
  );
}
