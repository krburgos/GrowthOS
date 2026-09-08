import type { UserRole } from "@/lib/auth/get-current-user";

export const MSP_ROLES: UserRole[] = [
  "msp_owner",
  "msp_admin",
  "msp_sales",
  "msp_marketing",
  "msp_read_only",
];

export const CRO_LEADER_ROLES: UserRole[] = ["cro_admin", "cro_advisor", "cro_service_team"];

/** Client-confirmed addition (2026-09-08) — a vendor/partner relationship, invitable only by cro_admin, scoped to specific accounts via partner_account_grants rather than all of them. */
export const PARTNER_ROLES: UserRole[] = ["partner"];

export const ALL_ROLES: UserRole[] = [...MSP_ROLES, ...CRO_LEADER_ROLES, ...PARTNER_ROLES];
