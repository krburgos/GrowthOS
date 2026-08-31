import type { UserRole } from "@/lib/auth/get-current-user";

export type NavAccess = "full" | "view" | "disabled";
export type NavSection =
  | "contacts"
  | "opportunities"
  | "lists"
  | "campaigns"
  | "reports"
  | "settings";

/**
 * App Flow §2.4 — Role-Based Navigation. "Full" vs "view" only changes
 * in-page edit controls, not whether the sidebar item itself is
 * clickable — only "disabled" does that. CRO Leader roles aren't in the
 * source table (it's MSP-specific); cro_admin/cro_advisor get full
 * access matching their cross-account edit rights (Backend Schema §2),
 * cro_service_team gets view-only, matching its "view across accounts,
 * cannot edit outside the matrix" scope. Unused until Milestone 11 wires
 * the CRO Leader "enter an MSP account" flow.
 */
export const SIDEBAR_ACCESS: Record<UserRole, Record<NavSection, NavAccess>> = {
  msp_owner: {
    contacts: "full",
    opportunities: "full",
    lists: "full",
    campaigns: "full",
    reports: "full",
    settings: "full",
  },
  msp_admin: {
    contacts: "full",
    opportunities: "full",
    lists: "full",
    campaigns: "full",
    reports: "full",
    settings: "full",
  },
  msp_sales: {
    contacts: "full",
    opportunities: "full",
    lists: "view",
    campaigns: "view",
    reports: "view",
    settings: "disabled",
  },
  msp_marketing: {
    contacts: "full",
    opportunities: "view",
    lists: "full",
    campaigns: "full",
    reports: "view",
    settings: "disabled",
  },
  msp_read_only: {
    contacts: "view",
    opportunities: "view",
    lists: "view",
    campaigns: "view",
    reports: "view",
    settings: "disabled",
  },
  cro_admin: {
    contacts: "full",
    opportunities: "full",
    lists: "full",
    campaigns: "full",
    reports: "full",
    settings: "full",
  },
  cro_advisor: {
    contacts: "full",
    opportunities: "full",
    lists: "full",
    campaigns: "full",
    reports: "full",
    settings: "full",
  },
  cro_service_team: {
    contacts: "view",
    opportunities: "view",
    lists: "view",
    campaigns: "view",
    reports: "view",
    settings: "disabled",
  },
};
