"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ActivityTimeline, type ActivityRow } from "@/components/activities/activity-timeline";
import { LogActivityDialog } from "@/components/activities/log-activity-dialog";
import { describe, initials, toOption, type ContactOption, type ContactRow } from "@/components/opportunities/new-opportunity-panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { opportunitiesValue, prospectValue, usd } from "@/lib/companies/value";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import type { StageGroup } from "@/lib/opportunities/stages";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** The search param that opens an opportunity's panel over whatever page it's on. */
const PARAM = "opportunity";
const NOBODY = "__nobody__";
const CAN_EDIT_ROLES = ["msp_owner", "msp_admin", "msp_marketing", "cro_admin", "cro_advisor"];
/** Deleting is narrower (2026-10-26): archive_opportunity() enforces the same list. */
const CAN_DELETE_ROLES = ["msp_owner", "msp_admin", "cro_admin"];

/** This page's address with an opportunity's panel open: filters and views stay as they are. */
export function useOpportunityHref() {
  const pathname = usePathname();
  const params = useSearchParams();
  return useCallback(
    (id: string) => {
      const next = new URLSearchParams(params.toString());
      next.set(PARAM, id);
      return `${pathname}?${next.toString()}`;
    },
    [pathname, params]
  );
}

/** A link that opens the opportunity's panel in place, instead of a page of its own. */
export function OpportunityLink({
  id,
  className,
  title,
  children,
  onClick,
}: {
  id: string;
  className?: string;
  /** The full name on hover, where the link is cut short. */
  title?: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const href = useOpportunityHref();
  return (
    <Link href={href(id)} scroll={false} className={className} title={title} onClick={onClick}>
      {children}
    </Link>
  );
}

/**
 * Mounted once in the app shell: opens the panel for `?opportunity=<id>`.
 * The old /opportunities/[id] page redirects to the board with it set.
 */
export function OpportunityPanelHost({ role }: { role: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const id = params.get(PARAM);
  if (!id) return null;

  const close = () => {
    const next = new URLSearchParams(params.toString());
    next.delete(PARAM);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <OpportunityPanel
      key={id}
      opportunityId={id}
      canEdit={CAN_EDIT_ROLES.includes(role)}
      canDelete={CAN_DELETE_ROLES.includes(role)}
      onClose={close}
    />
  );
}

interface StageOption {
  id: string;
  name: string;
  stage_group: StageGroup;
  win_probability: number;
}

interface Loaded {
  accountId: string;
  contact: ContactOption | null;
  closedAt: string | null;
  stageGroup: StageGroup | null;
}

/**
 * Edit Opportunity (client-confirmed, 2026-10-26, approved mockup "CRM Side
 * Panels"): the New Opportunity panel's layout for an existing one, replacing
 * the Opportunity Detail page. The contact is fixed (Open contact links to
 * it); Prospect and Opportunities Value come from the company's size, as on
 * create, and saving stores that figure. Reports' Revenue from Closed-Won
 * uses the same figure (client-confirmed 2026-10-26), so there is no typed Value.
 * Salesperson is new here. The opportunity's own activity and Log activity
 * sit below the fields.
 *
 * Same day, approved mockup section 4: the name is required, and Owner,
 * Admin or CRO Admin can Delete (archive) an opportunity that isn't Won,
 * after a confirmation. It then disappears everywhere (opportunities RLS).
 */
function OpportunityPanel({
  opportunityId,
  canEdit,
  canDelete,
  onClose,
}: {
  opportunityId: string;
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [stages, setStages] = useState<StageOption[]>([]);
  const [owners, setOwners] = useState<{ id: string; full_name: string }[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [name, setName] = useState("");
  const [stageId, setStageId] = useState("");
  const [ownerId, setOwnerId] = useState(NOBODY);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadActivities = useCallback(async () => {
    const { data } = await createClient()
      .from("activities")
      .select("id, type, subject, body, occurred_at, due_at, completed_at, users(full_name)")
      .eq("opportunity_id", opportunityId)
      .is("archived_at", null)
      .order("occurred_at", { ascending: false });
    setActivities((data ?? []) as ActivityRow[]);
  }, [opportunityId]);

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const { data: opp } = await supabase
        .from("opportunities")
        .select("id, name, stage_id, owner_id, notes, closed_at, account_id, contacts(id, full_name, title, companies(name, company_size))")
        .eq("id", opportunityId)
        .maybeSingle();
      if (!opp) {
        toast.error("That opportunity couldn't be found.");
        onClose();
        return;
      }
      const [{ data: stageRows }, { data: ownerRows }] = await Promise.all([
        supabase
          .from("opportunity_stages")
          .select("id, name, stage_group, win_probability")
          .eq("account_id", opp.account_id)
          .is("archived_at", null)
          .order("sort_order"),
        supabase.from("users").select("id, full_name").eq("account_id", opp.account_id).is("archived_at", null).order("full_name"),
        loadActivities(),
      ]);
      const stageList = (stageRows ?? []) as StageOption[];
      const contactRow = (Array.isArray(opp.contacts) ? opp.contacts[0] : opp.contacts) as ContactRow | null;
      setStages(stageList);
      setOwners((ownerRows ?? []) as { id: string; full_name: string }[]);
      setName(opp.name ?? "");
      setStageId(opp.stage_id ?? "");
      setOwnerId(opp.owner_id ?? NOBODY);
      setNotes(opp.notes ?? "");
      setLoaded({
        accountId: opp.account_id,
        contact: contactRow ? toOption(contactRow) : null,
        closedAt: opp.closed_at,
        stageGroup: stageList.find((s) => s.id === opp.stage_id)?.stage_group ?? null,
      });
    })();
    // onClose changes identity on every render of the host; loading once per opportunity is the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opportunityId, loadActivities]);

  const contact = loaded?.contact ?? null;
  const pv = contact ? prospectValue(contact.companySize) : 0;

  const remove = async () => {
    setDeleting(true);
    const { error } = await createClient().rpc("archive_opportunity", { p_opportunity_id: opportunityId });
    setDeleting(false);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success("Opportunity deleted.");
    setConfirmingDelete(false);
    onClose();
    router.refresh();
  };

  const save = async () => {
    if (!loaded) return;
    if (!name.trim()) {
      toast.error("Give the opportunity a name.");
      return;
    }
    const group = stages.find((s) => s.id === stageId)?.stage_group;
    const closing = group === "won" || group === "lost";
    const wasClosed = loaded.stageGroup === "won" || loaded.stageGroup === "lost";
    setSaving(true);
    const { error } = await createClient()
      .from("opportunities")
      .update({
        name: name.trim(),
        stage_id: stageId || null,
        owner_id: ownerId === NOBODY ? null : ownerId,
        notes: notes.trim() || null,
        value: pv || null,
        // Won or Lost keeps the day it first closed; reopening clears it.
        closed_at: closing ? (wasClosed && loaded.closedAt ? loaded.closedAt : new Date().toISOString()) : null,
      })
      .eq("id", opportunityId);
    setSaving(false);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success("Saved.");
    onClose();
    router.refresh();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="left-auto right-0 top-0 flex h-dvh max-h-dvh w-full max-w-[480px] translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:rounded-l-lg">
        <DialogHeader className="mb-0 flex flex-col gap-2 border-b border-neutral-100 px-6 pb-4 pt-5 pr-12">
          <p className="text-caption font-semibold text-secondary-700">Opportunities</p>
          <DialogTitle>{(loaded && name.trim()) || "Opportunity"}</DialogTitle>
          <DialogDescription className="text-body-sm text-neutral-500">Where it stands, who owns it, and what&apos;s happened.</DialogDescription>
        </DialogHeader>

        {!loaded ? (
          <p className="flex-1 px-6 py-5 text-body-sm text-neutral-400">Loading…</p>
        ) : (
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
            <div className="flex flex-col gap-1.5">
              <span className="text-body-sm text-neutral-500">Contact</span>
              {contact ? (
                <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-caption font-bold text-primary-700">
                    {initials(contact.full_name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-sm font-semibold text-primary-900">{contact.full_name}</span>
                    <span className="block truncate text-caption text-neutral-500">{describe(contact)}</span>
                  </span>
                  <Link href={`/contacts/${contact.id}`} className="shrink-0 text-caption font-semibold text-secondary-700 hover:text-secondary-800">
                    Open contact
                  </Link>
                </div>
              ) : (
                <p className="text-body-sm text-neutral-400">No contact</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-primary-200 bg-primary-200">
              <div className="flex flex-col gap-0.5 bg-primary-50 px-4 py-3">
                <span className="text-caption text-primary-700">Prospect Value</span>
                <span className={cn("text-h3 font-bold tabular-nums", pv ? "text-primary-900" : "text-neutral-300")}>{pv ? usd.format(pv) : "—"}</span>
              </div>
              <div className="flex flex-col gap-0.5 bg-primary-50 px-4 py-3">
                <span className="text-caption text-primary-700">Opportunities Value</span>
                <span className={cn("text-h3 font-bold tabular-nums", pv ? "text-primary-900" : "text-neutral-300")}>
                  {pv ? usd.format(opportunitiesValue(contact?.companySize)) : "—"}
                </span>
              </div>
            </div>

            <fieldset disabled={!canEdit} className="flex flex-col gap-5">
              <label className="flex flex-col gap-1.5">
                <span className="text-body-sm text-neutral-500">
                  Opportunity name <span className="text-error-600">*</span>
                </span>
                <Input value={name} onChange={(e) => setName(e.target.value)} error={canEdit && !name.trim()} />
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-body-sm text-neutral-500">Stage</span>
                  <Select value={stageId} onValueChange={setStageId} disabled={!canEdit}>
                    <SelectTrigger aria-label="Stage">
                      <SelectValue placeholder="Choose a stage">
                        {/* The name only: the list beside it shows each win %. */}
                        <span className="block truncate">{stages.find((s) => s.id === stageId)?.name}</span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <span className="flex w-full items-baseline justify-between gap-3">
                            <span>{s.name}</span>
                            <span className="text-caption tabular-nums text-neutral-400">{s.win_probability}%</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-body-sm text-neutral-500">Salesperson</span>
                  <Select value={ownerId} onValueChange={setOwnerId} disabled={!canEdit}>
                    <SelectTrigger aria-label="Salesperson">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NOBODY}>Nobody yet</SelectItem>
                      {owners.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-body-sm text-neutral-500">Notes</span>
                <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What they're interested in, and what happens next." />
              </label>
            </fieldset>

            <div className="flex flex-col gap-3 border-t border-neutral-100 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-h4 text-primary-900">Activity</h3>
                <LogActivityDialog accountId={loaded.accountId} opportunityId={opportunityId} onLogged={() => void loadActivities()} />
              </div>
              <ActivityTimeline activities={activities} showFilters={false} onChanged={() => void loadActivities()} />
            </div>
          </div>
        )}

        <DialogFooter className="mt-0 flex-wrap items-center gap-3 border-t border-neutral-100 px-6 py-4">
          {canDelete && loaded && (
            <DeleteButton won={loaded.stageGroup === "won"} disabled={saving} onClick={() => setConfirmingDelete(true)} />
          )}
          <span className="flex-1" />
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {canEdit ? "Cancel" : "Close"}
          </Button>
          {canEdit && (
            <Button onClick={() => void save()} disabled={saving || !loaded || !name.trim()}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      {confirmingDelete && (
        <Dialog open onOpenChange={(o) => !o && !deleting && setConfirmingDelete(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete this opportunity?</DialogTitle>
              <DialogDescription className="text-body text-neutral-700">
                <b className="font-semibold">{name.trim() || "This opportunity"}</b>
                {contact && <> with {contact.full_name}</>} will be removed from the board, lists, reports and every page. It&apos;s
                kept on record, so it can be restored if this was a mistake.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="justify-end gap-3">
              <Button variant="secondary" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => void remove()} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete opportunity"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}

/** Red, at the far left of the footer, away from Save. A Won opportunity can't be deleted; hovering says why. */
function DeleteButton({ won, disabled, onClick }: { won: boolean; disabled: boolean; onClick: () => void }) {
  const button = (
    <button
      type="button"
      onClick={won ? undefined : onClick}
      disabled={disabled}
      aria-disabled={won || undefined}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-button text-error-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40",
        won ? "cursor-not-allowed opacity-40" : "hover:bg-error-50 disabled:opacity-40"
      )}
    >
      <Trash2 className="size-4" />
      Delete
    </button>
  );
  if (!won) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent className="max-w-60 font-medium">
        Won opportunities can&apos;t be deleted. They count toward Closed-Won revenue.
      </TooltipContent>
    </Tooltip>
  );
}
