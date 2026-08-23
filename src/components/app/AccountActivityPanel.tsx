import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppButton } from "@/components/app/AppButton";
import { AppSkeleton } from "@/components/app/AppSkeleton";
import { formatRelativeTimestamp } from "@/lib/format";
import type { AccountActivityItem } from "@/lib/schemas/accounts";
import { AccountsApiError, accountsQueryKeys, getAccountActivity } from "@/lib/services/accounts";

type AccountActivityPanelProps = {
  accountId: string;
};

/**
 * Spec §6 — reverse-chronological sentences. `summary` is rendered verbatim;
 * the frontend never composes activity copy.
 */
export function AccountActivityPanel({ accountId }: AccountActivityPanelProps) {
  const activityQuery = useQuery({
    queryKey: accountsQueryKeys.activity(accountId),
    queryFn: () => getAccountActivity(accountId),
    retry: false,
  });

  if (activityQuery.isPending) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading activity">
        {Array.from({ length: 5 }, (_, i) => (
          <AppSkeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    );
  }

  if (activityQuery.isError) {
    const message =
      activityQuery.error instanceof AccountsApiError
        ? activityQuery.error.message
        : "Couldn't load activity.";
    return (
      <div className="flex flex-col items-start gap-3 py-6">
        <p className="text-body font-semibold text-fg">{message}</p>
        <AppButton
          variant="secondary"
          onClick={() => {
            void activityQuery.refetch();
          }}
        >
          Retry
        </AppButton>
      </div>
    );
  }

  const items = activityQuery.data?.items ?? [];
  if (items.length === 0) {
    return (
      <p className="py-6 text-body font-semibold text-fg">
        Nothing has happened on this account yet.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <ActivityEntry key={item.activity_id} accountId={accountId} item={item} />
      ))}
    </ul>
  );
}

function ActivityEntry({ accountId, item }: { accountId: string; item: AccountActivityItem }) {
  const relative = formatRelativeTimestamp(item.occurred_at);
  const summary = <span className="text-body font-semibold text-fg">{item.summary}</span>;

  let linkedSummary = summary;
  if (item.invoice_id) {
    linkedSummary = (
      <Link
        to="/app/accounts/$accountId"
        params={{ accountId }}
        search={{ tab: "invoices" }}
        className="text-body font-semibold text-fg underline-offset-2 hover:underline"
      >
        {item.summary}
      </Link>
    );
  } else if (item.contact_id) {
    linkedSummary = (
      <Link
        to="/app/accounts/$accountId"
        params={{ accountId }}
        search={{ tab: "contacts" }}
        className="text-body font-semibold text-fg underline-offset-2 hover:underline"
      >
        {item.summary}
      </Link>
    );
  }

  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      {linkedSummary}
      <time dateTime={item.occurred_at} className="shrink-0 text-prose font-normal text-fg-muted">
        {relative}
      </time>
    </li>
  );
}
