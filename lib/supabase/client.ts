import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client for direct-to-Supabase CRUD under RLS (Backend Schema
 * §11) — use in Client Components. Never use the service role key here.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
