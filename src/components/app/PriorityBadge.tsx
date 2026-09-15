import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PriorityBand } from "@/lib/schemas/dashboard";

/**
 * The band type comes from the zod schema rather than a local union, so a
 * change to the contract's vocabulary breaks this file at compile time.
 */
const BAND_CLASSES: Record<PriorityBand, string> = {
  Escalate: "bg-danger-tint text-danger",
  "Chase now": "bg-warn-tint text-warn",
  Watch: "bg-alt text-fg-soft",
};

/**
 * Wraps `ui/badge`. Padding is deliberately left to the primitive: its
 * `px-2.5 py-0.5` is the spec's 10px horizontal, and overriding it on the
 * eight-step spacing scale would round up to 12px for no reason.
 *
 * There is no icon-only form. Colour is never the only signal — every badge
 * carries its text.
 */
export function PriorityBadge({ band }: { band: PriorityBand }) {
  return (
    <Badge
      variant="outline"
      className={cn("rounded-pill border-transparent text-pill font-semibold", BAND_CLASSES[band])}
    >
      {band}
    </Badge>
  );
}
