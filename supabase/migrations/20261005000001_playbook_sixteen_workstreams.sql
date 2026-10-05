-- Client-confirmed (2026-10-05): the Playbook goes from fourteen
-- workstreams to sixteen, two are renamed, and the order changes.
--
-- This supersedes the source document ("GrowthOS Dashboard.docx"), which
-- defines fourteen steps in four phases. The phases are dropped with it —
-- the new order interleaves them (SDR Outreach moves to 12 while Reviews
-- and Events sit at 14 and 15), so they no longer group into blocks and a
-- step header would have read "Step 12 · Phase 4" above "Step 14 · Phase
-- 3". The 1–16 order is the structure now.
--
-- The two renames change the enum value itself rather than only the label,
-- so the URL matches the name. RENAME VALUE rewrites it in place, so every
-- existing task, report, hours and status row follows automatically — no
-- row migration. Old bookmarks to the previous slugs will 404.
alter type gos_dashboard_step rename value 'social-media' to 'social-media-marketing';
alter type gos_dashboard_step rename value 'pipeline-metrics' to 'opportunities-pipeline';

-- The two new workstreams. AdvocateDash ships as an empty card pending its
-- own instructions; Social Communication covers invites and outreach that
-- is not campaign email.
alter type gos_dashboard_step add value 'social-communication';
alter type gos_dashboard_step add value 'advocate-dash';
