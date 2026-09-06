"use client";

import Papa from "papaparse";
import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
    | { name: string; phone: string | null; address_line1: string | null; city: string | null; state: string | null; company_size: string | null }
    | { name: string; phone: string | null; address_line1: string | null; city: string | null; state: string | null; company_size: string | null }[]
    | null;
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Client-side export (a plain RLS-scoped read, no secret involved —
 * Backend Schema §11 hybrid access) — resolves the selection to
 * concrete ids, fetches those rows, and triggers a CSV download.
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
        "full_name, email, title, phone, score, temperature, linkedin_url, contact_statuses(name), companies(name, phone, address_line1, city, state, company_size)"
      )
      .in("id", ids);

    setExporting(false);

    if (error) {
      toast.error(error.message);
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
    <button
      type="button"
      onClick={handleExport}
      disabled={exporting}
      aria-label="Export selected contacts"
      className="flex h-9 items-center gap-2 rounded-full bg-white/10 px-4 text-button text-white transition-colors hover:bg-white/20 active:translate-y-px disabled:opacity-50"
    >
      <Download className="size-4" />
      Export
    </button>
  );
}
