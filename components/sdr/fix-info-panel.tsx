"use client";

import { useState } from "react";
import { toast } from "sonner";

import { NAVY_GRADIENT } from "@/components/shell/hero-band";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import type { QueueRow } from "@/lib/sdr/desk";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const FIELD = "text-[11px] font-bold uppercase tracking-wide text-neutral-500";

function BadTag() {
  return (
    <span className="rounded-full bg-warning-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning-800">Bad</span>
  );
}

/**
 * Scrub List · fix contact info (client-confirmed, 2026-11-02, approved
 * mockup "Call Logs and Scrub List Mockup"). Whoever works the Scrub List
 * corrects the details here instead of logging a call. A changed number
 * loses its Bad tag (a database trigger). Save & send back returns the
 * contact to the lists it was scrubbed from; Can't find it takes it off the
 * Scrub List and leaves it on no list, with a note on its timeline. The
 * contact itself is never deleted.
 */
export function FixInfoPanel({ row, onClose, onDone }: { row: QueueRow; onClose: () => void; onDone: () => void }) {
  const [phone, setPhone] = useState(row.phone ?? "");
  const [companyPhone, setCompanyPhone] = useState(row.company_phone ?? "");
  const [email, setEmail] = useState(row.email ?? "");
  const [title, setTitle] = useState(row.title ?? "");
  const [busy, setBusy] = useState<"" | "save" | "back" | "drop">("");

  const phoneChanged = phone.trim() !== (row.phone ?? "").trim();
  const companyChanged = companyPhone.trim() !== (row.company_phone ?? "").trim();
  const directBad = row.phone_bad && !phoneChanged;
  const companyBad = row.company_phone_bad && !companyChanged;
  const hasGood = (!!phone.trim() && !directBad) || (!!companyPhone.trim() && !companyBad);

  async function saveDetails(): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase
      .from("contacts")
      .update({ phone: phone.trim() || null, email: email.trim() || row.email, title: title.trim() || null })
      .eq("id", row.contact_id);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return false;
    }
    if (row.company_id && companyChanged) {
      const { error: companyError } = await supabase
        .from("companies")
        .update({ phone: companyPhone.trim() || null })
        .eq("id", row.company_id);
      if (companyError) {
        toast.error(getFriendlyErrorMessage(companyError));
        return false;
      }
    }
    return true;
  }

  async function handleSave(sendBack: boolean) {
    setBusy(sendBack ? "back" : "save");
    const ok = await saveDetails();
    if (ok && sendBack) {
      const { error } = await createClient().rpc("resolve_scrub", { p_contact_id: row.contact_id, p_send_back: true });
      if (error) {
        setBusy("");
        toast.error(getFriendlyErrorMessage(error));
        return;
      }
      toast.success(`${row.full_name} is back on their lists.`);
    } else if (ok) {
      toast.success("Details saved.");
    }
    setBusy("");
    if (ok) onDone();
  }

  async function handleCantFind() {
    setBusy("drop");
    const { error } = await createClient().rpc("resolve_scrub", { p_contact_id: row.contact_id, p_send_back: false });
    setBusy("");
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success(`${row.full_name} taken off the Scrub List.`);
    onDone();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="left-auto right-0 top-0 flex h-dvh max-h-dvh w-full max-w-[460px] translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:rounded-l-lg [&>button]:text-white/80 [&>button]:hover:text-white">
        <div className={`px-5 py-4 pr-12 ${NAVY_GRADIENT}`}>
          <p className="text-caption font-semibold uppercase tracking-wide text-secondary-300">Scrub · fix contact info</p>
          <DialogTitle className="truncate text-h4 text-white">{row.full_name}</DialogTitle>
          <DialogDescription className="truncate text-body-sm text-white/75">
            {[row.title, row.company_name].filter(Boolean).join(" · ") || "No title or company"}
          </DialogDescription>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
          <label className="flex flex-col gap-1.5">
            <span className={cn(FIELD, "flex items-center gap-2")}>
              Direct phone {directBad && <BadTag />}
            </span>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className={cn("tabular-nums", directBad && "border-warning-700")} />
          </label>
          {row.company_id && (
            <label className="flex flex-col gap-1.5">
              <span className={cn(FIELD, "flex items-center gap-2")}>
                Company phone {companyBad && <BadTag />}
              </span>
              <Input
                value={companyPhone}
                onChange={(e) => setCompanyPhone(e.target.value)}
                className={cn("tabular-nums", companyBad && "border-warning-700")}
              />
            </label>
          )}
          <label className="flex flex-col gap-1.5">
            <span className={FIELD}>Email</span>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={FIELD}>Title</span>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <p className="text-caption text-neutral-500">
            Changing a bad number clears its Bad tag.{row.company_id ? " The company phone is shared by everyone at the company." : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 px-5 py-3">
          <Button variant="ghost" onClick={handleCantFind} disabled={busy !== ""} className="mr-auto">
            {busy === "drop" ? "Saving…" : "Can't find it"}
          </Button>
          <Button variant="secondary" onClick={() => handleSave(false)} disabled={busy !== ""}>
            {busy === "save" ? "Saving…" : "Save"}
          </Button>
          <Button
            onClick={() => handleSave(true)}
            disabled={busy !== "" || !hasGood}
            title={hasGood ? undefined : "Add a working phone number first."}
          >
            {busy === "back" ? "Sending…" : "Save & send back"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
