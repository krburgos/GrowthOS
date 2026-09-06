"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export interface EmailConnectionRow {
  id: string;
  provider: "google" | "microsoft";
  email_address: string;
  status: "connected" | "error" | "disconnected";
  token_expires_at: string | null;
}

const PROVIDER_LABELS: Record<EmailConnectionRow["provider"], string> = {
  google: "Google Workspace",
  microsoft: "Microsoft 365",
};

const STATUS_BADGE: Record<EmailConnectionRow["status"], { variant: "success" | "error" | "neutral"; label: string }> = {
  connected: { variant: "success", label: "Connected" },
  error: { variant: "error", label: "Needs reconnect" },
  disconnected: { variant: "neutral", label: "Disconnected" },
};

const ERROR_MESSAGES: Record<string, string> = {
  oauth_state_mismatch: "The connection attempt expired or was tampered with. Please try again.",
  token_exchange_failed: "The provider rejected the connection request. Please try again.",
  no_refresh_token: "The provider didn't grant offline access. Please try connecting again and accept all prompts.",
  userinfo_failed: "Couldn't read the account's email address from the provider.",
  no_email: "The connected account doesn't have an accessible email address.",
  save_failed: "The connection succeeded but couldn't be saved. Please try again.",
};

/**
 * App Flow §5.2, §4.9 (I2) — Connect/view/disconnect a mailbox. Connect
 * is a full navigation into /api/oauth/[provider]/start (Backend Schema
 * §10); disconnect is a direct RLS-scoped update, matching the hybrid
 * access split in §11.
 */
export function EmailConnectionManager({ connection }: { connection: EmailConnectionRow | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get("error");
    const connected = searchParams.get("connected");
    if (error) {
      toast.error(ERROR_MESSAGES[error] ?? "Something went wrong connecting that account.");
      router.replace("/settings/email");
    } else if (connected) {
      toast.success("Mailbox connected.");
      router.replace("/settings/email");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDisconnect = async () => {
    if (!connection) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("email_connections")
      .update({ archived_at: new Date().toISOString(), status: "disconnected" })
      .eq("id", connection.id);

    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success("Mailbox disconnected.");
    router.refresh();
  };

  if (connection && connection.status !== "disconnected") {
    const badge = STATUS_BADGE[connection.status];
    return (
      <div className="flex max-w-md flex-col gap-4 rounded-lg border border-neutral-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-body font-medium text-neutral-800">{PROVIDER_LABELS[connection.provider]}</p>
            <p className="text-body-sm text-neutral-500">{connection.email_address}</p>
          </div>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
        {connection.status === "error" ? (
          <Button asChild size="sm">
            <a href={`/api/oauth/${connection.provider}/start`}>Reconnect</a>
          </Button>
        ) : (
          <Button variant="destructive" size="sm" className="self-start" onClick={handleDisconnect}>
            Disconnect
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex max-w-md flex-col gap-3">
      <Button asChild>
        <a href="/api/oauth/google/start">Connect Google Workspace</a>
      </Button>
      <Button asChild variant="secondary">
        <a href="/api/oauth/microsoft/start">Connect Microsoft 365</a>
      </Button>
    </div>
  );
}
