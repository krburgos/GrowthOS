import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Throwaway RLS-proof route (Implementation Plan Milestone 3). Queries
 * `contacts` as both a genuinely anonymous client (anon key, no session)
 * and the service-role client, to prove RLS actually blocks the former
 * and the latter still sees everything, before any real UI is built that
 * could mask a misconfigured policy.
 *
 * DELETE THIS ROUTE before Milestone 13 — it exists only for this
 * checkpoint.
 */
export async function GET() {
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const serviceRoleClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [anonResult, serviceRoleResult] = await Promise.all([
    anonClient.from("contacts").select("id"),
    serviceRoleClient.from("contacts").select("id"),
  ]);

  return NextResponse.json({
    note: "Throwaway RLS-proof route — delete before Milestone 13.",
    anon_row_count: anonResult.data?.length ?? null,
    anon_error: anonResult.error?.message ?? null,
    service_role_row_count: serviceRoleResult.data?.length ?? null,
    service_role_error: serviceRoleResult.error?.message ?? null,
  });
}
