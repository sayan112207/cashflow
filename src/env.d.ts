/// <reference types="vite/client" />

/**
 * Public environment. The `VITE_` prefix means Vite inlines these into the
 * browser bundle at build time — so everything declared here is public by
 * definition. Secrets are read server-side only, via `@/lib/env.server`.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Optional, and a plain string: `env.public.ts` is what narrows it. */
  readonly VITE_USE_MOCKS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
