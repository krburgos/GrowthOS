"use client";

import { Check, Copy, FileText, Phone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { NAVY_GRADIENT } from "@/components/shell/hero-band";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { prospectValue } from "@/lib/companies/value";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import {
  OUTCOMES,
  addBusinessDays,
  dateKey,
  lastTouch,
  phoneLines,
  telHref,
  type CallOutcome,
  type QueueRow,
} from "@/lib/sdr/desk";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Callback = "tomorrow" | "two" | "week" | "date";

const FIELD = "text-[11px] font-bold uppercase tracking-wide text-neutral-500";

function followUpFor(outcome: CallOutcome, callback: Callback, pickedDate: string): string | null {
  const now = new Date();
  if (outcome === "no_answer" || outcome === "voicemail") return dateKey(addBusinessDays(now, 2));
  if (outcome !== "connected") return null;
  if (callback === "date") return pickedDate || null;
  if (callback === "two") return dateKey(addBusinessDays(now, 2));
  const d = new Date(now);
  d.setDate(d.getDate() + (callback === "week" ? 7 : 1));
  return dateKey(d);
}

/**
 * Log a call from the Call Queue (client-confirmed, 2026-10-22, approved
 * mockup "Mission Card Workspaces"). The call is an ordinary `call`
 * activity, so it shows on the contact's timeline and in Reports; the
 * outcome and follow-up date decide when the contact is due again. Meeting
 * booked also creates the opportunity at FME Scheduled and a meeting on its
 * timeline. Inserts go straight to Supabase under RLS, like Contact
 * Detail's own Log activity.
 */
export function LogCallPanel({
  row,
  accountId,
  meetingStageId,
  salespeople,
  scriptName,
  onClose,
  onSaved,
  slideIn = false,
}: {
  row: QueueRow;
  accountId: string;
  meetingStageId: string | null;
  salespeople: { id: string; full_name: string }[];
  /** The Arsenal's call script, when it has one, linked for reading mid-call. */
  scriptName: string | null;
  onClose: () => void;
  /** `next`: open the next due contact rather than closing. */
  onSaved: (next: boolean) => void;
  /** Arrived by Save & next call: the contents slide in (Design System §Motion). */
  slideIn?: boolean;
}) {
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [note, setNote] = useState("");
  const [callback, setCallback] = useState<Callback>("tomorrow");
  const [pickedDate, setPickedDate] = useState("");
  // Names are capped at 60 characters (2026-10-26).
  const [oppName, setOppName] = useState(`${row.company_name ?? row.full_name} — Managed IT`.slice(0, 60));
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("10:00");
  const [salesperson, setSalesperson] = useState(salespeople[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  const lines = phoneLines(row).filter((l): l is { label: string; number: string } => !!l.number);
  const hint = OUTCOMES.find((o) => o.value === outcome)?.hint;
  const ready =
    !!outcome &&
    (outcome !== "meeting_booked" || (!!meetingDate && !!meetingStageId)) &&
    (outcome !== "connected" || callback !== "date" || !!pickedDate);

  const copyPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      toast.success("Number copied.");
    } catch {
      toast.error("Couldn't copy. Select the number instead.");
    }
  };

  const save = async (next: boolean) => {
    if (!outcome || !ready) return;
    // Every opportunity has a name (2026-10-26).
    if (outcome === "meeting_booked" && !oppName.trim()) {
      toast.error("Give the opportunity a name.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const label = OUTCOMES.find((o) => o.value === outcome)!.label;

    let opportunityId: string | null = null;
    if (outcome === "meeting_booked") {
      const { data, error } = await supabase
        .from("opportunities")
        .insert({
          account_id: accountId,
          contact_id: row.contact_id,
          owner_id: salesperson || null,
          name: oppName.trim(),
          value: prospectValue(row.company_size) || null,
          stage_id: meetingStageId,
        })
        .select("id")
        .single();
      if (error || !data) {
        setSaving(false);
        toast.error(getFriendlyErrorMessage(error));
        return;
      }
      opportunityId = data.id;
    }

    const { error } = await supabase.from("activities").insert({
      account_id: accountId,
      contact_id: row.contact_id,
      opportunity_id: opportunityId,
      user_id: user!.id,
      type: "call",
      subject: `Call · ${label}`,
      body: note.trim() || null,
      call_outcome: outcome,
      follow_up_on: followUpFor(outcome, callback, pickedDate),
    });
    if (error) {
      setSaving(false);
      toast.error(getFriendlyErrorMessage(error));
      return;
    }

    if (opportunityId) {
      const { error: meetingError } = await supabase.from("activities").insert({
        account_id: accountId,
        contact_id: row.contact_id,
        opportunity_id: opportunityId,
        user_id: user!.id,
        type: "meeting",
        subject: "First meeting",
        due_at: new Date(`${meetingDate}T${meetingTime || "10:00"}`).toISOString(),
      });
      // The call and the opportunity are saved either way; say so plainly.
      if (meetingError) toast.error("Opportunity created, but the meeting wasn't added to its timeline.");
    }

    setSaving(false);
    toast.success(opportunityId ? `Meeting booked · opportunity created for ${row.company_name ?? row.full_name}.` : `Call logged · ${label}.`);
    onSaved(next);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="left-auto right-0 top-0 flex h-dvh max-h-dvh w-full max-w-[460px] translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:rounded-l-lg [&>button]:text-white/80 [&>button]:hover:text-white">
        <div className={cn(`px-5 py-4 pr-12 ${NAVY_GRADIENT}`, slideIn && "[&>*]:animate-slide-in")}>
          <p className="text-caption font-semibold uppercase tracking-wide text-secondary-300">Log a call</p>
          <DialogTitle className="truncate text-h4 text-white">{row.full_name}</DialogTitle>
          <DialogDescription className="truncate text-body-sm text-white/75">
            {[row.title, row.company_name].filter(Boolean).join(" · ") || "No title or company"}
          </DialogDescription>
        </div>

        <div className={cn("flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5", slideIn && "animate-slide-in")}>
          {/* Direct and Company, each dialable (client-confirmed, 2026-10-27). */}
          <div className="flex flex-col gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3.5 py-3">
            {lines.length === 0 && (
              <span className="flex items-center gap-2 text-body-sm text-neutral-500">
                <Phone className="size-4 text-secondary-700" aria-hidden="true" />
                No phone number on this contact or company
              </span>
            )}
            {lines.map(({ label, number }) => (
              <div key={label} className="flex flex-wrap items-center gap-2">
                <span className="w-[60px] shrink-0 text-[10px] font-bold uppercase tracking-wide text-primary-700">{label}</span>
                <span className="min-w-0 select-all text-h4 tabular-nums text-primary-900">{number}</span>
                <span className="ml-auto flex gap-1.5">
                  <a
                    href={telHref(number)}
                    className="inline-flex h-7 items-center gap-1.5 rounded-md bg-secondary-700 px-2.5 text-body-sm font-semibold text-white hover:bg-secondary-800"
                  >
                    <Phone className="size-3.5" />
                    Call
                  </a>
                  <button
                    type="button"
                    onClick={() => void copyPhone(number)}
                    aria-label={`Copy ${label.toLowerCase()} number`}
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 text-body-sm text-primary-700 hover:border-primary-700"
                  >
                    <Copy className="size-3.5" />
                    Copy
                  </button>
                </span>
              </div>
            ))}
            <p className="text-caption text-primary-700">
              Attempt {row.attempts + 1} · last: {lastTouch(row)}
            </p>
          </div>

          {scriptName && (
            <a
              href="#arsenal"
              onClick={onClose}
              className="flex items-center gap-2 text-body-sm font-semibold text-secondary-700 hover:underline"
            >
              <FileText className="size-4" />
              {scriptName} <span className="font-normal text-neutral-400">(in the Arsenal)</span>
            </a>
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className={`mb-2 ${FIELD}`}>Outcome</legend>
            <div className="grid grid-cols-2 gap-2">
              {OUTCOMES.map((o) => {
                const on = o.value === outcome;
                const meeting = o.value === "meeting_booked";
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setOutcome(o.value)}
                    className={cn(
                      "flex h-10 items-center gap-1.5 rounded-md border px-3 text-left text-body-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40",
                      meeting && "col-span-2",
                      on
                        ? meeting
                          ? "border-success-600 bg-success-100 text-success-800"
                          : "border-primary-700 bg-primary-50 text-primary-900"
                        : "border-neutral-300 bg-white text-neutral-700 hover:border-primary-700"
                    )}
                  >
                    {on && <Check className="size-3.5" />}
                    {o.label}
                  </button>
                );
              })}
            </div>
            {hint && <p className="text-caption text-neutral-500">{hint}</p>}
          </fieldset>

          {outcome === "connected" && (
            <div className="flex flex-col gap-1.5">
              <span className={FIELD}>Call back</span>
              <Select value={callback} onValueChange={(v) => setCallback(v as Callback)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tomorrow">Tomorrow</SelectItem>
                  <SelectItem value="two">In 2 business days</SelectItem>
                  <SelectItem value="week">Next week</SelectItem>
                  <SelectItem value="date">Pick a date…</SelectItem>
                </SelectContent>
              </Select>
              {callback === "date" && (
                <Input type="date" value={pickedDate} min={dateKey(new Date())} onChange={(e) => setPickedDate(e.target.value)} aria-label="Call back on" />
              )}
            </div>
          )}

          {outcome === "meeting_booked" && (
            <div className="flex flex-col gap-3 rounded-lg border border-success-200 bg-success-50 p-3.5">
              <p className="text-body-sm font-semibold text-success-800">New opportunity · FME Scheduled</p>
              {!meetingStageId && (
                <p className="text-body-sm text-error-700">This account has no open opportunity stage, so a meeting can&apos;t be booked here yet.</p>
              )}
              <label className="flex flex-col gap-1.5">
                <span className={FIELD}>Opportunity</span>
                <Input value={oppName} maxLength={60} onChange={(e) => setOppName(e.target.value)} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1.5">
                  <span className={FIELD}>Meeting date</span>
                  <Input type="date" value={meetingDate} min={dateKey(new Date())} onChange={(e) => setMeetingDate(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={FIELD}>Time</span>
                  <Input type="time" value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} />
                </label>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className={FIELD}>Meeting with (salesperson)</span>
                <Select value={salesperson} onValueChange={setSalesperson}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a salesperson" />
                  </SelectTrigger>
                  <SelectContent>
                    {salespeople.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <label className="flex flex-col gap-1.5">
            <span className={FIELD}>Note</span>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you learn?" />
          </label>
          <p className="text-caption text-neutral-500">Saved as a call on {row.full_name}&apos;s timeline.</p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-neutral-200 px-5 py-3">
          <Button variant="secondary" disabled={!ready || saving} onClick={() => save(false)}>
            Save
          </Button>
          <Button disabled={!ready || saving} onClick={() => save(true)}>
            {saving ? "Saving…" : "Save & next call"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
