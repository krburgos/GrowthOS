import { randomBytes } from "crypto";

import { NextResponse, type NextRequest } from "next/server";

import { getOAuthProviderConfig, isOAuthProvider, oauthRedirectUri } from "@/lib/oauth/providers";
import { createClient } from "@/lib/supabase/server";

/**
 * Backend Schema §10 — GET /api/oauth/[provider]/start. Redirects to the
 * provider's consent screen for connecting a mailbox (App Flow §5.2).
 * Requires an existing GrowthOS session; the mailbox connection itself is
 * unrelated to login (Backend Schema §3 note).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  if (!isOAuthProvider(provider)) {
    return NextResponse.json({ error: "Unknown provider." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const config = getOAuthProviderConfig(provider);
  const origin = new URL(request.url).origin;
  const state = randomBytes(24).toString("base64url");

  const authUrl = new URL(config.authUrl);
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", oauthRedirectUri(origin, provider));
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", config.scope);
  authUrl.searchParams.set("state", state);
  for (const [key, value] of Object.entries(config.extraAuthParams ?? {})) {
    authUrl.searchParams.set(key, value);
  }

  const response = NextResponse.redirect(authUrl.toString());
  // Short-lived CSRF token, checked against the state param on callback.
  response.cookies.set(`oauth_state_${provider}`, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
