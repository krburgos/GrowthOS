import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS entirely (Backend Schema §11).
 *
 * ONLY ever import this from inside app/api/ route handlers. Never from
 * a Client Component, a Server Component that renders on a client-visible
 * path, or anything that could end up in a browser bundle — the service
 * role key must never reach the client.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
