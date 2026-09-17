import { MockupProvider } from "@/components/gos-dashboard/mockup-store";

export default function GosDashboardLayout({ children }: { children: React.ReactNode }) {
  return <MockupProvider>{children}</MockupProvider>;
}
