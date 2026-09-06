import { SettingsPanel } from "@/components/shell/settings-panel";

/**
 * Docks the Settings navigation panel (Design System §8.9) between the
 * icon rail and every Settings page's content, replacing the old
 * in-page horizontal tab bar.
 *
 * Plain `flex`/`flex-1` here, not `min-h-full` — see the msp-shell
 * layout's sizing note for why.
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1">
      <SettingsPanel />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
