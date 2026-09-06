import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Milestone 1 checkpoint placeholder — exercises the restyled primitives so
 * the Design System token wiring (color, radius, type, spacing) can be
 * visually confirmed against the spec before any real screen is built.
 * Superseded by the real Dashboard in Milestone 11.
 */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-8 p-6 md:p-8">
      <div>
        <h1 className="text-h1 text-primary-900">GrowthOS</h1>
        <p className="mt-1 text-body text-neutral-500">
          Design system token check — Milestone 1.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-h3 text-primary-900">Buttons</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-h3 text-primary-900">Badges</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">Internal</Badge>
          <Badge variant="info">Engaged</Badge>
          <Badge variant="success">Existing Client</Badge>
          <Badge variant="error">Not a Fit</Badge>
        </div>
      </section>

      <section className="flex max-w-sm flex-col gap-3">
        <h2 className="text-h3 text-primary-900">Form field</h2>
        <div>
          <Label htmlFor="demo-email" required>
            Email
          </Label>
          <Input id="demo-email" type="email" placeholder="you@example.com" />
        </div>
      </section>
    </main>
  );
}
