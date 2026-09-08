import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { VIEWING_ACCOUNT_COOKIE } from "@/lib/auth/get-current-user";

/** App Flow §2.5 — "Exit to My Dashboard," the banner's own control. Clears the viewing-as cookie and returns to /cro. */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete(VIEWING_ACCOUNT_COOKIE);
  return NextResponse.redirect(new URL("/cro", request.url), { status: 303 });
}
