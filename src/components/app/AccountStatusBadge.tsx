import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ChaseStatusLabel } from "@/lib/schemas/accounts";

/**
 * Account chase-status label. Same Badge wrap as `PriorityBadge`, different
 * vocabulary — Active / Can't chase / Paused are not priority bands.
 */
const LABEL_CLASSES: Record<ChaseStatusLabel, string> = {
  Active: "bg-alt text-fg-soft",
  "Can't chase": "bg-danger-tint text-danger",
  Paused: "bg-warn-tint text-warn",
};

export function AccountStatusBadge({ label }: { label: ChaseStatusLabel }) {
  return (
    <Badge
      variant="outline"
      className={cn("rounded-pill border-transparent text-pill font-semibold", LABEL_CLASSES[label])}
    >
      {label}
    </Badge>
  );
}
