/**
 * The Vision Board's artwork (client-confirmed, 2026-09-22): drawn in the
 * browser from Design System §9 tokens rather than shipped as image files.
 *
 * Three reasons it is built this way rather than photographed: there is
 * nothing to license or host, it cannot date the way stock photography
 * does, and it is guaranteed to stay on brand because every colour in it
 * is a token. A per-account uploaded hero image was considered and left
 * for later, since file attachments are out of Phase 1 by default
 * (Backend Schema §12).
 *
 * "Aurora" is the soft colour field behind the hero - deliberately the
 * least busy of the three sketched, because the 10-Year Target sitting on
 * it is usually a full sentence. "Field" is the dot grid used behind the
 * obstacles band, where something more restrained and technical suits the
 * change of tone.
 */

export function AuroraArt() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-[-10%] top-[-30%] h-[150%] blur-[6px]"
      style={{
        background: [
          "radial-gradient(60% 55% at 78% 8%, color-mix(in srgb, var(--color-secondary-500) 55%, transparent) 0%, transparent 62%)",
          "radial-gradient(48% 45% at 12% 92%, color-mix(in srgb, var(--color-primary-500) 50%, transparent) 0%, transparent 60%)",
          "radial-gradient(35% 40% at 52% 38%, color-mix(in srgb, var(--color-secondary-300) 22%, transparent) 0%, transparent 70%)",
        ].join(","),
      }}
    />
  );
}

export function FieldArt() {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(color-mix(in srgb, var(--color-secondary-300) 30%, transparent) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          WebkitMaskImage: "radial-gradient(75% 60% at 70% 20%, #000, transparent 72%)",
          maskImage: "radial-gradient(75% 60% at 70% 20%, #000, transparent 72%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[-15%] bottom-[-55%] h-full rounded-[50%]"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in srgb, var(--color-secondary-500) 30%, transparent), transparent)",
        }}
      />
    </>
  );
}

/** The ring motif on a value card; the index shifts it so no two match. */
export function RingArt({ index }: { index: number }) {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute rounded-full border-[1.5px]"
        style={{
          right: `${-40 + index * 6}px`,
          top: `${-40 - index * 4}px`,
          width: "150px",
          height: "150px",
          borderColor: "color-mix(in srgb, var(--color-secondary-300) 28%, transparent)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-3 -top-3 size-[90px] rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in srgb, var(--color-secondary-500) 45%, transparent), transparent)",
        }}
      />
    </>
  );
}
