import { AlertTriangle } from "lucide-react";

/**
 * Design System §8.11 doesn't spec a distinct persistent "error state"
 * visual beyond the loading spinner and empty state — App Flow §6 routes
 * most failures through a silent toast instead. This exists only for the
 * case a toast can't cover: a full page/section whose data fetch failed
 * outright, so there's nothing else to render.
 */
export function ErrorState({ message = "Something went wrong loading this page." }: { message?: string }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 py-8 text-center">
      <AlertTriangle className="size-12 text-error-500" strokeWidth={1.5} />
      <p className="text-body text-neutral-500">{message}</p>
    </div>
  );
}
