import { createFileRoute } from "@tanstack/react-router";

import { PRODUCT_NAME } from "@/lib/brand";
import {
  accountsSearchSchema,
  type AccountsSearch,
  type AccountsSortColumn,
  type AccountsSortDir,
  type AccountsListFilter,
} from "@/lib/schemas/accounts";

/**
 * Accounts list URL state.
 *
 * Example: `/app/accounts?filter=has_overdue&sort=outstanding&dir=desc`
 *
 * `accountsSearchSchema` applies defaults for missing keys and `.catch` for
 * malformed values, so a bad query string falls back instead of crashing.
 */
export const Route = createFileRoute("/app/accounts")({
  validateSearch: accountsSearchSchema,
  head: () => ({ meta: [{ title: `Accounts — ${PRODUCT_NAME}` }] }),
  component: AccountsPage,
});

function AccountsPage() {
  // Typed from validateSearch — filter may be one value or an array (repeatable).
  const { filter, sort, dir } = Route.useSearch();
  const navigate = Route.useNavigate();

  const filters = filter === undefined ? [] : Array.isArray(filter) ? filter : [filter];

  function setSearch(patch: {
    filter?: AccountsListFilter | AccountsListFilter[];
    sort?: AccountsSortColumn;
    dir?: AccountsSortDir;
    clearFilter?: boolean;
  }) {
    void navigate({
      // Functional update keeps unrelated params stable when we grow the URL later.
      search: (prev: AccountsSearch): AccountsSearch => {
        const next: AccountsSearch = {
          sort: patch.sort ?? prev.sort,
          dir: patch.dir ?? prev.dir,
        };
        if (patch.clearFilter) {
          return next;
        }
        if (patch.filter !== undefined) {
          return { ...next, filter: patch.filter };
        }
        if (prev.filter !== undefined) {
          return { ...next, filter: prev.filter };
        }
        return next;
      },
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Accounts</h1>

      <p className="text-sm text-ink-secondary">
        Search params drive the list (table not built yet). Current URL state:{" "}
        <code className="text-ink">
          filter={filters.length > 0 ? filters.join(",") : "(all)"} · sort={sort} · dir={dir}
        </code>
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-[8px] border border-line px-3 py-1.5 text-sm text-ink"
          onClick={() =>
            setSearch({ filter: "has_overdue", sort: "outstanding", dir: "desc" })
          }
        >
          Has overdue · outstanding desc
        </button>
        <button
          type="button"
          className="rounded-[8px] border border-line px-3 py-1.5 text-sm text-ink"
          onClick={() => setSearch({ filter: "missing_contacts", sort: "name", dir: "asc" })}
        >
          Missing contacts · name asc
        </button>
        <button
          type="button"
          className="rounded-[8px] border border-line px-3 py-1.5 text-sm text-ink"
          onClick={() => setSearch({ clearFilter: true, sort: "outstanding", dir: "desc" })}
        >
          Clear filter (defaults)
        </button>
      </div>
    </div>
  );
}
