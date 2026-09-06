import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { SortableHeader } from "@/components/ui/sortable-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STAGE_GROUP_BADGE_VARIANT, type StageGroup } from "@/lib/opportunities/stages";

export interface OpportunityListRow {
  id: string;
  contact_name: string;
  company_name: string | null;
  stage_name: string;
  stage_group: StageGroup;
  value: number | null;
}

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/**
 * App Flow §4.5, E2 — Opportunity List. Sortable/filterable table
 * alternate to the Board, for bulk review or scanning the full stage
 * list as rows.
 */
export function OpportunityListTable({ opportunities }: { opportunities: OpportunityListRow[] }) {
  return (
    <Table>
      <TableHeader variant="solid">
        <TableRow className="border-b-0 hover:bg-transparent">
          <TableHead variant="solid"><SortableHeader variant="solid" field="contact" label="Contact" /></TableHead>
          <TableHead variant="solid">Company</TableHead>
          <TableHead variant="solid"><SortableHeader variant="solid" field="stage" label="Stage" /></TableHead>
          <TableHead variant="solid"><SortableHeader variant="solid" field="value" label="Value" /></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {opportunities.map((o) => (
          <TableRow key={o.id}>
            <TableCell className="font-medium text-neutral-800">
              <Link href={`/opportunities/${o.id}`}>{o.contact_name}</Link>
            </TableCell>
            <TableCell>{o.company_name ?? "—"}</TableCell>
            <TableCell>
              <Badge variant={STAGE_GROUP_BADGE_VARIANT[o.stage_group]}>{o.stage_name}</Badge>
            </TableCell>
            <TableCell>{o.value != null ? currency.format(o.value) : "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
