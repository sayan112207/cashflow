import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useId, useRef, type KeyboardEvent } from "react";

import { AgingBar } from "@/components/app/AgingBar";
import { AppButton } from "@/components/app/AppButton";
import { AppSkeleton } from "@/components/app/AppSkeleton";
import { PRODUCT_NAME } from "@/lib/brand";
import {
  formatCalendarDaysSince,
  formatDataSyncedLabel,
  formatDays,
  formatINR,
  isSyncStale,
} from "@/lib/format";
import {
  accountDetailSearchSchema,
  type AccountDetail,
  type AccountDetailTab,
} from "@/lib/schemas/accounts";
import {
  AccountsApiError,
  accountsQueryKeys,
  getAccount,
} from "@/lib/services/accounts";

const TABS: { id: AccountDetailTab; label: string }[] = [
  { id: "invoices", label: "Invoices" },
  { id: "contacts", label: "Contacts" },
  { id: "payments", label: "Payments" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" },
];

export const Route = createFileRoute("/app/accounts/$accountId")({
  validateSearch: accountDetailSearchSchema,
  head: () => ({ meta: [{ title: `Account — ${PRODUCT_NAME}` }] }),
  component: AccountDetailPage,
});

function AccountDetailPage() {
  const { accountId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();

  const detailQuery = useQuery({
    queryKey: accountsQueryKeys.detail(accountId),
    queryFn: () => getAccount(accountId),
    retry: false,
  });

  function setTab(next: AccountDetailTab) {
    void navigate({
      search: (prev) => ({ ...prev, tab: next }),
      replace: true,
    });
  }

  if (detailQuery.isPending) {
    return <AccountDetailLoading />;
  }

  if (detailQuery.isError) {
    const message =
      detailQuery.error instanceof AccountsApiError
        ? detailQuery.error.message
        : "Couldn't load this account.";
    return (
      <div className="flex flex-col items-start gap-3 py-10">
        <p className="text-body font-semibold text-fg">{message}</p>
        <AppButton
          variant="secondary"
          onClick={() => {
            void detailQuery.refetch();
          }}
        >
          Retry
        </AppButton>
      </div>
    );
  }

  const detail = detailQuery.data;
  if (!detail) return null;

  return (
    <div className="space-y-8">
      <AccountHeaderCard detail={detail} />
      <AgingBar segments={detail.aging} />
      <AccountDetailTabs tab={tab} onTabChange={setTab} />
    </div>
  );
}

function AccountHeaderCard({ detail }: { detail: AccountDetail }) {
  const stale = isSyncStale(detail.last_synced_at);
  const daysSince = formatCalendarDaysSince(detail.last_synced_at);

  return (
    <section className="rounded-card border border-hairline bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-title font-bold tracking-tight text-fg">{detail.name}</h1>
          <SyncLine
            headerStatus={detail.header_status}
            lastSyncedAt={detail.last_synced_at}
            stale={stale}
            daysSince={daysSince}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <AppButton variant="secondary">Pause chasing</AppButton>
          <AppButton variant="text">Edit</AppButton>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-metric font-bold tracking-tight text-fg tnum">
          {formatINR(detail.outstanding)} outstanding
        </p>
        <p className="mt-1 text-section font-bold text-danger tnum">
          of which {formatINR(detail.overdue)} is overdue
        </p>
      </div>

      <p className="mt-4 text-prose font-normal text-fg-muted">{metadataLine(detail)}</p>
    </section>
  );
}

function SyncLine({
  headerStatus,
  lastSyncedAt,
  stale,
  daysSince,
}: {
  headerStatus: string;
  lastSyncedAt: string;
  stale: boolean;
  daysSince: number;
}) {
  if (stale && Number.isFinite(daysSince)) {
    const lead = headerStatus.includes(" — ")
      ? headerStatus.slice(0, headerStatus.indexOf(" — "))
      : headerStatus;
    return (
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <p className="text-prose font-semibold text-warn">
          {lead} — data is {daysSince} {daysSince === 1 ? "day" : "days"} old
        </p>
        <AppButton variant="text">Re-import</AppButton>
      </div>
    );
  }

  return (
    <p className="mt-2 text-prose font-normal text-fg-muted">
      {headerStatus} · {formatDataSyncedLabel(lastSyncedAt)}
    </p>
  );
}

function metadataLine(detail: AccountDetail): string {
  const parts = [`${detail.open_count} open invoices`];
  if (detail.oldest_overdue_days !== null) {
    parts.push(`oldest ${formatDays(detail.oldest_overdue_days)}`);
  }
  if (detail.avg_days_late !== null) {
    parts.push(`pays ${detail.avg_days_late} days late on average`);
  }
  return parts.join(" · ");
}

function AccountDetailTabs({
  tab,
  onTabChange,
}: {
  tab: AccountDetailTab;
  onTabChange: (tab: AccountDetailTab) => void;
}) {
  const baseId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function focusTab(index: number) {
    const tab = TABS[index];
    if (!tab) return;
    onTabChange(tab.id);
    queueMicrotask(() => {
      tabRefs.current[index]?.focus();
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = TABS.findIndex((t) => t.id === tab);
    if (current < 0) return;

    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusTab((current + 1) % TABS.length);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusTab((current - 1 + TABS.length) % TABS.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusTab(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusTab(TABS.length - 1);
    }
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Account sections"
        className="flex gap-6 border-b border-hairline"
        onKeyDown={onKeyDown}
      >
        {TABS.map((item, index) => {
          const selected = item.id === tab;
          return (
            <button
              key={item.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-${item.id}-tab`}
              aria-selected={selected}
              aria-controls={`${baseId}-${item.id}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onTabChange(item.id)}
              className={
                selected
                  ? "border-b-2 border-accent-line pb-3 text-body font-semibold text-fg"
                  : "border-b-2 border-transparent pb-3 text-body font-semibold text-fg-soft hover:text-fg"
              }
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {TABS.map((item) => {
        const selected = item.id === tab;
        return (
          <div
            key={item.id}
            role="tabpanel"
            id={`${baseId}-${item.id}-panel`}
            aria-labelledby={`${baseId}-${item.id}-tab`}
            hidden={!selected}
            className="pt-6"
          >
            {/* Empty shell — tab bodies land in later commits. */}
            {selected ? <div className="min-h-40" /> : null}
          </div>
        );
      })}
    </div>
  );
}

function AccountDetailLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading account">
      <div className="rounded-card border border-hairline bg-card p-5 space-y-4">
        <AppSkeleton className="h-8 w-80" />
        <AppSkeleton className="h-4 w-96" />
        <AppSkeleton className="h-10 w-64" />
        <AppSkeleton className="h-6 w-72" />
        <AppSkeleton className="h-4 w-full max-w-lg" />
      </div>
      <AppSkeleton className="h-16 w-full" />
      <AppSkeleton className="h-10 w-full" />
    </div>
  );
}
