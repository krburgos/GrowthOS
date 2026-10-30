import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 auto-appends an "agentRules" block to CLAUDE.md on every
  // `next dev` run. CLAUDE.md is this repo's own hand-authored governance
  // document (see its own header) — disabled so tooling never rewrites it.
  agentRules: false,
  // PDF exports read their embedded Poppins fonts from disk at runtime
  // (lib/pdf/poppins.ts), which file tracing can't see on its own.
  // Client-confirmed (2026-10-13): the Homepage is now Headquarters and
  // lives at /headquarters. Old bookmarks and emailed links still land.
  async redirects() {
    return [{ source: "/dashboard", destination: "/headquarters", permanent: false }];
  },
  outputFileTracingIncludes: {
    "/api/questionnaire/export": ["./lib/pdf/fonts/**/*", "./public/growthmission-logo.png"],
    "/api/vision-board/export": ["./lib/pdf/fonts/**/*", "./public/growthmission-logo.png"],
    "/api/growth-mission/[slug]/export": ["./lib/pdf/fonts/**/*", "./public/growthmission-logo.png"],
    "/api/advocate-dash/[targetId]/report": ["./lib/pdf/fonts/**/*", "./public/growthmission-logo.png"],
    "/api/sniperleads/reports/[id]/pdf": ["./lib/pdf/fonts/**/*", "./public/growthmission-logo.png"],
  },
};

export default nextConfig;
