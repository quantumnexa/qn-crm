import { createClient } from '@supabase/supabase-js';

let cachedClient: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }
  cachedClient = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedClient;
}