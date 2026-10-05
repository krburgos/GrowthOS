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
    <>
      {/* Below lg, one card per campaign (client-confirmed, 2026-10-05). Six
          metric columns scroll sideways badly on a phone, and these are
          figures somebody compares against each other rather than reads in
          a row — a 3x2 grid per campaign keeps them all on screen. */}
      <div className="flex flex-col gap-2.5 px-4 pb-4 lg:hidden">
        {campaigns.map((c) => (
          <article key={c.id} className="rounded-xl border border-neutral-200 bg-white p-3.5">
            <h3 className="text-body font-semibold text-primary-900">{c.name}</h3>
            <dl className="mt-2.5 grid grid-cols-3 gap-y-3">
              {(
                [
                  ["Sent", String(c.sent)],
                  ["Open rate", pct(c.openRate)],
                  ["Click rate", pct(c.clickRate)],
                  ["Bounced", String(c.bounced)],
                  ["Unsub", String(c.unsubscribed)],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-caption text-neutral-500">{label}</dt>
                  <dd className="text-body font-semibold tabular-nums text-primary-900">{value}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto lg:block">
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
    </>
  );
}
