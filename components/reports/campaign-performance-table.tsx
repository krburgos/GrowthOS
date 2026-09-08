import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface CampaignPerformanceRow {
  id: string;
  name: string;
  sent: number;
  openRate: number | null;
  clickRate: number | null;
  bounced: number;
  unsubscribed: number;
}

const pct = (n: number | null) => (n == null ? "—" : `${(n * 100).toFixed(1)}%`);

/** App Flow §4.8 — campaign performance (sent/opened/clicked/bounced/unsubscribed). */
export function CampaignPerformanceTable({ campaigns }: { campaigns: CampaignPerformanceRow[] }) {
  if (campaigns.length === 0) {
    return <p className="px-4 py-6 text-body-sm text-neutral-500">No campaigns sent yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader variant="solid">
          <TableRow className="border-b-0 hover:bg-transparent">
            <TableHead variant="solid">Campaign</TableHead>
            <TableHead variant="solid">Sent</TableHead>
            <TableHead variant="solid">Open Rate</TableHead>
            <TableHead variant="solid">Click Rate</TableHead>
            <TableHead variant="solid">Bounced</TableHead>
            <TableHead variant="solid">Unsub</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium text-neutral-800">{c.name}</TableCell>
              <TableCell className="tabular-nums">{c.sent}</TableCell>
              <TableCell className="tabular-nums">{pct(c.openRate)}</TableCell>
              <TableCell className="tabular-nums">{pct(c.clickRate)}</TableCell>
              <TableCell className="tabular-nums">{c.bounced}</TableCell>
              <TableCell className="tabular-nums">{c.unsubscribed}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
