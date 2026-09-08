"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { createClient } from "@/lib/supabase/client";

const SELF = "self";

/**
 * App Flow §4.7 (G3) — Compose Campaign. Plain-text/basic formatting
 * only, no rich-text editor (Tech Stack Lockfile §5.3). From reuses the
 * exact same account-wide connections list and SELF-sentinel pattern as
 * the Contact Detail quick-send dialog (components/contacts/send-email-
 * dialog.tsx) for consistency — default to your own identity, or pick
 * any connected mailbox in the account.
 *
 * Saves straight to a 'draft' campaign row (direct browser -> Supabase,
 * no secret involved) and hands off to Campaign Detail's Send/Schedule
 * controls rather than sending from here — composing and sending are
 * two distinct, reviewable steps.
 */
export function CampaignComposerForm({
  accountId,
  currentUserName,
  lists,
  fromOptions,
}: {
  accountId: string;
  currentUserName: string;
  lists: { id: string; name: string; count: number }[];
  fromOptions: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [listId, setListId] = useState("");
  const [fromConnectionId, setFromConnectionId] = useState(SELF);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);

  const canSave = name.trim() && listId && subject.trim() && body.trim();

  const handleSave = async () => {
    setPending(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("campaigns")
      .insert({
        account_id: accountId,
        list_id: listId,
        created_by: user!.id,
        send_from_connection_id: fromConnectionId === SELF ? null : fromConnectionId,
        name: name.trim(),
        subject: subject.trim(),
        body: body.trim(),
      })
      .select("id")
      .single();

    setPending(false);

    if (error || !data) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }

    toast.success("Campaign saved as a draft.");
    router.push(`/campaigns/${data.id}`);
  };

  const selectedList = lists.find((l) => l.id === listId);

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-neutral-200 bg-white p-6">
      <div>
        <Label htmlFor="campaign-name" required>
          Campaign Name
        </Label>
        <Input
          id="campaign-name"
          placeholder="e.g. Q3 Cybersecurity Checkup Offer"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="campaign-list" required>
            List
          </Label>
          <Select value={listId} onValueChange={setListId}>
            <SelectTrigger id="campaign-list">
              <SelectValue placeholder="Choose a list" />
            </SelectTrigger>
            <SelectContent>
              {lists.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name} ({l.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedList && (
            <p className="mt-1 text-caption text-neutral-500">
              Sends to {selectedList.count} contact{selectedList.count === 1 ? "" : "s"} on this list.
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="campaign-from">From</Label>
          <Select value={fromConnectionId} onValueChange={setFromConnectionId}>
            <SelectTrigger id="campaign-from">
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
      </div>

      <div>
        <Label htmlFor="campaign-subject" required>
          Subject
        </Label>
        <Input id="campaign-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>

      <div>
        <Label htmlFor="campaign-body" required>
          Message
        </Label>
        <Textarea id="campaign-body" rows={12} value={body} onChange={(e) => setBody(e.target.value)} />
        <p className="mt-1 text-caption text-neutral-500">
          Plain text — any link you include is automatically click-tracked, and an unsubscribe link is added
          for you.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!canSave || pending}>
          {pending ? "Saving…" : "Save Draft"}
        </Button>
      </div>
    </div>
  );
}
