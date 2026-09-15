import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * `/app` has no screen of its own — the Dashboard lives at `/app/dashboard`,
 * so every section including the default one has a nameable URL.
 *
 * Redirects in `beforeLoad` rather than rendering and then navigating, so the
 * bare `/app` never paints an empty shell first.
 */
export const Route = createFileRoute("/app/")({
  beforeLoad: () => {
    throw redirect({ to: "/app/dashboard" });
  },
});
