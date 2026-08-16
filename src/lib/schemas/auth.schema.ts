import { z } from "zod";

const email = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .max(254, "That email is too long.")
  .email("That email doesn't look right.");

/**
 * Supabase enforces a minimum password length server-side (6 by default,
 * configurable in the dashboard). Asking for 8 here keeps the client-side
 * message honest for the common configuration without pretending to be the
 * authority — the server is still the one that decides.
 */
const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Passwords can be at most 72 characters.");

export const signUpSchema = z.object({ email, password });
export const signInSchema = z.object({
  email,
  // Not re-validating length on sign-in: an existing account may predate a
  // policy change, and "use at least 8 characters" is a confusing thing to be
  // told when logging in.
  password: z.string().min(1, "Enter your password."),
});

export const createOrgSchema = z.object({
  name: z.string().trim().min(2, "Give your business a name.").max(120, "That name is too long."),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type CreateOrgInput = z.infer<typeof createOrgSchema>;
