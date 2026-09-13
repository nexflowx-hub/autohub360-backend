import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './config.js';

let client: SupabaseClient | null = null;

export function supabaseConfigured() {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export function supabaseService(): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase is not configured');
  }
  if (!client) {
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}

export async function supabaseStatus() {
  if (!supabaseConfigured()) {
    return { status: 'NOT_CONFIGURED' } as const;
  }

  try {
    const { error } = await supabaseService().from('products').select('id').limit(1);
    if (error) return { status: 'ERROR', error: error.message } as const;
    return { status: 'OK' } as const;
  } catch (error) {
    return { status: 'ERROR', error: error instanceof Error ? error.message : 'Supabase check failed' } as const;
  }
}
