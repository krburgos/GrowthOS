/**
 * Client-confirmed modernization pass (approved mockup): a soft
 * navy/teal radial-gradient ground instead of the plain neutral
 * background, and a deeper card shadow — cosmetic only, no change to
 * the auth forms themselves.
 *
 * Impeccable critique finding (2026-09-06, P1): the logo originally sat
 * directly on the gradient above the card, violating Design System §2
 * ("the full-color logo... is for white or near-white backgrounds
 * only... don't place it over a busy photo/background"). Moved inside
 * the white card instead — spec-compliant without a new logo asset.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-full flex-1 items-center justify-center px-4 py-12"
      style={{
        background:
          "radial-gradient(1100px circle at 15% 10%, var(--color-secondary-800) 0%, transparent 45%), radial-gradient(1100px circle at 85% 90%, var(--color-primary-700) 0%, transparent 45%), var(--color-primary-950)",
      }}
    >
      <div className="w-full max-w-sm">
        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-[0_20px_50px_-12px_rgba(2,20,50,0.45)]">
          <div className="mb-6 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/growthos-logo.png" alt="GrowthOS" className="h-12 w-auto" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
