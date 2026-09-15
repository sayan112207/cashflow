import type { HTMLAttributes } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Wraps `ui/skeleton`. The primitive's `animate-pulse` is the shimmer the spec
 * forbids — a collections dashboard that breathes while it loads looks busy
 * rather than ready. `twMerge` lets `animate-none` and `bg-alt` replace the
 * primitive's pulse and `bg-primary/10`. `ui/skeleton` is untouched.
 *
 * Decorative: the parent is `aria-busy`, so each bar is hidden from the tree.
 */
export function AppSkeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <Skeleton
      aria-hidden="true"
      className={cn("animate-none rounded-check bg-alt", className)}
      {...props}
    />
  );
}
