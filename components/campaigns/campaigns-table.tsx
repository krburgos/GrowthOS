import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface CampaignRow {
  id: string;
  name: string;
  status: "draft" | "scheduled" | "sending" | "sent" | "failed" | "cancelled";
  listName: string;
  recipients: number;
  openRate: number | null;
  clickRate: number | null;
  date: string;
  dateLabel: "Sent" | "Scheduled" | "Created";
}

const STATUS_BADGE: Record<CampaignRow["status"], "neutral" | "info" | "success" | "error"> = {
  draft: "neutral",
  scheduled: "info",
  sending: "info",
  sent: "success",
  failed: "error",
  cancelled: "neutral",
};

const STATUS_LABEL: Record<CampaignRow["status"], string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
  cancelled: "Cancelled",
};

function RateMeter({ rate, tone }: { rate: number | null; tone: "open" | "click" }) {
  if (rate == null) return <span className="text-body-sm text-neutral-300">—</span>;
  return (
    <div className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-100">
        <span
          className={cn("block h-full rounded-full", tone === "open" ? "bg-secondary-500" : "bg-success-500")}
          style={{ width: `${Math.min(rate * 100, 100)}%` }}
        />
      </span>
      <span className="text-body-sm font-semibold tabular-nums text-neutral-800">{(rate * 100).toFixed(1)}%</span>
    </div>
  );
}

/** Client-confirmed ("Data Table," approved mockup, 2026-09-08) — Campaigns Index. */
export function CampaignsTable({ campaigns }: { campaigns: CampaignRow[] }) {
  if (campaigns.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-10 text-center text-body text-neutral-500">
        No campaigns yet — create one to get started.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader variant="solid">
        <TableRow className="border-b-0 hover:bg-transparent">
          <TableHead variant="solid">Campaign</TableHead>
          <TableHead variant="solid">Status</TableHead>
          <TableHead variant="solid">Recipients</TableHead>
          <TableHead variant="solid">Open Rate</TableHead>
          <TableHead variant="solid">Click Rate</TableHead>
          <TableHead variant="solid">Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {campaigns.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-medium text-neutral-800">
              <Link href={`/campaigns/${c.id}`} className="hover:underline">
                {c.name}
              </Link>
              <p className="mt-0.5 text-caption text-neutral-400">{c.listName}</p>
            </TableCell>
            <TableCell>
              <Badge variant={STATUS_BADGE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
            </TableCell>
            <TableCell className="tabular-nums">{c.recipients || "—"}</TableCell>
            <TableCell>
              <RateMeter rate={c.openRate} tone="open" />
            </TableCell>
            <TableCell>
              <RateMeter rate={c.clickRate} tone="click" />
            </TableCell>
            <TableCell className="text-neutral-500">
              {c.dateLabel === "Created"
                ? "Not sent"
                : new Date(c.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
