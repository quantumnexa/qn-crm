import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { data, error } = await supabaseAdmin
    .from('sales_users')
    .select('user_id,email,display_name,role')
    .in('role', ['sales', 'sales_user']);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const users = (data || [])
    .filter((u: any) => !!u.user_id)
    .map((u: any) => ({
      id: u.user_id as string,
      name: u.display_name as string,
      email: u.email as string,
      role: 'sales',
    }));
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { name, email, password, role } = body as { name: string; email: string; password: string; role: 'sales' };

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
  }

  if (role !== 'sales') {
    return NextResponse.json({ error: 'Only sales users can be created here' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    user_metadata: { name, role: 'sales' },
    email_confirm: true,
  });

  if (error || !data?.user) {
    return NextResponse.json({ error: error?.message || 'User creation failed' }, { status: 400 });
  }

  const { error: insErr } = await supabaseAdmin
    .from('sales_users')
    .insert({
      user_id: data.user.id,
      email,
      display_name: name,
      role: 'sales',
    });

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ user: { id: data.user.id, name, email, role: 'sales' } }, { status: 201 });
}