export type OAuthProviderKey = "google" | "microsoft";

export const OAUTH_PROVIDERS: OAuthProviderKey[] = ["google", "microsoft"];

export function isOAuthProvider(value: string): value is OAuthProviderKey {
  return OAUTH_PROVIDERS.includes(value as OAuthProviderKey);
}

interface OAuthProviderConfig {
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  /**
   * Minimal identity-only scope (Implementation Plan §12) — actual
   * sending goes through the SendGrid relay (Milestone 10), not the
   * provider's own send API, so no mail-send scope is requested here.
   */
  scope: string;
  clientId: string;
  clientSecret: string;
  extraAuthParams?: Record<string, string>;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

export function getOAuthProviderConfig(provider: OAuthProviderKey): OAuthProviderConfig {
  switch (provider) {
    case "google":
      return {
        authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
        scope: "openid email profile",
        clientId: requireEnv("GOOGLE_OAUTH_CLIENT_ID"),
        clientSecret: requireEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
        // access_type=offline + prompt=consent guarantee a refresh_token is
        // issued (Google otherwise only returns one on a user's first
        // consent, per the offline-access exchange described in §5.2).
        extraAuthParams: { access_type: "offline", prompt: "consent" },
      };
    case "microsoft":
      return {
        authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        userInfoUrl: "https://graph.microsoft.com/oidc/userinfo",
        scope: "openid email profile offline_access User.Read",
        clientId: requireEnv("MICROSOFT_OAUTH_CLIENT_ID"),
        clientSecret: requireEnv("MICROSOFT_OAUTH_CLIENT_SECRET"),
      };
  }
}

export function oauthRedirectUri(origin: string, provider: OAuthProviderKey): string {
  return `${origin}/api/oauth/${provider}/callback`;
}
