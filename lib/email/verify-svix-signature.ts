import { createHmac, timingSafeEqual } from "crypto";

/**
 * Resend delivers webhooks (Backend Schema §9) signed via Svix. No new
 * dependency added for this (Tech Stack Lockfile discipline) — Svix's
 * scheme is a documented, simple HMAC-SHA256 over "{id}.{timestamp}.{body}",
 * verifiable with Node's built-in crypto module.
 */
export function verifySvixSignature({
  payload,
  svixId,
  svixTimestamp,
  svixSignature,
  secret,
}: {
  payload: string;
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
  secret: string;
}): boolean {
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${svixId}.${svixTimestamp}.${payload}`;
  const expected = createHmac("sha256", secretBytes).update(signedContent).digest("base64");
  const expectedBuf = Buffer.from(expected, "base64");

  return svixSignature
    .split(" ")
    .map((entry) => entry.split(",")[1])
    .filter((sig): sig is string => !!sig)
    .some((sig) => {
      try {
        const sigBuf = Buffer.from(sig, "base64");
        return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
      } catch {
        return false;
      }
    });
}
