"use client";

import { Eye, FileText, PenLine, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { RichTextEditor, type RichTextEditorHandle } from "@/components/email/rich-text-editor";
import { HERO_ACTION_CLASS, HERO_PRIMARY_ACTION_CLASS } from "@/components/shell/hero-band";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fillHtml, fillText, isEmptyHtml, sanitizeEmailHtml, type MergeValues } from "@/lib/email/merge-fields";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export interface FromOption {
  id: string;
  label: string;
}

interface Template {
  id: string;
  name: string;
  subject: string;
  body_html: string;
}

const SELF = "self";
const BLANK = "__blank__";

/**
 * Client-confirmed addition (2026-09-08) — Contact Detail's "Email"
 * button. Sends through POST /api/email/send (Resend, Tech Stack
 * Lockfile §5.2) and logs the send as an Activity automatically — no
 * separate "log this" step.
 *
 * Same-day follow-up: a From picker and a Cc field. From defaults to
 * the sender's own identity; picking a teammate's connected mailbox
 * (fromOptions, account-wide per the client-confirmed reversal of part
 * of Backend Schema §6.3) only changes the outgoing email's display
 * From/Reply-To — it's still relayed through Resend, never that
 * teammate's actual Gmail/Outlook. Cc is a plain comma/semicolon-
 * separated address list, validated server-side.
 *
 * Client-confirmed (2026-10-20, approved mockup "Email Composer Options"
 * B): a larger dialog with the account's templates listed on the left
 * (a menu on phones), a rich-text message with fill-in fields, the
 * sender's signature below it (removable for one email), Save as
 * template, and a preview with every field filled in for this contact.
 * Cc moves behind "+ Cc". Fields are filled in by the send route.
 */
export function SendEmailDialog({
  contactId,
  contactName,
  contactEmail,
  currentUserName,
  fromOptions,
  variant = "tile",
}: {
  contactId: string;
  contactName: string;
  contactEmail: string;
  currentUserName: string;
  fromOptions: FromOption[];
  /** "hero" renders the trigger as a button for a HeroBand action row. */
  variant?: "tile" | "hero" | "hero-primary";
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "hero" || variant === "hero-primary" ? (
          <button type="button" className={variant === "hero-primary" ? HERO_PRIMARY_ACTION_CLASS : HERO_ACTION_CLASS}>
            <Send className="size-4" />
            Email
          </button>
        ) : (
          <button
            type="button"
            className="flex aspect-square shrink-0 flex-col items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white p-3.5 text-center transition-colors hover:border-secondary-300 hover:bg-secondary-50"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 text-white shadow-sm">
              <Send className="size-4" />
            </span>
            <span className="text-caption font-semibold text-neutral-700">Send Email</span>
          </button>
        )}
      </DialogTrigger>
      {open && (
        <Composer
          contactId={contactId}
          contactName={contactName}
          contactEmail={contactEmail}
          currentUserName={currentUserName}
          fromOptions={fromOptions}
          onDone={() => setOpen(false)}
        />
      )}
    </Dialog>
  );
}

function Composer({
  contactId,
  contactName,
  contactEmail,
  currentUserName,
  fromOptions,
  onDone,
}: {
  contactId: string;
  contactName: string;
  contactEmail: string;
  currentUserName: string;
  fromOptions: FromOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const editor = useRef<RichTextEditorHandle>(null);
  const [fromConnectionId, setFromConnectionId] = useState(SELF);
  const [showCc, setShowCc] = useState(false);
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [useSignature, setUseSignature] = useState(true);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [values, setValues] = useState<MergeValues>({});
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingName, setSavingName] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const [{ data: contact }, { data: me }] = await Promise.all([
        supabase.from("contacts").select("account_id, first_name, last_name, full_name, title, companies(name)").eq("id", contactId).maybeSingle(),
        auth.user
          ? supabase.from("users").select("full_name, email_signature_html, email_signature_auto").eq("id", auth.user.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (contact) {
        const co = Array.isArray(contact.companies) ? contact.companies[0] : contact.companies;
        setAccountId(contact.account_id as string);
        setValues({
          first_name: contact.first_name as string | null,
          last_name: contact.last_name as string | null,
          full_name: contact.full_name as string | null,
          company: (co as { name: string } | null)?.name ?? null,
          title: contact.title as string | null,
          sender_name: (me as { full_name?: string } | null)?.full_name ?? currentUserName,
        });
        const { data: rows } = await supabase
          .from("email_templates")
          .select("id, name, subject, body_html")
          .eq("account_id", contact.account_id)
          .is("archived_at", null)
          .order("name");
        setTemplates((rows ?? []) as Template[]);
      }
      const sig = (me as { email_signature_html?: string | null; email_signature_auto?: boolean } | null) ?? null;
      if (sig?.email_signature_html && !isEmptyHtml(sig.email_signature_html)) {
        setSignature(sig.email_signature_html);
        setUseSignature(sig.email_signature_auto !== false);
      }
    })();
  }, [contactId, currentUserName]);

  const applyTemplate = (id: string) => {
    if (id === BLANK) {
      setTemplateId(null);
      setSubject("");
      editor.current?.setContent("");
      return;
    }
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setTemplateId(t.id);
    setSubject(t.subject);
    editor.current?.setContent(t.body_html);
    setPreview(false);
  };

  const fullHtml = () => body + (signature && useSignature ? `<p></p>${signature}` : "");

  const saveTemplate = async () => {
    const name = savingName?.trim();
    if (!name || !accountId) return;
    setSaving(true);
    const { data, error } = await createClient()
      .from("email_templates")
      .insert({ account_id: accountId, name, subject, body_html: body })
      .select("id, name, subject, body_html")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error(error?.message ?? "Couldn't save that template.");
      return;
    }
    setTemplates((ts) => [...ts, data as Template].sort((a, b) => a.name.localeCompare(b.name)));
    setTemplateId((data as Template).id);
    setSavingName(null);
    toast.success(`Saved "${name}" as a template.`);
  };

  const handleSend = async () => {
    setPending(true);
    const res = await fetch("/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId,
        subject,
        body: fullHtml(),
        cc: cc.trim() || undefined,
        fromConnectionId: fromConnectionId === SELF ? null : fromConnectionId,
        templateId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      toast.error(data.error || "Couldn't send that email — please try again.");
      return;
    }
    toast.success(`Email sent to ${contactName}.`);
    onDone();
    router.refresh();
  };

  const canSend = subject.trim() && !isEmptyHtml(body);
  const firstName = values.first_name?.trim() || contactName.split(" ")[0];

  return (
    <DialogContent className="flex max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-[820px] gap-0 overflow-hidden p-0">
      <aside className="hidden w-[220px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-neutral-100 bg-primary-50 p-4 sm:flex">
        <p className="mb-2 text-caption font-bold uppercase tracking-wide text-primary-700">Templates</p>
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => applyTemplate(t.id)}
            className={cn(
              "rounded-md px-2.5 py-2 text-left text-body-sm transition-colors",
              templateId === t.id ? "bg-white font-semibold text-primary-900 shadow-sm ring-1 ring-primary-200" : "text-neutral-700 hover:bg-white/70"
            )}
          >
            {t.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => applyTemplate(BLANK)}
          className={cn("rounded-md px-2.5 py-2 text-left text-body-sm", templateId === null ? "text-primary-900" : "text-neutral-400 hover:bg-white/70")}
        >
          Blank email
        </button>
        <div className="mt-auto pt-4">
          {savingName === null ? (
            <button
              type="button"
              onClick={() => setSavingName(subject || "")}
              disabled={isEmptyHtml(body)}
              className="text-left text-caption font-semibold text-secondary-700 hover:text-secondary-800 disabled:text-neutral-400"
            >
              + Save current as template
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <Input autoFocus value={savingName} onChange={(e) => setSavingName(e.target.value)} placeholder="Template name" aria-label="Template name" className="h-8 text-body-sm" />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void saveTemplate()} disabled={saving || !savingName.trim()}>
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSavingName(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          <Link href="/settings/email-templates" className="mt-2 block text-caption text-neutral-500 hover:underline">
            Manage templates
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
        <DialogTitle className="pr-8">Email {contactName}</DialogTitle>

        <div className="sm:hidden">
          <Label htmlFor="email-template">Template</Label>
          <Select value={templateId ?? BLANK} onValueChange={applyTemplate}>
            <SelectTrigger id="email-template">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={BLANK}>Blank email</SelectItem>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="email-from">From</Label>
            <Select value={fromConnectionId} onValueChange={setFromConnectionId}>
              <SelectTrigger id="email-from">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SELF}>{currentUserName} (you)</SelectItem>
                {fromOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <Label htmlFor="email-to" className="mb-0">
                To
              </Label>
              {!showCc && (
                <button type="button" onClick={() => setShowCc(true)} className="text-caption font-semibold text-secondary-700 hover:text-secondary-800">
                  + Cc
                </button>
              )}
            </div>
            <Input id="email-to" value={contactEmail} disabled />
          </div>
        </div>

        {showCc && (
          <div>
            <Label htmlFor="email-cc">Cc</Label>
            <Input id="email-cc" autoFocus placeholder="cc@example.com, another@example.com" value={cc} onChange={(e) => setCc(e.target.value)} />
          </div>
        )}

        <div>
          <Label htmlFor="email-subject" required>
            Subject
          </Label>
          <Input
            id="email-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Fields like {First name} work here too"
          />
        </div>

        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <Label className="mb-0" required>
              Message
            </Label>
            <button
              type="button"
              onClick={() => setPreview((p) => !p)}
              className="inline-flex items-center gap-1 text-caption font-semibold text-secondary-700 hover:text-secondary-800"
            >
              {preview ? <PenLine className="size-3.5" /> : <Eye className="size-3.5" />}
              {preview ? "Back to editing" : `Preview as ${firstName} sees it`}
            </button>
          </div>

          <div className={preview ? "hidden" : undefined}>
            <RichTextEditor ref={editor} ariaLabel="Message" fields minHeight="180px" onChange={setBody} />
          </div>

          {preview && (
            <div className="rounded-md border border-neutral-300 bg-white px-4 py-3">
              <p className="mb-3 border-b border-neutral-100 pb-2 text-body-sm font-semibold text-neutral-900">
                {fillText(subject, values) || <span className="text-neutral-400">No subject</span>}
              </p>
              <div
                className="text-body text-neutral-800 [&_a]:text-primary-700 [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{ __html: fillHtml(sanitizeEmailHtml(fullHtml()), values) }}
              />
            </div>
          )}

          {!preview && (
            <div className="mt-2 rounded-md border border-dashed border-neutral-200 px-3 py-2">
              {signature ? (
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={cn(
                      "min-w-0 text-body-sm text-neutral-500 [&_a]:text-primary-700 [&_a]:underline [&_p]:my-0.5",
                      !useSignature && "line-through opacity-50"
                    )}
                    dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(signature) }}
                  />
                  <button type="button" onClick={() => setUseSignature((v) => !v)} className="shrink-0 text-caption font-semibold text-secondary-700 hover:text-secondary-800">
                    {useSignature ? "Remove for this email" : "Add signature"}
                  </button>
                </div>
              ) : (
                <p className="flex items-center gap-1.5 text-caption text-neutral-500">
                  <FileText className="size-3.5" />
                  No signature yet.
                  <Link href="/settings/profile/signature" className="font-semibold text-secondary-700 hover:underline">
                    Set one up
                  </Link>
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button onClick={() => void handleSend()} disabled={pending || !canSend}>
            {pending ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}
