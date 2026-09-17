import path from "node:path";

import type PDFDocument from "pdfkit";

/** Font names to pass to `doc.font()` once `registerPoppins` has run. */
export const POPPINS = {
  regular: "Poppins",
  medium: "Poppins-Medium",
  semibold: "Poppins-SemiBold",
  bold: "Poppins-Bold",
} as const;

const FONT_DIR = path.join(process.cwd(), "lib", "pdf", "fonts");

/**
 * Client-confirmed (2026-09-17): every GrowthOS PDF export uses the Poppins
 * brand font, never pdfkit's built-in Helvetica. The TTFs are read from disk
 * at runtime, so each route that calls this must also be listed under
 * `outputFileTracingIncludes` in next.config.ts or Vercel won't bundle them.
 * This set has no italic, so de-emphasized text uses a lighter color instead.
 */
export function registerPoppins(doc: InstanceType<typeof PDFDocument>) {
  doc.registerFont(POPPINS.regular, path.join(FONT_DIR, "Poppins-Regular.ttf"));
  doc.registerFont(POPPINS.medium, path.join(FONT_DIR, "Poppins-Medium.ttf"));
  doc.registerFont(POPPINS.semibold, path.join(FONT_DIR, "Poppins-SemiBold.ttf"));
  doc.registerFont(POPPINS.bold, path.join(FONT_DIR, "Poppins-Bold.ttf"));
}
