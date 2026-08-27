import { Clock } from "lucide-react";

import { AppButton } from "@/components/app/AppButton";
import type { AccountRecommendation } from "@/lib/schemas/accounts";

type AccountRecommendationStripProps = {
  recommendation: AccountRecommendation | null;
};

/**
 * Backend-composed action strip between aging and tabs. Renders the three
 * recommendation fields verbatim; when `null`, nothing mounts.
 */
export function AccountRecommendationStrip({ recommendation }: AccountRecommendationStripProps) {
  if (recommendation === null) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-hairline bg-card px-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Clock className="size-4 shrink-0 text-fg-muted" aria-hidden="true" focusable="false" />
        <p className="text-body font-semibold text-fg">{recommendation.sentence}</p>
      </div>
      <AppButton
        variant="secondary"
        className="shrink-0"
        onClick={() => {
          window.location.assign(recommendation.action_href);
        }}
      >
        {recommendation.action_label}
      </AppButton>
    </div>
  );
}
