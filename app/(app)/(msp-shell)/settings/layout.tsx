import { SettingsPanel } from "@/components/shell/settings-panel";

/**
 * Docks the Settings navigation panel (Design System §8.9) between the
 * icon rail and every Settings page's content, replacing the old
 * in-page horizontal tab bar.
 *
 * Plain `flex`/`flex-1` here, not `min-h-full`, and `min-w-0` on the
 * content column — see the msp-shell layout's sizing/width notes for
 * why (same shared-layout bug, same fix, one level deeper).
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    /* Stacks below `lg`: the panel can render two 192px nav columns at
       once, which on a phone left the page they navigate to with nothing.
       Each becomes a full-width strip above the content instead. */
    <div className="flex flex-1 flex-col lg:flex-row">
      <SettingsPanel />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
