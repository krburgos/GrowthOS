"use client";

import { MoreVertical, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { SHORT_TITLE } from "@/lib/gos-dashboard/hours";
import { PLAYBOOK_STEPS } from "@/lib/gos-dashboard/playbook";
import { createClient } from "@/lib/supabase/client";
import { allocatedHours, initialsOf, type TeamAssignment, type TeamKind, type TeamMember } from "@/lib/team/members";

const stepLabel = (slug: string) => SHORT_TITLE[slug] ?? slug;

interface Draft {
  id: string | null;
  name: string;
  title: string;
  weekly_hours: string;
  assignments: { step_slug: string; weekly_hours: string }[];
}

const emptyDraft = (): Draft => ({ id: null, name: "", title: "", weekly_hours: "", assignments: [] });

/**
 * The Company Profile's two rosters (client-confirmed, 2026-09-24),
 * replacing the list of typed names.
 *
 * A table rather than chips, because four fields plus a list of assignments
 * will not fit a chip — and because showing the workstream and its hours
 * together lets the table answer "who does SEO, and for how long" without
 * opening anything.
 *
 * One component serves both rosters; only the `kind` and the heading
 * differ. Editing is a dialog rather than inline, since a person is four
 * fields plus N assignments and inline editing of that is worse than a
 * focused form.
 *
 * Saving replaces a member's assignments wholesale — delete then insert —
 * which is simpler and safer than diffing, and cheap at this size. The
 * assignments table has a delete policy for exactly this, the same shape
 * list_members already uses; members themselves are soft-deleted.
 */
export function TeamRoster({
  accountId,
  members,
  canEdit,
}: {
  accountId: string;
  members: TeamMember[];
  canEdit: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <RosterTable
        accountId={accountId}
        kind="in_house"
        heading="Sales & Marketing"
        hint="Your own staff"
        members={members.filter((m) => m.kind === "in_house")}
        canEdit={canEdit}
      />
      <RosterTable
        accountId={accountId}
        kind="outsourced"
        heading="Outsourced"
        hint="Third parties delivering a workstream"
        members={members.filter((m) => m.kind === "outsourced")}
        canEdit={canEdit}
      />
    </div>
  );
}

function RosterTable({
  accountId,
  kind,
  heading,
  hint,
  members,
  canEdit,
}: {
  accountId: string;
  kind: TeamKind;
  heading: string;
  hint: string;
  members: TeamMember[];
  canEdit: boolean;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);

  const openNew = () => setDraft(emptyDraft());
  const openEdit = (m: TeamMember) =>
    setDraft({
      id: m.id,
      name: m.name,
      title: m.title ?? "",
      weekly_hours: m.weekly_hours ? String(m.weekly_hours) : "",
      assignments: m.assignments.map((a) => ({ step_slug: a.step_slug, weekly_hours: String(a.weekly_hours) })),
    });

  return (
    <section className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-neutral-100 px-6 py-4">
        <span aria-hidden="true" className="h-4 w-[3px] shrink-0 rounded-full bg-secondary-500" />
        <h2 className="text-h4 text-primary-900">{heading}</h2>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-caption font-bold text-neutral-500">
          {members.length}
        </span>
        <span className="ml-auto text-caption text-neutral-400">{hint}</span>
        {canEdit && (
          <Button size="sm" onClick={openNew}>
            <Plus className="mr-1.5 size-4" />
            Add
          </Button>
        )}
      </div>

      {members.length === 0 ? (
        <p className="px-6 py-8 text-center text-body-sm text-neutral-400">
          Nobody here yet.{canEdit && " Add the people responsible for these workstreams."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <Th>Name</Th>
                <Th>Title</Th>
                <Th>Areas of responsibility</Th>
                <Th align="right">Weekly hours</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const allocated = allocatedHours(m);
                return (
                  <tr key={m.id} className="border-b border-neutral-100 last:border-b-0">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex size-[30px] shrink-0 items-center justify-center rounded-full text-caption font-bold text-white ${
                            kind === "outsourced"
                              ? "bg-gradient-to-br from-neutral-500 to-neutral-400"
                              : "bg-gradient-to-br from-primary-700 to-secondary-700"
                          }`}
                        >
                          {initialsOf(m.name)}
                        </span>
                        <span className="text-body-sm font-semibold text-neutral-800">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-body-sm text-neutral-600">{m.title || "—"}</td>
                    <td className="px-6 py-3">
                      {m.assignments.length === 0 ? (
                        <span className="text-body-sm text-neutral-300">None yet</span>
                      ) : (
                        <ul className="flex flex-wrap gap-1">
                          {m.assignments.map((a) => (
                            <li
                              key={a.step_slug}
                              className="inline-flex items-center gap-1.5 rounded-full border border-secondary-200 bg-secondary-50 px-2.5 py-0.5 text-caption font-semibold text-secondary-800"
                            >
                              {stepLabel(a.step_slug)}
                              <b className="font-bold text-primary-900">{a.weekly_hours}h</b>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="text-h4 font-bold tabular-nums text-primary-900">
                        {m.weekly_hours} <span className="text-caption font-medium text-neutral-400">h/wk</span>
                      </div>
                      <div className="text-caption text-neutral-400">{allocated}h allocated</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canEdit && (
                        <MemberMenu accountId={accountId} member={m} onEdit={() => openEdit(m)} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {draft && (
        <MemberDialog
          accountId={accountId}
          kind={kind}
          heading={heading}
          draft={draft}
          setDraft={setDraft}
          onClose={() => setDraft(null)}
        />
      )}
    </section>
  );
}

function Th({ children, align }: { children?: React.ReactNode; align?: "right" }) {
  return (
    <th
      className={`px-6 py-2.5 text-caption font-bold uppercase tracking-wide text-neutral-400 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function MemberMenu({ accountId, member, onEdit }: { accountId: string; member: TeamMember; onEdit: () => void }) {
  const router = useRouter();

  const remove = async () => {
    const supabase = createClient();
    // Soft delete, like every other record in the schema.
    const { error } = await supabase
      .from("account_team_members")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", member.id)
      .eq("account_id", accountId);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success(`${member.name} removed.`);
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Actions for ${member.name}`}
          className="flex size-8 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        >
          <MoreVertical className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void remove()} className="text-error-700">
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MemberDialog({
  accountId,
  kind,
  heading,
  draft,
  setDraft,
  onClose,
}: {
  accountId: string;
  kind: TeamKind;
  heading: string;
  draft: Draft;
  setDraft: (d: Draft) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const used = new Set(draft.assignments.map((a) => a.step_slug));
  const available = PLAYBOOK_STEPS.filter((s) => !used.has(s.slug));
  const allocated = draft.assignments.reduce((sum, a) => sum + (Number(a.weekly_hours) || 0), 0);
  const commitment = Number(draft.weekly_hours) || 0;

  const setAssignmentHours = (slug: string, value: string) =>
    setDraft({
      ...draft,
      assignments: draft.assignments.map((a) => (a.step_slug === slug ? { ...a, weekly_hours: value } : a)),
    });

  const save = async () => {
    if (!draft.name.trim()) {
      toast.error("Give this person a name.");
      return;
    }
    setSaving(true);
    const supabase = createClient();

    const payload = {
      account_id: accountId,
      kind,
      name: draft.name.trim(),
      title: draft.title.trim() || null,
      weekly_hours: Number(draft.weekly_hours) || 0,
    };

    let memberId = draft.id;
    if (memberId) {
      const { error } = await supabase.from("account_team_members").update(payload).eq("id", memberId);
      if (error) return fail(error);
    } else {
      const { data, error } = await supabase.from("account_team_members").insert(payload).select("id").single();
      if (error || !data) return fail(error);
      memberId = data.id;
    }

    // Replace the whole assignment set rather than diffing it — cheap at
    // this size, and it cannot leave a stale row behind.
    const { error: delError } = await supabase.from("account_team_assignments").delete().eq("member_id", memberId);
    if (delError) return fail(delError);

    const rows = draft.assignments
      .filter((a) => a.step_slug)
      .map((a) => ({
        account_id: accountId,
        member_id: memberId!,
        step_slug: a.step_slug,
        weekly_hours: Number(a.weekly_hours) || 0,
      }));
    if (rows.length > 0) {
      const { error: insError } = await supabase.from("account_team_assignments").insert(rows);
      if (insError) return fail(insError);
    }

    setSaving(false);
    toast.success(draft.id ? "Person updated." : "Person added.");
    onClose();
    router.refresh();

    function fail(error: Parameters<typeof getFriendlyErrorMessage>[0]) {
      setSaving(false);
      toast.error(getFriendlyErrorMessage(error));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100vh-32px)] max-w-[560px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{draft.id ? "Edit person" : `Add to ${heading}`}</DialogTitle>
          <DialogDescription className="text-body-sm text-neutral-500">
            {kind === "outsourced"
              ? "Name can carry the company too — “Rosa Pineda · Northlight Events”."
              : "Shown on the Company Profile and on the workstreams they are assigned to."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_150px]">
            <Field label="Name">
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="Weekly hours">
              <Input
                type="number"
                min="0"
                step="0.5"
                value={draft.weekly_hours}
                onChange={(e) => setDraft({ ...draft, weekly_hours: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Title">
            <Input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder={kind === "outsourced" ? "Agency, Event Producer…" : "Marketing Manager, SDR…"}
            />
          </Field>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-caption font-bold uppercase tracking-wide text-neutral-400">
                Areas of responsibility
              </span>
              <span className="ml-auto text-caption text-neutral-500">
                <b className="font-bold text-primary-900">{allocated}h</b> allocated
                {commitment > 0 && ` of ${commitment}`}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {draft.assignments.map((a) => (
                <div key={a.step_slug} className="flex items-center gap-2.5 rounded-lg border border-neutral-200 px-3 py-2">
                  <span className="flex-1 text-body-sm text-neutral-800">{stepLabel(a.step_slug)}</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    aria-label={`Weekly hours for ${stepLabel(a.step_slug)}`}
                    value={a.weekly_hours}
                    onChange={(e) => setAssignmentHours(a.step_slug, e.target.value)}
                    className="h-8 w-[74px] text-right"
                  />
                  <span className="text-caption text-neutral-400">h/wk</span>
                  <button
                    type="button"
                    aria-label={`Remove ${stepLabel(a.step_slug)}`}
                    onClick={() =>
                      setDraft({ ...draft, assignments: draft.assignments.filter((x) => x.step_slug !== a.step_slug) })
                    }
                    className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-error-100 hover:text-error-700"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}

              {available.length > 0 && (
                <Select
                  value=""
                  onValueChange={(slug) =>
                    setDraft({ ...draft, assignments: [...draft.assignments, { step_slug: slug, weekly_hours: "" }] })
                  }
                >
                  <SelectTrigger className="h-10 justify-start gap-2 border-dashed text-body-sm font-semibold text-neutral-500">
                    <Plus className="size-4" />
                    <SelectValue placeholder="Add a workstream" />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((s) => (
                      <SelectItem key={s.slug} value={s.slug}>
                        {stepLabel(s.slug)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save person"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-caption font-bold uppercase tracking-wide text-neutral-400">{label}</span>
      {children}
    </label>
  );
}
