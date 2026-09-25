import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 auto-appends an "agentRules" block to CLAUDE.md on every
  // `next dev` run. CLAUDE.md is this repo's own hand-authored governance
  // document (see its own header) — disabled so tooling never rewrites it.
  agentRules: false,
  // PDF exports read their embedded Poppins fonts from disk at runtime
  // (lib/pdf/poppins.ts), which file tracing can't see on its own.
  outputFileTracingIncludes: {
    "/api/questionnaire/export": ["./lib/pdf/fonts/**/*"],
    "/api/vision-board/export": ["./lib/pdf/fonts/**/*"],
    "/api/gos-dashboard/[slug]/export": ["./lib/pdf/fonts/**/*"],
  },
};

export default nextConfig;
