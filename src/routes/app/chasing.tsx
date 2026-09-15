import { createFileRoute } from "@tanstack/react-router";

import { PRODUCT_NAME } from "@/lib/brand";

/** Structural stub — see accounts.tsx. */
export const Route = createFileRoute("/app/chasing")({
  head: () => ({ meta: [{ title: `Chasing — ${PRODUCT_NAME}` }] }),
  component: ChasingPage,
});

function ChasingPage() {
  return <h1 className="text-title font-bold tracking-tight text-fg">Chasing</h1>;
}
