import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Built on Radix directly rather than on `ui/checkbox`, for one reason that
 * matters here: the primitive hard-codes a tick inside its Indicator, and Radix
 * renders that Indicator for the indeterminate state too. A select-all box
 * showing a tick while only three of six rows are selected states the opposite
 * of the truth, one click away from sending real reminders.
 *
 * Its checked fill is also `bg-primary`, which resolves to #18A873 — a colour
 * spec §9 bans as a fill. That part is overridable; the glyph is not.
 *
 * `ui/checkbox` is untouched and still correct for binary checkboxes elsewhere.
 */

type CheckedState = boolean | "indeterminate";

type AppCheckboxProps = {
  checked: CheckedState;
  onCheckedChange: (checked: CheckedState) => void;
  /**
   * Required. These sit in table cells with no visible label, and an unnamed
   * checkbox is unusable by screen reader.
   */
  "aria-label": string;
  className?: string;
};

export function AppCheckbox({ checked, onCheckedChange, className, ...props }: AppCheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      className={cn(
        "grid size-4 shrink-0 cursor-pointer place-content-center rounded-check border border-stroke bg-card",
        "data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-white",
        "data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent data-[state=indeterminate]:text-white",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="grid place-content-center text-current">
        {checked === "indeterminate" ? (
          <Minus className="size-3" strokeWidth={3} aria-hidden="true" />
        ) : (
          <Check className="size-3" strokeWidth={3} aria-hidden="true" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
