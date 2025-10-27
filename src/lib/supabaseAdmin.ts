import { createClient } from '@supabase/supabase-js';

let cachedAdmin: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (cachedAdmin) return cachedAdmin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  cachedAdmin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedAdmin;
}