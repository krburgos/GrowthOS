"use client";

import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** Names and types are capped at 60 characters (opportunities check constraints). */
export const OPPORTUNITY_TEXT_MAX = 60;

// One fetch per account per page visit, shared by every Type box on the page.
const typesByAccount = new Map<string, Promise<string[]>>();

function loadTypes(accountId: string): Promise<string[]> {
  let pending = typesByAccount.get(accountId);
  if (!pending) {
    pending = (async () => {
      const { data } = await createClient()
        .from("opportunities")
        .select("type")
        .eq("account_id", accountId)
        .not("type", "is", null)
        .limit(1000);
      const seen = new Map<string, string>();
      for (const row of (data ?? []) as { type: string }[]) {
        const t = row.type.trim();
        if (t && !seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t);
      }
      return [...seen.values()].sort((a, b) => a.localeCompare(b));
    })();
    typesByAccount.set(accountId, pending);
  }
  return pending;
}

/** A saved type joins the suggestions for the rest of the visit. */
export function rememberType(accountId: string, type: string | null) {
  const t = type?.trim();
  if (!t) return;
  const pending = typesByAccount.get(accountId);
  if (!pending) return;
  typesByAccount.set(
    accountId,
    pending.then((list) => (list.some((x) => x.toLowerCase() === t.toLowerCase()) ? list : [...list, t].sort((a, b) => a.localeCompare(b))))
  );
}

/**
 * Opportunity Type (client-confirmed, 2026-10-26, approved mockup
 * "Opportunity Type"): free text, optional, up to 60 characters. While
 * typing, the types already used in this account are suggested so the same
 * type isn't spelled two ways; anything new can still be typed. The list
 * floats above the page, so a table cell never clips it.
 */
export function TypeInput({
  accountId,
  value,
  onChange,
  className,
  autoFocus,
  onKeyDown,
}: {
  accountId: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const [types, setTypes] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadTypes(accountId).then((list) => {
      if (!cancelled) setTypes(list);
    });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const q = value.trim().toLowerCase();
  const matches = useMemo(
    () => types.filter((t) => t.toLowerCase() !== q && (!q || t.toLowerCase().includes(q))).slice(0, 6),
    [types, q]
  );
  const showList = open && matches.length > 0;

  return (
    <Popover open={showList} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Input
          value={value}
          maxLength={OPPORTUNITY_TEXT_MAX}
          autoFocus={autoFocus}
          placeholder="Optional"
          aria-label="Opportunity type"
          aria-autocomplete="list"
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && showList) {
              e.stopPropagation();
              setOpen(false);
              return;
            }
            onKeyDown?.(e);
          }}
          className={className}
        />
      </PopoverAnchor>
      <PopoverContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-[var(--radix-popover-trigger-width)] min-w-56 p-0"
      >
        <p className="px-3 pb-1 pt-2 text-caption text-neutral-400">Used in this account</p>
        <ul role="listbox" aria-label="Types used in this account" className="pb-1">
          {matches.map((t) => (
            <li key={t} role="option" aria-selected={false}>
              <button
                type="button"
                // Picks before the input's blur closes the list.
                onPointerDown={(e) => {
                  e.preventDefault();
                  onChange(t);
                  setOpen(false);
                }}
                className={cn(
                  "block w-full truncate px-3 py-2 text-left text-body text-neutral-800 hover:bg-primary-50 focus-visible:bg-primary-50 focus-visible:outline-none"
                )}
              >
                {t}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
