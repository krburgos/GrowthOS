import { Dot } from "lucide-react";

export function DutiesList({ duties }: { duties: string[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {duties.map((duty) => (
        <li key={duty} className="flex items-start gap-1.5 text-body-sm text-neutral-700">
          <Dot className="mt-0.5 size-4 shrink-0 text-secondary-500" />
          <span>{duty}</span>
        </li>
      ))}
    </ul>
  );
}
