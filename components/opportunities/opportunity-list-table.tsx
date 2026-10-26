import { OpportunityLink } from "@/components/opportunities/opportunity-panel";
import { Badge } from "@/components/ui/badge";
import { SortableHeader } from "@/components/ui/sortable-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { daysSince, usd } from "@/lib/companies/value";
import { STAGE_GROUP_BADGE_VARIANT, type StageGroup } from "@/lib/opportunities/stages";

export interface OpportunityListRow {
  id: string;
  name: string | null;
  contact_name: string;
  company_name: string | null;
  employees: number;
  prospect_value: number;
  stage_name: string;
  stage_group: StageGroup;
  win_probability: number;
  owner_name: string | null;
  stage_entered_at: string;
}

/**
 * App Flow §4.5, E2 — Opportunity List, the Board's alternate view.
 *
 * Client-confirmed (2026-10-14, "CRM Pages Refresh"): Prospect Value and
 * Opportunities Value (the client's company-size formula) replace the
 * typed Value, plus Employees, win probability, salesperson and days in
 * stage. Alignment follows the table rule: text left, numbers right under
 * right-aligned headers, and the win bar with its number in a fixed slot.
 * Below `lg` the table stacks into one labelled card per row.
 */
export function OpportunityListTable({ opportunities }: { opportunities: OpportunityListRow[] }) {
  return (
    <Table stacked>
      <TableHeader variant="solid">
        <TableRow className="border-b-0 hover:bg-transparent">
          <TableHead variant="solid"><SortableHeader variant="solid" field="contact" label="Opportunity" /></TableHead>
          <TableHead variant="solid">Company</TableHead>
          <TableHead variant="solid" className="text-right">Employees</TableHead>
          <TableHead variant="solid"><SortableHeader variant="solid" field="stage" label="Stage" /></TableHead>
          <TableHead variant="solid" className="text-right">
            <SortableHeader variant="solid" field="value" label="Prospect Value" align="right" />
          </TableHead>
          <TableHead variant="solid" className="text-right">Opportunities Value</TableHead>
          <TableHead variant="solid">Win %</TableHead>
          <TableHead variant="solid">Salesperson</TableHead>
          <TableHead variant="solid" className="text-right">
            <SortableHeader variant="solid" field="days" label="In stage" align="right" />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {opportunities.map((o) => (
          <TableRow key={o.id}>
            <TableCell label="Opportunity" className="font-medium text-neutral-800">
              <OpportunityLink id={o.id} className="hover:underline">
                {o.name?.trim() || o.contact_name}
              </OpportunityLink>
              {o.name?.trim() && <span className="block text-caption font-normal text-neutral-500">{o.contact_name}</span>}
            </TableCell>
            <TableCell label="Company">{o.company_name ?? "—"}</TableCell>
            <TableCell label="Employees" className="text-right tabular-nums">{o.employees || "—"}</TableCell>
            <TableCell label="Stage">
              <Badge variant={STAGE_GROUP_BADGE_VARIANT[o.stage_group]}>{o.stage_name}</Badge>
            </TableCell>
            <TableCell label="Prospect Value" className="text-right font-semibold tabular-nums text-primary-900">
              {usd.format(o.prospect_value)}
            </TableCell>
            <TableCell label="Opportunities Value" className="text-right tabular-nums text-neutral-600">
              {usd.format(o.prospect_value * 3)}
            </TableCell>
            <TableCell label="Win %">
              <span className="inline-flex items-center gap-2 text-body-sm font-semibold tabular-nums text-neutral-700">
                <span aria-hidden="true" className="block h-1.5 w-12 overflow-hidden rounded-full bg-neutral-100">
                  <span className="block h-full rounded-full bg-secondary-600" style={{ width: `${o.win_probability}%` }} />
                </span>
                <span className="inline-block min-w-[2.6em] text-right">{o.win_probability}%</span>
              </span>
            </TableCell>
            <TableCell label="Salesperson">{o.owner_name ?? "—"}</TableCell>
            <TableCell label="In stage" className="text-right tabular-nums text-neutral-500">
              {daysSince(o.stage_entered_at)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
