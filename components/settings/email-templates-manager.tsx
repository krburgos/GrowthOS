"use client";

import { MoreVertical, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { RichTextEditor } from "@/components/email/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { MERGE_FIELDS, isEmptyHtml, sanitizeEmailHtml } from "@/lib/email/merge-fields";
import { createClient } from "@/lib/supabase/client";

export interface EmailTemplateRow {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  use_count: number;
}

/** The subject with its fields drawn as chips, for the list. */
function SubjectLine({ subject }: { subject: string }) {
  const parts = subject.split(/(\{[A-Za-z ]+\})/g);
  return (
    <>
      {parts.map((p, i) => {
        const field = MERGE_FIELDS.find((f) => `{${f.label}}`.toLowerCase() === p.toLowerCase());
        return field ? (
          <span key={i} className="rounded-md bg-secondary-100 px-1.5 text-caption font-semibold text-secondary-800">
            {field.label}
          </span>
        ) : (
          <span key={i}>{p}</span>
        );
      })}
    </>
  );
}

/**
 * Settings → Customizations → Email Templates (client-confirmed,
 * 2026-10-20, approved mockup "Email Templates and Signature"). The
 * account's shared templates: anyone who emails contacts uses them, and
 * saves new ones from the email dialog; MSP Owner/Admin and CRO Leader
 * add, edit, duplicate and retire them here. Retiring archives.
 */
export function EmailTemplatesManager({
  accountId,
  templates,
  canEdit,
}: {
  accountId: string;
  templates: EmailTemplateRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<EmailTemplateRow | "new" | null>(null);
  const [retiring, setRetiring] = useState<EmailTemplateRow | null>(null);
  const [busy, setBusy] = useState(false);

  const duplicate = async (t: EmailTemplateRow) => {
    const { error } = await createClient()
      .from("email_templates")
      .insert({ account_id: accountId, name: `${t.name} (copy)`, subject: t.subject, body_html: t.body_html });
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success(`Duplicated ${t.name}.`);
    router.refresh();
  };

  const retire = async () => {
    if (!retiring) return;
    setBusy(true);
    const { error } = await createClient()
      .from("email_templates")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", retiring.id);
    setBusy(false);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success(`${retiring.name} retired.`);
    setRetiring(null);
    router.refresh();
  };

  return (
    <div className="flex w-full flex-col gap-4">
      {canEdit && (
        <Button size="sm" className="self-start" onClick={() => setEditing("new")}>
          <Plus className="mr-1.5 size-4" />
          Add Template
        </Button>
      )}

      {templates.length === 0 ? (
        <p className="rounded-md border border-neutral-200 bg-white px-4 py-8 text-center text-body-sm text-neutral-400">
          No templates yet.{canEdit && " Add the first, or save one from any contact's email."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-100 rounded-md border border-neutral-200">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 bg-white px-4 py-2.5">
              <div className="min-w-0">
                <span className="block text-body text-neutral-800">{t.name}</span>
                <span className="block truncate text-body-sm text-neutral-500">
                  {t.subject ? <SubjectLine subject={t.subject} /> : "No subject"} ·{" "}
                  {t.use_count === 0 ? "not used yet" : `used ${t.use_count} ${t.use_count === 1 ? "time" : "times"}`}
                </span>
              </div>
              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100"
                      aria-label={`More actions for ${t.name}`}
                    >
                      <MoreVertical className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditing(t)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void duplicate(t)}>Duplicate</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setRetiring(t)} className="text-error-700">
                      Retire
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <TemplateDialog
          accountId={accountId}
          template={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      <Dialog open={!!retiring} onOpenChange={(o) => !o && setRetiring(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retire {retiring?.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-body text-neutral-600">It disappears from the email dialog. Emails already sent with it are unaffected.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRetiring(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void retire()} disabled={busy}>
              Retire
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateDialog({
  accountId,
  template,
  onClose,
  onSaved,
}: {
  accountId: string;
  template: EmailTemplateRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body_html ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      toast.error("Give the template a name.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const row = { name: name.trim(), subject: subject.trim(), body_html: sanitizeEmailHtml(body) };
    const { error } = template
      ? await supabase.from("email_templates").update(row).eq("id", template.id)
      : await supabase.from("email_templates").insert({ ...row, account_id: accountId });
    setSaving(false);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success(template ? "Template saved." : "Template added.");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-32px)] max-w-[640px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Edit template" : "Add a template"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-name" required>
              Name
            </Label>
            <Input id="template-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="FME follow-up" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-subject">Subject</Label>
            <Input
              id="template-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Fields like {First name} work here too"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Message</Label>
            <RichTextEditor ariaLabel="Template message" initialHtml={template?.body_html ?? ""} onChange={setBody} fields minHeight="200px" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving || !name.trim() || isEmptyHtml(body)}>
            {saving ? "Saving…" : template ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
