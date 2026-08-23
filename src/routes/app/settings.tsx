import { createFileRoute } from "@tanstack/react-router";

import { PRODUCT_NAME } from "@/lib/brand";

/** Structural stub — see accounts.tsx. */
export const Route = createFileRoute("/app/settings")({
  head: () => ({ meta: [{ title: `Settings — ${PRODUCT_NAME}` }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return <h1 className="text-title font-bold tracking-tight text-fg">Settings</h1>;
}
