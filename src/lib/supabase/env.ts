/**
 * Supabase environment validation (PRD §8.4).
 * Fails fast with a human-readable setup error when either variable is missing.
 */

export interface SupabaseEnv {
  url: string;
  publishableKey: string;
}

export class MissingEnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissingEnvError';
  }
}

function formatMissing(missing: string[]): string {
  const lines = missing.map((name) => `  - ${name}`);
  return [
    'Supabase is not configured for this build.',
    'The following environment variables are missing:',
    ...lines,
    '',
    'Create a .env file in the project root with:',
    '  VITE_SUPABASE_URL=https://<project-ref>.supabase.co',
    '  VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...',
    '',
    'Never place a service_role key in a VITE_* variable.',
  ].join('\n');
}

export function readSupabaseEnv(
  source: Record<string, string | undefined> = import.meta.env
): SupabaseEnv {
  const url = source.VITE_SUPABASE_URL?.trim();
  const publishableKey = source.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  const missing: string[] = [];
  if (!url) missing.push('VITE_SUPABASE_URL');
  if (!publishableKey) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  if (missing.length > 0) {
    throw new MissingEnvError(formatMissing(missing));
  }

  return { url: url as string, publishableKey: publishableKey as string };
}
