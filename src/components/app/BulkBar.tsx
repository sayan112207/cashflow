import { AppButton } from "@/components/app/AppButton";

type BulkBarProps = {
  count: number;
  onChase: () => void;
};

/**
 * Sits above the Chase now table whenever at least one row is checked.
 *
 * `role="status"` because the bar appears, disappears and recounts as rows are
 * ticked. Without it a screen reader user checking a row gets no feedback that
 * a bulk action just became available.
 *
 * The button never reads "Chase all" — it names the exact number it will act
 * on, because the alternative invites someone to send reminders to a set they
 * did not look at.
 */
export function BulkBar({ count, onChase }: BulkBarProps) {
  if (count === 0) return null;

  const invoiceWord = count === 1 ? "invoice" : "invoices";

  return (
    <div
      role="status"
      className="mb-3 flex items-center justify-between rounded-card border border-accent-edge bg-accent-tint px-4 py-3"
    >
      <span className="text-body font-semibold text-fg">{count} selected</span>
      <AppButton variant="primary" onClick={onChase}>
        Chase {count} {invoiceWord}
      </AppButton>
    </div>
  );
}
