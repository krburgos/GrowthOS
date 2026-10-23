/**
 * Email campaigns are paused while the feature is finished (client-confirmed,
 * 2026-10-23: Phase 1 is done and customers are being added for testing,
 * but campaigns don't work yet). While true, every campaign screen shows a
 * warning, its create/send controls are greyed out, and the send routes
 * refuse to send. Flip to false to turn campaigns back on.
 */
export const CAMPAIGNS_PAUSED = true;

export const CAMPAIGNS_PAUSED_MESSAGE = "Email campaigns are still being built and can't be sent yet.";
