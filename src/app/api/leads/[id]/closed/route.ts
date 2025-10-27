import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

async function authorize(session: SessionData | undefined, leadAssignedTo: string | null | undefined) {
  if (!session || !session.user) return false;
  if (session.user.role === 'admin') return true;
  return !!leadAssignedTo && leadAssignedTo === session.user.id;
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  const { id: paramId } = await context.params;
  const leadIdParam = (paramId ?? '').trim();
  const leadIdFromPath = req.nextUrl?.pathname?.split('/')?.[3] ?? '';
  const leadId = decodeURIComponent(leadIdParam || leadIdFromPath || '');
  if (!leadId) {
    return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 });
  }

  const { data: existing, error: selErr } = await supabaseAdmin
    .from('leads')
    .select('id, assigned_to')
    .eq('id', leadId)
    .single();
  if (selErr) {
    const status = selErr.message.includes('Row not found') ? 404 : 500;
    return NextResponse.json({ error: status === 404 ? 'Not found' : selErr.message }, { status });
  }

  const ok = await authorize(session, existing.assigned_to || null);
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { amount, closedMonth } = body as { amount: number; closedMonth?: string };
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt < 0) {
    return NextResponse.json({ error: 'Amount must be a non-negative number' }, { status: 400 });
  }

  const now = new Date();
  const monthIso = closedMonth && String(closedMonth).trim()
    ? String(closedMonth)
    : new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { error: updErr } = await supabaseAdmin
    .from('leads')
    .update({ closed_amount: amt, closed_month: monthIso, updated_at: new Date().toISOString() })
    .eq('id', leadId);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, closedAmount: amt, closedMonth: monthIso });
}