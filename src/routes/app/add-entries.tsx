import { createFileRoute } from "@tanstack/react-router";

import { PRODUCT_NAME } from "@/lib/brand";

/** Structural stub — see accounts.tsx. */
export const Route = createFileRoute("/app/add-entries")({
  head: () => ({ meta: [{ title: `Add entries — ${PRODUCT_NAME}` }] }),
  component: AddEntriesPage,
});

function AddEntriesPage() {
  return <h1 className="text-title font-bold tracking-tight text-fg">Add entries</h1>;
}
