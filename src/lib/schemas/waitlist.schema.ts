import { z } from "zod";

/**
 * Shared between the form and the server function, so the client-side check and
 * the authoritative server-side check can never drift apart.
 */
export const waitlistSignupSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address.")
    .max(254, "That email is too long.")
    .email("That email doesn't look right."),
  /** Which CTA the signup came from. Useful for attribution, never required. */
  source: z.string().trim().max(64).optional(),
});

export type WaitlistSignup = z.infer<typeof waitlistSignupSchema>;
