import { useState, type FormEvent } from "react";
import { EARLY_ACCESS_INPUT_ID } from "./cta";
import { waitlistSignupSchema } from "@/lib/schemas/waitlist.schema";
import { joinWaitlist } from "@/lib/services/waitlist.service";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;

    const parsed = waitlistSignupSchema.safeParse({ email, source: "landing-hero" });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "That email doesn't look right.");
      return;
    }

    setError(null);
    setPending(true);
    try {
      const result = await joinWaitlist({ data: parsed.data });
      if (result.ok) {
        setDone(true);
      } else {
        // Keep what they typed so a retry costs one click, not one retype.
        setError(result.message);
      }
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <p
        role="status"
        className="mx-auto mt-8 w-fit rounded-[10px] border border-slate-line bg-slate-raised px-[18px] py-3.5 text-sm text-on-slate"
      >
        You're on the list. We'll email you when Tagada opens up.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8">
      <div className="flex justify-center gap-2.5 max-[520px]:flex-col max-[520px]:items-stretch">
        <label htmlFor={EARLY_ACCESS_INPUT_ID} className="sr-only">
          Email address
        </label>
        <input
          id={EARLY_ACCESS_INPUT_ID}
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
          aria-invalid={!!error}
          aria-describedby={error ? "waitlist-error" : undefined}
          className="w-[260px] rounded-[10px] border border-slate-input bg-slate-raised px-[18px] py-3.5 text-sm text-on-slate placeholder:text-on-slate-dim focus-visible:border-brand focus-visible:outline-none disabled:opacity-60 max-[520px]:w-full"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-[10px] bg-brand px-6 py-3.5 text-sm font-semibold text-white transition-transform duration-150 hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
        >
          {pending ? "Adding you…" : "Get early access"}
        </button>
      </div>
      {error && (
        <p id="waitlist-error" role="alert" className="mt-3 text-sm text-on-slate-muted">
          {error}
        </p>
      )}
    </form>
  );
}
