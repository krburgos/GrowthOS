"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

const TYPES = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "task", label: "Task" },
  { value: "note", label: "Note" },
];

/**
 * PRD §6.5 — unified activity timeline. One component, mounted on both
 * Contact Detail and Opportunity Detail (Implementation Plan Milestone
 * 8) — whichever parent is present gets set on the row; the other stays
 * null (activities_needs_a_parent, Backend Schema §5.5, only requires
 * at least one).
 */
export function LogActivityDialog({
  accountId,
  contactId,
  opportunityId,
}: {
  accountId: string;
  contactId?: string;
  opportunityId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("call");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async () => {
    setPending(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("activities").insert({
      account_id: accountId,
      contact_id: contactId ?? null,
      opportunity_id: opportunityId ?? null,
      user_id: user!.id,
      type,
      subject: subject || null,
      body: body || null,
      due_at: type === "task" && dueAt ? new Date(dueAt).toISOString() : null,
    });

    setPending(false);

    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }

    toast.success("Activity logged.");
    setOpen(false);
    setSubject("");
    setBody("");
    setDueAt("");
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Log Activity</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log an activity</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="activity-type" required>
              Type
            </Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="activity-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="activity-subject">Subject</Label>
            <Input id="activity-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="activity-body">Notes</Label>
            <Textarea id="activity-body" value={body} onChange={(e) => setBody(e.target.value)} />
          </div>

          {type === "task" && (
            <div>
              <Label htmlFor="activity-due">Due date</Label>
              <Input
                id="activity-due"
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
