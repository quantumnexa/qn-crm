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

  try {
    const body = (await req.json()) as { userA: string; userB: string; leadIds?: string[] };
    const { userA, userB, leadIds } = body;

    if (!userA || !userB) {
      return NextResponse.json({ error: 'userA and userB required' }, { status: 400 });
    }
    if (userA === userB) {
      return NextResponse.json({ error: 'Choose two different employees' }, { status: 400 });
    }

    // Validate both users via sales_users table
    const { data: suRows, error: suErr } = await supabaseAdmin
      .from('sales_users')
      .select('user_id, role')
      .in('user_id', [userA, userB]);

    if (suErr) {
      return NextResponse.json({ error: suErr.message }, { status: 500 });
    }
    const validIds = new Set((suRows || []).filter((r: any) => r.role === 'sales' || r.role === 'sales_user').map((r: any) => r.user_id));
    if (!validIds.has(userA) || !validIds.has(userB)) {
      return NextResponse.json({ error: 'Invalid sales employees' }, { status: 400 });
    }

    let targetIds: number[] = [];
    if (Array.isArray(leadIds) && leadIds.length > 0) {
      targetIds = leadIds.map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n));
    } else {
      const { data, error } = await supabaseAdmin
        .from('leads')
        .select('id, assigned_to')
        .is('assigned_to', null);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      targetIds = (data || []).map((r: any) => r.id);
    }

    if (targetIds.length === 0) {
      return NextResponse.json({ error: 'No target leads to assign' }, { status: 400 });
    }

    let assigned = 0;
    let i = 0;
    for (const lid of targetIds) {
      const toUser = i % 2 === 0 ? userA : userB;
      i++;
      const { error: updErr } = await (supabaseAdmin as any)
        .from('leads')
        .update({ assigned_to: toUser, updated_at: new Date().toISOString() })
        .eq('id', lid);
      if (!updErr) {
        assigned++;
      }
    }

    return NextResponse.json({ ok: true, assigned, total: targetIds.length });
  } catch (err) {
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}