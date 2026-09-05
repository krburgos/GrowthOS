import type { Metadata } from "next";

export const metadata: Metadata = { title: "Settings — GrowthOS" };

/**
 * Level A of the Settings navigation panel (Design System §8.9) — no
 * content of its own, just the "My Profile / Account Settings" chooser
 * rendered by the panel itself. Landing here directly (via the sidebar
 * icon) shows an empty prompt until one of those is picked.
 */
export default function SettingsIndexPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 items-center justify-center p-6 md:p-8">
      <p className="text-body text-neutral-500">Choose My Profile or Account Settings to get started.</p>
    </main>
  );
}
