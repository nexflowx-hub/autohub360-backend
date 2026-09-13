import { createClient } from '@supabase/supabase-js';
import { env } from './config.js';

export function supabaseConfigured() {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function supabaseStatus() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { status: 'NOT_CONFIGURED' } as const;
  }

  try {
    const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await client.from('products').select('id').limit(1);
    if (error) return { status: 'ERROR', error: error.message } as const;
    return { status: 'OK' } as const;
  } catch (error) {
    return { status: 'ERROR', error: error instanceof Error ? error.message : 'Supabase check failed' } as const;
  }
}
