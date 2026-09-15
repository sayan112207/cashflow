import { AlertTriangle } from "lucide-react";

import type { ContactPip, ContactTier } from "@/lib/schemas/accounts";
import { cn } from "@/lib/utils";

const TIERS: readonly ContactTier[] = ["P0", "P1", "P2"];

const PIP_KEY: Record<ContactTier, "p0" | "p1" | "p2"> = {
  P0: "p0",
  P1: "p1",
  P2: "p2",
};

function accessibleName(tier: ContactTier, state: ContactPip): string {
  switch (state) {
    case "present":
      return `${tier} contact present`;
    case "missing":
      return `No ${tier} contact`;
    case "bounced":
      return `${tier} contact email bouncing`;
    case "dnc":
      return `${tier} contact set to do-not-contact`;
  }
}

type ContactPipsProps = {
  contacts: {
    p0: ContactPip;
    p1: ContactPip;
    p2: ContactPip;
  };
};

/**
 * Three contact-ladder pips. Colour is never the only signal — every pip has
 * an accessible name for its state, and missing P0 / bounced / dnc also carry
 * a visible mark. Missing P1/P2 are hollow (border only), per spec §1.
 */
export function ContactPips({ contacts }: ContactPipsProps) {
  return (
    <ul className="flex items-center gap-1" aria-label="Contact ladder">
      {TIERS.map((tier) => {
        const state = contacts[PIP_KEY[tier]];
        return (
          <li key={tier} className="flex">
            <Pip tier={tier} state={state} />
          </li>
        );
      })}
    </ul>
  );
}

function Pip({ tier, state }: { tier: ContactTier; state: ContactPip }) {
  const name = accessibleName(tier, state);
  const box = "inline-flex size-3.5 shrink-0 items-center justify-center rounded-check";

  if (state === "missing") {
    // Only a missing P0 is the danger ✕ — P1/P2 absence is a hollow pip.
    if (tier === "P0") {
      return (
        <span
          role="img"
          aria-label={name}
          title={name}
          className={cn(box, "bg-danger text-pill font-semibold text-white")}
        >
          <span aria-hidden="true">✕</span>
        </span>
      );
    }
    return (
      <span
        role="img"
        aria-label={name}
        title={name}
        className={cn(box, "border border-stroke bg-transparent")}
      />
    );
  }

  if (state === "bounced") {
    return (
      <span role="img" aria-label={name} title={name} className={cn(box, "bg-danger")}>
        <AlertTriangle aria-hidden="true" className="size-2.5 text-white" strokeWidth={2.5} />
      </span>
    );
  }

  if (state === "dnc") {
    return (
      <span
        role="img"
        aria-label={name}
        title={name}
        className={cn(box, "border border-stroke bg-alt text-pill font-semibold text-fg-muted")}
      >
        <span aria-hidden="true">✕</span>
      </span>
    );
  }

  return <span role="img" aria-label={name} title={name} className={cn(box, "bg-fg")} />;
}
