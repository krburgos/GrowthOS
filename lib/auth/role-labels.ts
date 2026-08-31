import type { UserRole } from "@/lib/auth/get-current-user";

export const ROLE_LABELS: Record<UserRole, string> = {
  msp_owner: "MSP Owner",
  msp_admin: "MSP Admin",
  msp_sales: "MSP Sales User",
  msp_marketing: "MSP Marketing User",
  msp_read_only: "MSP Read-Only User",
  cro_admin: "CRO Leader Admin",
  cro_advisor: "CRO Leader Advisor",
  cro_service_team: "CRO Leader Service Team",
};
