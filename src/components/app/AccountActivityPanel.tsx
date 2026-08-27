import { useQuery } from "@tanstack/react-query";

import { AppButton } from "@/components/app/AppButton";
import { AppSkeleton } from "@/components/app/AppSkeleton";
import type { AccountActivityItem } from "@/lib/schemas/accounts";
import { AccountsApiError, accountsQueryKeys, getAccountActivity } from "@/lib/services/accounts";

type AccountActivityPanelProps = {
  accountId: string;
};

const TITLE_TONE = {
  neutral: "text-fg",
  warn: "text-warn",
  danger: "text-danger",
} as const;

/**
 * Spec §6 — structured activity entries. Title and detail are backend-composed;
 * link_href is an app-relative path rendered as a plain anchor.
 */
export function AccountActivityPanel({ accountId }: AccountActivityPanelProps) {
  const activityQuery = useQuery({
    queryKey: accountsQueryKeys.activity(accountId),
    queryFn: () => getAccountActivity(accountId),
    retry: false,
  });

  if (activityQuery.isPending) {
    return <ActivityLoading />;
  }

  if (activityQuery.isError) {
    const message =
      activityQuery.error instanceof AccountsApiError
        ? activityQuery.error.message
        : "Couldn't load activity.";
    return (
      <div className="rounded-card border border-hairline bg-card p-6">
        <p className="text-body font-semibold text-fg">{message}</p>
        <div className="mt-3">
          <AppButton
            variant="secondary"
            onClick={() => {
              void activityQuery.refetch();
            }}
          >
            Retry
          </AppButton>
        </div>
      </div>
    );
  }

  const items = activityQuery.data?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="rounded-card border border-hairline bg-card p-8 text-center">
        <p className="text-body font-semibold text-fg">Nothing has happened on this account yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-hairline bg-card p-6">
      <ol className="flex flex-col">
        {items.map((item, index) => (
          <ActivityEntry key={item.activity_id} item={item} isLast={index === items.length - 1} />
        ))}
      </ol>
    </div>
  );
}

function ActivityEntry({ item, isLast }: { item: AccountActivityItem; isLast: boolean }) {
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {isLast ? null : (
        <span
          aria-hidden="true"
          className="absolute top-3 left-[3px] h-full w-px bg-hairline"
        />
      )}
      <span
        aria-hidden="true"
        className="relative mt-[6px] h-[7px] w-[7px] shrink-0 rounded-pill bg-accent-line"
      />

      <div className="min-w-0 flex-1">
        <time
          dateTime={item.occurred_at}
          className="text-eyebrow font-semibold tracking-[0.08em] text-fg-muted uppercase"
        >
          {item.when_label}
        </time>

        <p className={`mt-1 text-body font-semibold ${TITLE_TONE[item.title_tone]}`}>
          {item.title}
        </p>

        <p className="mt-0.5 text-prose font-normal text-fg-soft">{item.detail}</p>

        {item.link_label && item.link_href ? (
          <a
            href={item.link_href}
            className="mt-1.5 inline-block text-prose font-semibold text-accent hover:text-accent-hover"
          >
            {item.link_label}
          </a>
        ) : null}
      </div>
    </li>
  );
}

function ActivityLoading() {
  return (
    <div className="rounded-card border border-hairline bg-card p-6">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="mb-6 flex gap-4 last:mb-0">
          <AppSkeleton className="mt-[6px] h-[7px] w-[7px] shrink-0 rounded-pill" />
          <div className="flex-1">
            <AppSkeleton className="h-3 w-24 rounded-check" />
            <AppSkeleton className="mt-2 h-4 w-64 rounded-check" />
            <AppSkeleton className="mt-1.5 h-3 w-80 rounded-check" />
          </div>
        </div>
      ))}
    </div>
  );
}
