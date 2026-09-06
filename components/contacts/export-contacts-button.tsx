"use client";

import Papa from "papaparse";
import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";

import { Button } from "@/components/ui/button";
import { resolveContactIds, type ContactSelectionScope } from "@/lib/contacts/bulk-actions";
import { createClient } from "@/lib/supabase/client";

interface ExportRow {
  full_name: string;
  email: string;
  title: string | null;
  phone: string | null;
  score: number | null;
  temperature: string | null;
  linkedin_url: string | null;
  contact_statuses: { name: string } | { name: string }[] | null;
  companies:
    | {
        name: string;
        phone: string | null;
        address_line1: string | null;
        city: string | null;
        state: string | null;
        company_size: string | null;
        linkedin_url: string | null;
      }
    | {
        name: string;
        phone: string | null;
        address_line1: string | null;
        city: string | null;
        state: string | null;
        company_size: string | null;
        linkedin_url: string | null;
      }[]
    | null;
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Client-side export (a plain RLS-scoped read, no secret involved —
 * Backend Schema §11 hybrid access) — resolves the selection to
 * concrete ids, fetches those rows, and triggers a CSV download.
 *
 * Built on the shared Button component (radius-md, §8.1) rather than a
 * hand-rolled `rounded-full` pill, per an Impeccable critique finding
 * (2026-09-06, P2) that the bulk-toolbar buttons had drifted from the
 * design system's own button spec.
 */
export function ExportContactsButton({
  selection,
  scope,
}: {
  selection: { selectAllMatching: boolean; selectedIds: string[] };
  scope: ContactSelectionScope;
}) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    const supabase = createClient();
    const ids = await resolveContactIds(supabase, selection, scope);

    if (ids.length === 0) {
      setExporting(false);
      toast.error("No contacts to export.");
      return;
    }

    const { data, error } = await supabase
      .from("contacts")
      .select(
        "full_name, email, title, phone, score, temperature, linkedin_url, contact_statuses(name), companies(name, phone, address_line1, city, state, company_size, linkedin_url)"
      )
      .in("id", ids);

    setExporting(false);

    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }

    const rows = (data as unknown as ExportRow[]).map((c) => {
      const status = one(c.contact_statuses);
      const company = one(c.companies);
      return {
        "Full Name": c.full_name,
        Email: c.email,
        Title: c.title ?? "",
        "Contact Status": status?.name ?? "",
        Score: c.score ?? "",
        Temp: c.temperature ?? "",
        LinkedIn: c.linkedin_url ?? "",
        Company: company?.name ?? "",
        "Company LinkedIn": company?.linkedin_url ?? "",
        "Company Phone": company?.phone ?? "",
        "Mobile Phone": c.phone ?? "",
        "Company Address 1": company?.address_line1 ?? "",
        "Company City": company?.city ?? "",
        "Company State": company?.state ?? "",
        Employees: company?.company_size ?? "",
      };
    });

    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `contacts-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={handleExport}
      disabled={exporting}
      aria-label="Export selected contacts"
      className="gap-2 text-white hover:bg-white/20 hover:text-white active:bg-white/30"
    >
      <Download className="size-4" />
      Export
    </Button>
  );
}
