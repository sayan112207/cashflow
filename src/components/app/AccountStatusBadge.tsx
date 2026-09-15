import { cn } from "@/lib/utils";
import type { ChaseStatusLabel } from "@/lib/schemas/accounts";

/**
 * Account chase-status label. Plain span — not the shared Badge primitive —
 * so landing `badge` borders/radii don't box the cell.
 */
const LABEL_CLASSES: Record<ChaseStatusLabel, string> = {
  Active: "bg-alt text-fg-soft",
  "Can't chase": "bg-danger-tint text-danger",
  Paused: "bg-warn-tint text-warn",
};

export function AccountStatusBadge({ label }: { label: ChaseStatusLabel }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-2.5 py-0.5 text-pill font-semibold",
        LABEL_CLASSES[label],
      )}
    >
      {label}
    </span>
  );
}
