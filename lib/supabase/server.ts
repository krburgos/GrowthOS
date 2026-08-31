import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server client for Server Components and Route Handlers — still under
 * RLS (Backend Schema §11), scoped to the requesting user's own session
 * via cookies. Never use the service role key here.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore since the
            // middleware (middleware.ts) already refreshes the session
            // cookie on every request.
          }
        },
      },
    }
  );
}
