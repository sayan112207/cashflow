import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * `/app` has no screen of its own — Accounts is the first real list on this
 * branch, so the bare path lands there.
 */
export const Route = createFileRoute("/app/")({
  beforeLoad: () => {
    throw redirect({ to: "/app/accounts" });
  },
});
