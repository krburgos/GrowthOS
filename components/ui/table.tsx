import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Design System §8.5 — Tables + §5.2 density (40px row height, 8px/12px
 * cell padding, 36px header height). No zebra-striping.
 *
 * Client-confirmed modernization pass (approved mockup): an opt-in
 * `variant="solid"` header (navy fill, white text) and a teal left-rail
 * on selected/active rows, matching the language established on the
 * Contacts table — used on Lists Index and Users & Roles. Plain tables
 * elsewhere (e.g. the Import Contacts preview) keep the original
 * neutral-50 header by omitting the prop.
 */
const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="w-full overflow-x-auto rounded-lg border border-neutral-200">
      <table ref={ref} className={cn("w-full caption-bottom text-body", className)} {...props} />
    </div>
  )
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement> & { variant?: "default" | "solid" }
>(({ className, variant = "default", ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      variant === "solid" ? "bg-primary-900" : "border-b border-neutral-200 bg-neutral-50",
      className
    )}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("bg-white", className)} {...props} />
));
TableBody.displayName = "TableBody";

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement> & { selected?: boolean }
>(({ className, selected, ...props }, ref) => (
  <tr
    ref={ref}
    data-state={selected ? "selected" : undefined}
    className={cn(
      "group relative h-12 border-b border-neutral-100 transition-colors last:border-b-0 hover:bg-neutral-50 data-[state=selected]:bg-secondary-50",
      className
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement> & { variant?: "default" | "solid" }
>(({ className, variant = "default", ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-11 px-4 text-left align-middle text-caption font-semibold tracking-wide",
      variant === "solid" ? "text-white/90" : "uppercase text-neutral-700",
      className
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn("px-3 py-2 align-middle text-neutral-800", className)} {...props} />
));
TableCell.displayName = "TableCell";

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
