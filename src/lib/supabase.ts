import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL as string | undefined;
const anon = process.env.SUPABASE_ANON_KEY as string | undefined;

if (!url || !anon) {
  console.warn('Supabase env not set: SUPABASE_URL / SUPABASE_ANON_KEY');
}

export const supabase = createClient(url || '', anon || '', {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});