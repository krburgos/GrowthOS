"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { RichTextEditor, type RichTextEditorHandle } from "@/components/email/rich-text-editor";
import { Button } from "@/components/ui/button";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { isEmptyHtml, sanitizeEmailHtml } from "@/lib/email/merge-fields";
import { createClient } from "@/lib/supabase/client";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The signature editor (client-confirmed, 2026-10-20). "Fill in from my
 * profile" builds one from name, job title, company, phone and website;
 * the checkbox decides whether new emails start with it. Saved on the
 * user's own row (users.email_signature_html / email_signature_auto).
 */
export function SignatureForm({
  userId,
  initialHtml,
  initialAuto,
  details,
}: {
  userId: string;
  initialHtml: string;
  initialAuto: boolean;
  details: { name: string; title: string | null; company: string | null; phone: string | null; website: string | null };
}) {
  const router = useRouter();
  const editor = useRef<RichTextEditorHandle>(null);
  const [html, setHtml] = useState(initialHtml);
  const [auto, setAuto] = useState(initialAuto);
  const [saving, setSaving] = useState(false);

  const fillFromProfile = () => {
    const second = [details.title, details.company].filter(Boolean).map((s) => esc(s!)).join(" · ");
    const site = details.website?.trim();
    const third = [
      details.phone ? esc(details.phone) : null,
      site ? `<a href="${/^https?:/i.test(site) ? esc(site) : `https://${esc(site)}`}">${esc(site.replace(/^https?:\/\//i, ""))}</a>` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    editor.current?.setContent(
      [`<p><strong>${esc(details.name)}</strong></p>`, second && `<p>${second}</p>`, third && `<p>${third}</p>`].filter(Boolean).join("")
    );
  };

  const save = async () => {
    setSaving(true);
    const value = isEmptyHtml(html) ? null : sanitizeEmailHtml(html);
    const { error } = await createClient()
      .from("users")
      .update({ email_signature_html: value, email_signature_auto: auto })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success(value ? "Signature saved." : "Signature removed.");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-neutral-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-h4 text-primary-900">Email signature</h2>
          <p className="text-body-sm text-neutral-500">Added to the end of every email you send from GrowthMission.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={fillFromProfile}>
          Fill in from my profile
        </Button>
      </div>
      <RichTextEditor ref={editor} ariaLabel="Email signature" initialHtml={initialHtml} onChange={setHtml} minHeight="96px" />
      <label className="flex items-center gap-2 text-body-sm text-neutral-800">
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="size-4 accent-primary-700" />
        Add it to new emails automatically
      </label>
      <div className="flex justify-end">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save signature"}
        </Button>
      </div>
    </div>
  );
}
