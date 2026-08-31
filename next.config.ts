import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 auto-appends an "agentRules" block to CLAUDE.md on every
  // `next dev` run. CLAUDE.md is this repo's own hand-authored governance
  // document (see its own header) — disabled so tooling never rewrites it.
  agentRules: false,
};

export default nextConfig;
