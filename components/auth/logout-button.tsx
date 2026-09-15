"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    // Same viewing-as cookie cleanup as the main TopBar's logout
    // (components/shell/top-bar.tsx) -- this button is the CRO Leader
    // Dashboard's own lightweight header, which doesn't render TopBar.
    await fetch("/api/cro/exit", { method: "POST" });
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleLogout}>
      Log Out
    </Button>
  );
}
