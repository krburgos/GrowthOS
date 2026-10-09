import path from "node:path";

import type PDFDocument from "pdfkit";

/**
 * The GrowthMission mark, for PDF exports (client-confirmed, 2026-10-09).
 *
 * Read from disk at runtime like the Poppins TTFs, so every route that
 * draws it must also list `./public/growthmission-logo.png` under
 * `outputFileTracingIncludes` in next.config.ts or Vercel will not bundle
 * it and the export will throw at render time.
 */
export const BRAND_LOGO = path.join(process.cwd(), "public", "growthmission-logo.png");

/** The trimmed asset is 1189 x 209. */
export const BRAND_LOGO_ASPECT = 1189 / 209;

/**
 * The mark on a white chip.
 *
 * Every masthead in these documents is `#0a192e` navy, and half the
 * wordmark — "Growth" — is `#113c7b`, which measures **1.64:1** against
 * that navy. It would be invisible. Design System §2 says the same thing
 * in words: the full-colour logo is for white or near-white grounds only.
 *
 * So rather than recolour the mark (there is no knockout version) or
 * lighten the masthead (a visual decision nobody asked for), it sits on
 * its own white chip. That is the compliant reading of §2 and it looks
 * deliberate rather than apologetic.
 *
 * Returns the chip's box so a caller can lay out around it.
 */
export function drawLogoChip(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  logoWidth = 104
): { width: number; height: number } {
  const logoHeight = logoWidth / BRAND_LOGO_ASPECT;
  const padX = 9;
  const padY = 7;
  const width = logoWidth + padX * 2;
  const height = logoHeight + padY * 2;

  doc.save();
  doc.roundedRect(x, y, width, height, 5).fill("#ffffff");
  doc.image(BRAND_LOGO, x + padX, y + padY, { width: logoWidth });
  doc.restore();

  return { width, height };
}

/**
 * The mark drawn straight onto a white page — no chip needed, because the
 * ground is already what the logo was drawn for.
 */
export function drawLogo(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  logoWidth = 92
): { width: number; height: number } {
  doc.image(BRAND_LOGO, x, y, { width: logoWidth });
  return { width: logoWidth, height: logoWidth / BRAND_LOGO_ASPECT };
}
