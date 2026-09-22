import PDFDocument from "pdfkit";
import { NextResponse, type NextRequest } from "next/server";

import { registerPoppins } from "@/lib/pdf/poppins";
import { renderVisionBoard, type VisionAnswers } from "@/lib/pdf/vision-board-doc";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/vision-board/export (Backend Schema §10).
 *
 * Anyone who can view the Vision Board can export it, so the regular
 * session client under vision_board_responses RLS is enough - no service
 * role. Poppins is the brand font for every GrowthOS PDF; its TTFs are
 * read from disk, so this route stays listed under
 * `outputFileTracingIncludes` in next.config.ts.
 *
 * The layout itself lives in lib/pdf/vision-board-doc.ts.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = request.nextUrl.searchParams.get("account_id");
  if (!accountId) {
    return NextResponse.json({ error: "Missing account_id." }, { status: 400 });
  }

  const [{ data: response }, { data: account }] = await Promise.all([
    supabase.from("vision_board_responses").select("answers").eq("account_id", accountId).maybeSingle(),
    supabase.from("accounts").select("name, logo_url").eq("id", accountId).maybeSingle(),
  ]);

  if (!response) {
    return NextResponse.json({ error: "No Vision Board found for this account." }, { status: 404 });
  }

  const name = account?.name ?? "GrowthOS Account";

  // The cover carries the account's logo beside its name, the same lockup the
  // page uses. A logo that cannot be fetched is not worth failing an export
  // over, so the cover simply falls back to the name alone.
  let logo: Buffer | undefined;
  if (account?.logo_url) {
    try {
      const res = await fetch(account.logo_url, { signal: AbortSignal.timeout(4000) });
      if (res.ok) logo = Buffer.from(await res.arrayBuffer());
    } catch {
      logo = undefined;
    }
  }

  const doc = new PDFDocument({ size: "LETTER", margin: 54, bufferPages: true });
  registerPoppins(doc);
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  renderVisionBoard(doc, name, (response.answers ?? {}) as VisionAnswers, logo);

  doc.end();
  const buffer = await done;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "account";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="growthos-vision-board-${slug}.pdf"`,
    },
  });
}
