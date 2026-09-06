/**
 * Impeccable critique finding (2026-09-06, P1): raw Postgres/Supabase
 * error strings were reaching end users verbatim via `toast.error(error.message)`
 * at ~20 call sites — an RLS denial or constraint violation showed DB
 * internals an MSP user has no way to act on. `contact-overview-form.tsx`
 * already special-cased 23505 correctly; this generalizes that pattern
 * so every mutation gets a message a non-technical user can act on.
 */
const CODE_MESSAGES: Record<string, string> = {
  "23505": "A record with that value already exists.",
  "23503": "This can't be completed because other records still depend on it.",
  "23502": "A required field is missing.",
  "42501": "You don't have permission to do that.",
  PGRST116: "That record couldn't be found — it may have been deleted.",
};

export function getFriendlyErrorMessage(error: { code?: string; message?: string } | null | undefined): string {
  if (error?.code && CODE_MESSAGES[error.code]) {
    return CODE_MESSAGES[error.code];
  }
  return "Something went wrong. Please try again.";
}
