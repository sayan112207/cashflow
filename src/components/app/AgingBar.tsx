import { formatINR } from "@/lib/format";
import type { AgingBucket, AgingSegment } from "@/lib/schemas/dashboard";

/** Decorative fills. None of these is ever used for text. */
const SEGMENT_CLASSES: Record<AgingBucket, string> = {
  "Not yet due": "bg-aging-none",
  "1–30": "bg-aging-30",
  "31–60": "bg-aging-60",
  "61–90": "bg-aging-90",
  "90+": "bg-aging-over",
};

/**
 * Widths come from the amounts, not from `share_pct`. The contract rounds
 * shares to one decimal, so the fixture's five add up to 99.9 and the bar would
 * finish 0.1% short of its own track.
 */
function widthPercent(amount: string, total: number): number {
  if (total <= 0) return 0;
  return (Number(amount) / total) * 100;
}

/**
 * Everything visible here is hidden from assistive tech and re-stated in the
 * `sr-only` table below it. The bar is shape and colour; the labels beneath it
 * would otherwise be read a second time, in column order, with no indication
 * that they pair up. One accessible representation, not two competing ones.
 */
export function AgingBar({ segments }: { segments: readonly AgingSegment[] }) {
  const total = segments.reduce((sum, segment) => sum + Number(segment.amount), 0);

  return (
    <div>
      {/* h-2.5 is 10px exactly — a Tailwind step, not an arbitrary value. */}
      <div className="flex h-2.5 overflow-hidden rounded-pill" aria-hidden="true">
        {segments.map((segment) => (
          <div
            key={segment.bucket}
            className={SEGMENT_CLASSES[segment.bucket]}
            style={{ width: `${widthPercent(segment.amount, total)}%` }}
          />
        ))}
      </div>

      {/*
       * Evenly spaced rather than width-matched to the segments above. The
       * 61–90 bucket is 9.8% of the bar and cannot hold "₹1,80,000" at any
       * legible size, so aligning labels to segments would clip real figures.
       */}
      <div className="mt-3 grid grid-cols-5 gap-4" aria-hidden="true">
        {segments.map((segment) => (
          <div key={segment.bucket}>
            <div className="text-eyebrow font-semibold tracking-widest text-fg-muted uppercase">
              {segment.bucket}
            </div>
            <div className="tnum mt-1 text-prose font-semibold text-fg">
              {formatINR(segment.amount)}
            </div>
          </div>
        ))}
      </div>

      <table className="sr-only">
        <caption>Outstanding by age</caption>
        <thead>
          <tr>
            <th scope="col">Age</th>
            <th scope="col">Amount outstanding</th>
          </tr>
        </thead>
        <tbody>
          {segments.map((segment) => (
            <tr key={segment.bucket}>
              <th scope="row">{segment.bucket}</th>
              <td>{formatINR(segment.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
