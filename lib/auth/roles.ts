import type { UserRole } from "@/lib/auth/get-current-user";

export const MSP_ROLES: UserRole[] = [
  "msp_owner",
  "msp_admin",
  "msp_sales",
  "msp_marketing",
  "msp_read_only",
];

export const CRO_LEADER_ROLES: UserRole[] = ["cro_admin", "cro_advisor", "cro_service_team"];

export const ALL_ROLES: UserRole[] = [...MSP_ROLES, ...CRO_LEADER_ROLES];
