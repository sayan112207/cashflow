import { useState } from "react";

import { AppButton } from "@/components/app/AppButton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePauseAccount, useResumeAccount } from "@/lib/queries/account-detail";
import { pauseReasonSchema, type AccountDetail, type PauseReason } from "@/lib/schemas/accounts";

type PauseChaseControlsProps = {
  accountId: string;
  detail: AccountDetail;
};

const REASONS = pauseReasonSchema.options;

/**
 * Header Pause / Resume. Pausing opens a popover with a fixed reason vocabulary.
 */
export function PauseChaseControls({ accountId, detail }: PauseChaseControlsProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<PauseReason>(REASONS[0]);
  const [until, setUntil] = useState("");

  const pauseMutation = usePauseAccount(accountId);
  const resumeMutation = useResumeAccount(accountId);

  const isPaused = detail.settings.paused_at !== null;

  if (isPaused) {
    return (
      <AppButton
        variant="secondary"
        loading={resumeMutation.isPending}
        onClick={() => {
          resumeMutation.mutate({ ifMatch: detail.updated_at });
        }}
      >
        Resume chasing
      </AppButton>
    );
  }

  function submitPause() {
    pauseMutation.mutate(
      {
        body: { reason, ...(until.length > 0 ? { until } : {}) },
        ifMatch: detail.updated_at,
      },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <AppButton variant="secondary">Pause chasing</AppButton>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[280px] rounded-card border-hairline bg-card p-4">
        <fieldset className="border-0 p-0">
          <legend className="text-eyebrow font-semibold tracking-[0.08em] text-fg-muted uppercase">
            Reason
          </legend>

          <div className="mt-2 flex flex-col gap-1.5">
            {REASONS.map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2.5 text-body font-semibold text-fg"
              >
                <input
                  type="radio"
                  name="pause-reason"
                  value={option}
                  checked={reason === option}
                  onChange={() => setReason(option)}
                  className="h-3.5 w-3.5 accent-accent"
                />
                {option}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-4">
          <label
            htmlFor="pause-until"
            className="text-eyebrow font-semibold tracking-[0.08em] text-fg-muted uppercase"
          >
            Until <span className="font-normal normal-case">(optional)</span>
          </label>
          <input
            id="pause-until"
            type="date"
            value={until}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(event) => setUntil(event.target.value)}
            className="mt-1.5 w-full rounded-input border border-stroke bg-card px-3 py-2 text-body font-semibold text-fg"
          />
        </div>

        {pauseMutation.error ? (
          <p role="alert" className="mt-3 text-prose font-normal text-danger">
            {pauseMutation.error.message}
          </p>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <AppButton variant="text" onClick={() => setOpen(false)}>
            Cancel
          </AppButton>
          <AppButton variant="primary" loading={pauseMutation.isPending} onClick={submitPause}>
            Confirm
          </AppButton>
        </div>
      </PopoverContent>
    </Popover>
  );
}
