import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "GrowthOS",
  description: "GrowthOS CRM",
};

/**
 * `body` uses `h-full` (height: 100%), not `min-h-full` — every nested
 * shell layout (app/(app)/layout.tsx, the msp-shell layout, Settings'
 * docked panel, Contact Detail's record rail, etc.) sizes itself with
 * `min-h-full` down the tree, and a percentage `min-height` only
 * resolves reliably when its ancestor has a *definite* height, not
 * just a `min-height` of its own. With `body` at only `min-h-full`,
 * that chain had no definite anchor, which showed up as extra blank
 * scrollable space at the bottom of the shell on pages with short
 * content (Settings' empty state, Contact Detail) — inconsistent
 * cumulative drift, not any single page's bug. `h-full` still lets the
 * page scroll normally when real content is taller than the viewport
 * (no `overflow: hidden` here) — it only fixes what child percentages
 * resolve against.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${poppins.variable} h-full antialiased`}>
      <body className="h-full flex flex-col bg-neutral-50 text-neutral-800 font-sans text-body">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
