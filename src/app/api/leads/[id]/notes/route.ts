import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

async function authorize(session: SessionData | undefined, leadAssignedTo: string | null | undefined) {
  if (!session || !session.user) return false;
  if (session.user.role === 'admin') return true;
  return !!leadAssignedTo && leadAssignedTo === session.user.id;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  // Robustly derive lead id from params or URL path
  const leadIdParam = (params?.id ?? '').trim();
  const leadIdFromPath = req.nextUrl?.pathname?.split('/')?.[3] ?? '';
  const leadId = decodeURIComponent(leadIdParam || leadIdFromPath || '');
  if (!leadId) {
    return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (error) {
    const status = error.message.includes('Row not found') ? 404 : 500;
    return NextResponse.json({ error: status === 404 ? 'Not found' : error.message }, { status });
  }

  const ok = await authorize(session, data.assigned_to || null);
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const ts = data.updated_at || data.created_at || new Date().toISOString();
  const notes = [] as any[];
  for (let i = 1; i <= 10; i++) {
    const key = `follow_up_${i}` as keyof typeof data;
    const content = (data as any)[key];
    if (content && String(content).trim().length > 0) {
      notes.push({ id: `f${i}`, userId: data.assigned_to || '', content: String(content), createdAt: ts });
    }
  }

  return NextResponse.json({ notes });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  // Robustly derive lead id from params or URL path
  const leadIdParam = (params?.id ?? '').trim();
  const leadIdFromPath = req.nextUrl?.pathname?.split('/')?.[3] ?? '';
  const leadId = decodeURIComponent(leadIdParam || leadIdFromPath || '');
  if (!leadId) {
    return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 });
  }

  const { data: existing, error: selErr } = await supabaseAdmin
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();
  if (selErr) {
    const status = selErr.message.includes('Row not found') ? 404 : 500;
    return NextResponse.json({ error: status === 404 ? 'Not found' : selErr.message }, { status });
  }

  const ok = await authorize(session, existing.assigned_to || null);
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { content } = body as { content: string };
  if (!content || !content.trim()) {
    return NextResponse.json({ error: 'Content required' }, { status: 400 });
  }

  let targetIndex: number | null = null;
  for (let i = 1; i <= 10; i++) {
    const key = `follow_up_${i}` as keyof typeof existing;
    const val = (existing as any)[key];
    if (!val || String(val).trim().length === 0) {
      targetIndex = i;
      break;
    }
  }

  if (!targetIndex) {
    return NextResponse.json({ error: 'All follow-up slots are filled' }, { status: 400 });
  }

  const col = `follow_up_${targetIndex}`;
  const now = new Date().toISOString();
  const updatePayload: Record<string, any> = { [col]: content.trim(), updated_at: now };

  const { error: updErr } = await supabaseAdmin
    .from('leads')
    .update(updatePayload)
    .eq('id', leadId);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  const note = { id: `f${targetIndex}`, userId: session.user!.id, content: content.trim(), createdAt: now };
  return NextResponse.json({ note });
}