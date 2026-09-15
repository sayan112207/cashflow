import { useRef, useState } from "react";
import { toast } from "sonner";

import { AppButton } from "@/components/app/AppButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePauseAccount, useResumeAccount } from "@/lib/queries/account-detail";
import type { AccountDetail } from "@/lib/schemas/accounts";

type PauseChaseControlsProps = {
  accountId: string;
  detail: AccountDetail;
};

/**
 * Header Pause / Resume. Pausing opens a confirm dialog that requires a reason.
 */
export function PauseChaseControls({ accountId, detail }: PauseChaseControlsProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState("");
  const pauseMutation = usePauseAccount(accountId);
  const resumeMutation = useResumeAccount(accountId);

  const isPaused = detail.settings.paused_at !== null;

  // `isPaused` reads the optimistic copy, so a pending pause flips this branch
  // to Resume immediately — and both actions carry the same `detail.updated_at`
  // as If-Match. Firing the second before the first settles sends a token the
  // backend has already superseded, which comes back `stale_write` and rolls
  // the optimistic update back. Neither action is offered while either is in
  // flight.
  const mutating = pauseMutation.isPending || resumeMutation.isPending;

  /**
   * Held from just before a mutation is fired until it settles.
   *
   * `mutating` is a rendered value, so it cannot close a gap shorter than a
   * render — two activations dispatched from the same batch both see the old
   * `false`. Less reachable here than in the contacts ladder, where an input's
   * blur and the click that caused it fire in one go, but the failure is the
   * same: both requests carry the `detail.updated_at` from the same render, and
   * the server has already spent that token on the first.
   *
   * The disabled props are the visible half of the rule; this is the half that
   * actually enforces it.
   */
  const inFlight = useRef(false);

  function runExclusive(fire: (release: () => void) => void): void {
    if (inFlight.current) return;
    inFlight.current = true;
    fire(() => {
      inFlight.current = false;
    });
  }

  // The date the new pause would start from; the contract rejects a
  // `paused_until` before today, so the picker should not offer one.
  const today = new Date().toISOString().slice(0, 10);

  function openPauseDialog() {
    setReason(detail.settings.pause_reason ?? "");
    setUntil(detail.settings.paused_until ?? "");
    setOpen(true);
  }

  function confirmPause() {
    const trimmed = reason.trim();
    if (!trimmed) return;
    runExclusive((release) =>
      pauseMutation.mutate(
        {
          body: {
            reason: trimmed,
            ...(until.trim().length > 0 ? { until } : {}),
          },
          ifMatch: detail.updated_at,
        },
        {
          onSuccess: () => {
            setOpen(false);
            setReason("");
            setUntil("");
            toast.success("Chasing paused.");
          },
          onSettled: release,
        },
      ),
    );
  }

  if (isPaused) {
    return (
      <AppButton
        variant="secondary"
        loading={resumeMutation.isPending}
        disabled={mutating}
        onClick={() => {
          runExclusive((release) =>
            resumeMutation.mutate(
              { ifMatch: detail.updated_at },
              { onSuccess: () => toast.success("Chasing resumed."), onSettled: release },
            ),
          );
        }}
      >
        Resume chasing
      </AppButton>
    );
  }

  return (
    <>
      <AppButton variant="secondary" disabled={mutating} onClick={openPauseDialog}>
        Pause chasing
      </AppButton>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-card border-hairline bg-card text-fg shadow-overlay sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-section font-bold text-fg">Pause chasing</DialogTitle>
            <DialogDescription className="text-prose font-normal text-fg-muted">
              Reminders stop until you resume. A reason is required.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <label className="block text-prose font-semibold text-fg-muted">
              Reason
              <input
                type="text"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="mt-1 w-full rounded-input border border-stroke bg-card px-3 py-2 text-body font-semibold text-fg"
                autoFocus
              />
            </label>
            <label className="block text-prose font-semibold text-fg-muted">
              Until (optional)
              <input
                type="date"
                min={today}
                value={until}
                onChange={(event) => setUntil(event.target.value)}
                className="mt-1 w-full rounded-input border border-stroke bg-card px-3 py-2 text-body font-semibold text-fg"
              />
            </label>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <AppButton variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </AppButton>
            <AppButton
              variant="primary"
              loading={pauseMutation.isPending}
              disabled={reason.trim().length === 0 || mutating}
              onClick={confirmPause}
            >
              Pause chasing
            </AppButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
