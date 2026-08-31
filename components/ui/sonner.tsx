"use client";

import { Toaster as SonnerToaster } from "sonner";

/**
 * Design System §8.8 — Toast Notifications.
 * Bottom-right, radius-md, shadow-xl, 16px padding, 360px width.
 * Success: success-400 left border accent (4px) + success-800 icon.
 * Error: same pattern with error-600. Auto-dismiss after 5 seconds.
 */
function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      duration={5000}
      closeButton
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            "!w-[360px] !rounded-md !shadow-xl !p-4 !bg-white !border !border-neutral-200 !text-body !text-neutral-800",
          success: "!border-l-4 !border-l-success-400",
          error: "!border-l-4 !border-l-error-600",
          icon: "!text-success-800",
        },
      }}
    />
  );
}

export { Toaster };
