import { useState } from "react";
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

  function openPauseDialog() {
    setReason(detail.settings.pause_reason ?? "");
    setUntil(detail.settings.paused_until ?? "");
    setOpen(true);
  }

  function confirmPause() {
    const trimmed = reason.trim();
    if (!trimmed) return;
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
      },
    );
  }

  if (isPaused) {
    return (
      <AppButton
        variant="secondary"
        loading={resumeMutation.isPending}
        onClick={() => {
          resumeMutation.mutate(
            { ifMatch: detail.updated_at },
            { onSuccess: () => toast.success("Chasing resumed.") },
          );
        }}
      >
        Resume chasing
      </AppButton>
    );
  }

  return (
    <>
      <AppButton variant="secondary" onClick={openPauseDialog}>
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
              disabled={reason.trim().length === 0}
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
