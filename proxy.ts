import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session cookie on every request (Implementation
 * Plan Milestone 3) so Server Components always see a valid session without
 * each one having to handle token refresh itself.
 *
 * Named `proxy` (not `middleware`) per Next.js 16's renamed file convention
 * — `middleware.ts` is deprecated as of v16.0.0.
 */
/** The (app) route group's top-level sections: every page behind sign-in. */
const SIGNED_IN_SECTIONS = [
  "/headquarters",
  "/growth-mission",
  "/contacts",
  "/companies",
  "/opportunities",
  "/lists",
  "/campaigns",
  "/reports",
  "/settings",
  "/vision-board",
  "/my-visits",
  "/cro",
];

function isSignedInPage(pathname: string): boolean {
  return SIGNED_IN_SECTIONS.some((s) => pathname === s || pathname.startsWith(`${s}/`));
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Required to actually refresh the session — do not remove.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Client-confirmed (2026-10-19, approved mockup "Sign-in Routing"):
  // someone signed out who opens a signed-in page — say a Contact link
  // from an email — goes to Log In with that page remembered, and back to
  // it after logging in. The (app) layout still guards every page; this
  // only adds where they were headed. API routes answer for themselves.
  if (!user && isSignedInPage(request.nextUrl.pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(login);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
