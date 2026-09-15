"use client";

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { LocalPaginationBar } from "@/components/ui/local-pagination-bar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

export interface CroAccountRow {
  id: string;
  name: string;
  website: string | null;
}

/**
 * App Flow §4.10 (J1) — CRO Leader Dashboard's account search/enter
 * list. Client-side filter, matching the same pattern as Lists
 * Index/Companies List.
 *
 * Pagination (2026-09-15): the filter is client-side, so the page also
 * slices client-side via `LocalPaginationBar` rather than the URL-driven
 * `PaginationBar` -- this list and the Partners list below it share one
 * page, and both can't own the URL's `page`/`pageSize` params at once.
 */
export function AccountsList({ accounts }: { accounts: CroAccountRow[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const filtered = accounts.filter((a) => a.name.toLowerCase().includes(query.trim().toLowerCase()));
  const pageRows = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize]
  );

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Search accounts…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(1);
        }}
        className="max-w-xs"
      />

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-10 text-center text-body text-neutral-500">
          {accounts.length === 0 ? "No accounts yet." : "No accounts match your search."}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader variant="solid">
              <TableRow className="border-b-0 hover:bg-transparent">
                <TableHead variant="solid">Account</TableHead>
                <TableHead variant="solid">Website</TableHead>
                <TableHead variant="solid" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium text-neutral-800">{a.name}</TableCell>
                  <TableCell className="text-neutral-500">{a.website ?? "—"}</TableCell>
                  <TableCell>
                    <form action="/api/cro/enter" method="post" className="flex justify-end">
                      <input type="hidden" name="accountId" value={a.id} />
                      <button
                        type="submit"
                        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-caption font-semibold text-primary-700 transition-colors hover:border-primary-700"
                      >
                        Enter →
                      </button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <LocalPaginationBar
            page={page}
            pageSize={pageSize}
            totalCount={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}
    </div>
  );
}
