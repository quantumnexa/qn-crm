import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  const supabaseAdmin = getSupabaseAdmin();

  if (!session.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { leadId, userId } = (await req.json()) as { leadId: string; userId: string };
  if (!leadId || !userId) {
    return NextResponse.json({ error: 'leadId and userId required' }, { status: 400 });
  }

  // Validate target user via sales_users table
  const { data: suRows, error: suErr } = await supabaseAdmin
    .from('sales_users')
    .select('user_id, role')
    .eq('user_id', userId)
    .limit(1);
  if (suErr) {
    return NextResponse.json({ error: suErr.message }, { status: 500 });
  }
  if (!suRows || suRows.length === 0) {
    return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
  }
  const roleVal = (suRows[0] as any).role;
  const isSales = roleVal === 'sales' || roleVal === 'sales_user';
  if (!isSales) {
    return NextResponse.json({ error: 'Target user not sales' }, { status: 404 });
  }

  const leadIdNum = parseInt(leadId, 10);
  if (Number.isNaN(leadIdNum)) {
    return NextResponse.json({ error: 'Invalid leadId' }, { status: 400 });
  }

  // Ensure lead exists
  const { data: existing, error: selErr } = await supabaseAdmin
    .from('leads')
    .select('id')
    .eq('id', leadIdNum)
    .limit(1);
  if (selErr) {
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }
  if (!existing || existing.length === 0) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  const { error: updErr } = await (supabaseAdmin as any)
    .from('leads')
    .update({ assigned_to: userId, updated_at: new Date().toISOString() })
    .eq('id', leadIdNum);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}