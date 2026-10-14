"use client";

import { NotebookPen, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { createClient } from "@/lib/supabase/client";

function ago(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * A contact's notes, first thing under the header (client-confirmed,
 * 2026-10-14, approved mockup "Contact Detail Refresh"): the SDR or user
 * reads them before anything else, and they stay in view on every tab.
 *
 * They edit in place and save on their own, outside the Overview form,
 * so the two can never overwrite each other. "Last edited by" comes from
 * contacts.notes_updated_at / notes_updated_by, stamped by the
 * stamp_contact_notes() trigger whenever the text changes; notes written
 * before that column existed show no line.
 */
export function ContactNotesPanel({
  contactId,
  notes,
  updatedAt,
  updatedBy,
  canEdit,
}: {
  contactId: string;
  notes: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await createClient()
      .from("contacts")
      .update({ notes: draft.trim() || null })
      .eq("id", contactId);
    setSaving(false);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success("Notes saved.");
    setEditing(false);
    router.refresh();
  };

  const text = (notes ?? "").trim();

  return (
    <section aria-label="Notes" className="overflow-hidden rounded-xl border border-primary-100 bg-white shadow-lift">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-[linear-gradient(135deg,var(--color-primary-900),var(--color-primary-700)_60%,var(--color-secondary-800))] px-4 py-2.5">
        <h2 className="inline-flex items-center gap-2 text-caption font-semibold uppercase tracking-wide text-white">
          <NotebookPen className="size-4 text-secondary-300" />
          Notes
        </h2>
        {updatedAt && (
          <span className="text-caption text-white/65">
            Last edited {updatedBy ? `by ${updatedBy} ` : ""}· {ago(updatedAt)}
          </span>
        )}
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(notes ?? "");
              setEditing(true);
            }}
            className="ml-auto inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-caption font-semibold text-secondary-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-300"
          >
            <Pencil className="size-3.5" />
            {text ? "Edit" : "Add notes"}
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-3 p-4">
          <Textarea
            autoFocus
            rows={5}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Notes"
            placeholder="What the next person to call them should know."
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save notes"}
            </Button>
          </div>
        </div>
      ) : text ? (
        <p className="max-w-[80ch] whitespace-pre-wrap px-4 py-3.5 text-body leading-relaxed text-neutral-800 md:text-[15px]">
          {text}
        </p>
      ) : (
        <p className="px-4 py-3.5 text-body-sm text-neutral-400">
          No notes yet.{canEdit ? " Add what the next person to call them should know." : ""}
        </p>
      )}
    </section>
  );
}
