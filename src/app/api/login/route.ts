import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  const supabase = getSupabase();
  const supabaseAdmin = getSupabaseAdmin();

  try {
    const body = await req.json();
    const { email, password } = body as { email: string; password: string };

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data?.user) {
      return NextResponse.json({ error: error?.message || 'Invalid credentials' }, { status: 401 });
    }

    const sUser = data.user;

  // Determine role using admin_users table first; then metadata; then local fallback
  let role: 'admin' | 'sales' = 'sales';
  let name: string = (sUser.user_metadata as any)?.name || sUser.email || 'User';

  try {
    const { data: adminRows, error: adminErr } = await supabaseAdmin
      .from('admin_users')
      .select('id')
      .eq('email', sUser.email!)
      .limit(1);
    if (!adminErr && adminRows && adminRows.length > 0) {
      role = 'admin';
    }
  } catch (_) {
    // ignore admin lookup errors; default remains 'sales'
  }

  if (role === 'sales') {
    try {
      const { data: suRows, error: suErr } = await supabaseAdmin
        .from('sales_users')
        .select('display_name, role')
        .eq('user_id', sUser.id)
        .limit(1);
      if (!suErr && suRows && suRows.length > 0) {
        name = (suRows[0] as any).display_name || name;
        // Normalize any sales-like role to 'sales' for app logic
        const dbRole = (suRows[0] as any).role;
        role = dbRole === 'admin' ? 'admin' : 'sales';
      }
    } catch (_) {
      // ignore
    }
  }

    session.user = { id: sUser.id, name, email: sUser.email!, role };
    await session.save();

    return NextResponse.json({ ok: true, user: session.user });
  } catch (err) {
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}