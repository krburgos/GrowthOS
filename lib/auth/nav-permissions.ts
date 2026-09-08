import type { UserRole } from "@/lib/auth/get-current-user";

export type NavAccess = "full" | "view" | "disabled";
export type NavSection =
  | "contacts"
  | "companies"
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
 * cannot edit outside the matrix" scope. Client-confirmed addition
 * (2026-09-08): `partner` gets the same CRM-data "full" access as
 * cro_advisor within whichever account(s) they've been granted
 * (`partner_account_grants`), but `settings: "disabled"` — a partner
 * never manages an MSP's own user roster or account settings, only its
 * CRM data. Applies once a CRO Leader/partner session has "entered" an
 * MSP account (`/cro`, `POST /api/cro/enter`).
 */
export const SIDEBAR_ACCESS: Record<UserRole, Record<NavSection, NavAccess>> = {
  msp_owner: {
    contacts: "full",
    companies: "full",
    opportunities: "full",
    lists: "full",
    campaigns: "full",
    reports: "full",
    settings: "full",
  },
  msp_admin: {
    contacts: "full",
    companies: "full",
    opportunities: "full",
    lists: "full",
    campaigns: "full",
    reports: "full",
    settings: "full",
  },
  msp_sales: {
    contacts: "full",
    companies: "full",
    opportunities: "full",
    lists: "view",
    campaigns: "view",
    reports: "view",
    settings: "disabled",
  },
  msp_marketing: {
    contacts: "full",
    companies: "full",
    opportunities: "view",
    lists: "full",
    campaigns: "full",
    reports: "view",
    settings: "disabled",
  },
  msp_read_only: {
    contacts: "view",
    companies: "view",
    opportunities: "view",
    lists: "view",
    campaigns: "view",
    reports: "view",
    settings: "disabled",
  },
  cro_admin: {
    contacts: "full",
    companies: "full",
    opportunities: "full",
    lists: "full",
    campaigns: "full",
    reports: "full",
    settings: "full",
  },
  cro_advisor: {
    contacts: "full",
    companies: "full",
    opportunities: "full",
    lists: "full",
    campaigns: "full",
    reports: "full",
    settings: "full",
  },
  cro_service_team: {
    contacts: "view",
    companies: "view",
    opportunities: "view",
    lists: "view",
    campaigns: "view",
    reports: "view",
    settings: "disabled",
  },
  partner: {
    contacts: "full",
    companies: "full",
    opportunities: "full",
    lists: "full",
    campaigns: "full",
    reports: "full",
    settings: "disabled",
  },
};
