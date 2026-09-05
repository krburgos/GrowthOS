import { NextResponse, type NextRequest } from "next/server";

import { encryptToken } from "@/lib/crypto/token-encryption";
import { getOAuthProviderConfig, isOAuthProvider, oauthRedirectUri } from "@/lib/oauth/providers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

/**
 * Backend Schema §10 — GET /api/oauth/[provider]/callback. Exchanges the
 * auth code for tokens, encrypts them (§5.2), and upserts an
 * email_connections row. Runs on the service role since it handles the
 * OAuth client secret and the token ciphertext directly (§11 hybrid
 * access table) — RLS on email_connections is bypassed intentionally
 * here, not worked around.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const origin = new URL(request.url).origin;
  const toSettings = (query: string) => NextResponse.redirect(new URL(`/settings/email${query}`, origin));

  if (!isOAuthProvider(provider)) {
    return NextResponse.json({ error: "Unknown provider." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get(`oauth_state_${provider}`)?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return toSettings("?error=oauth_state_mismatch");
  }

  const config = getOAuthProviderConfig(provider);

  const tokenResponse = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: oauthRedirectUri(origin, provider),
      grant_type: "authorization_code",
      scope: config.scope,
    }),
  });

  if (!tokenResponse.ok) {
    return toSettings("?error=token_exchange_failed");
  }
  const tokens = (await tokenResponse.json()) as TokenResponse;

  if (!tokens.refresh_token) {
    // /start forces prompt=consent (Google) so a refresh_token should
    // always come back on a fresh connect; surfaced as an error rather
    // than silently storing a connection that can never be refreshed.
    return toSettings("?error=no_refresh_token");
  }

  const userInfoResponse = await fetch(config.userInfoUrl, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userInfoResponse.ok) {
    return toSettings("?error=userinfo_failed");
  }
  const userInfo = (await userInfoResponse.json()) as { email?: string };
  if (!userInfo.email) {
    return toSettings("?error=no_email");
  }

  const tokenExpiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  const admin = createAdminClient();

  // Only one active connection per user (Backend Schema §5.2 unique
  // index) — archive any existing active row rather than trying to
  // reconcile an update across a possible provider switch.
  await admin
    .from("email_connections")
    .update({ archived_at: new Date().toISOString(), status: "disconnected" })
    .eq("user_id", user.id)
    .is("archived_at", null);

  const { error: insertError } = await admin.from("email_connections").insert({
    user_id: user.id,
    provider,
    email_address: userInfo.email,
    access_token_encrypted: encryptToken(tokens.access_token),
    refresh_token_encrypted: encryptToken(tokens.refresh_token),
    token_expires_at: tokenExpiresAt,
    status: "connected",
  });

  const response = toSettings(insertError ? "?error=save_failed" : "?connected=1");
  response.cookies.delete(`oauth_state_${provider}`);
  return response;
}
