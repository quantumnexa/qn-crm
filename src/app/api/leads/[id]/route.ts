import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  if (!session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabaseAdmin = getSupabaseAdmin();

  // Robustly derive lead id from params or URL path
  const { id: paramId } = await context.params;
  const leadIdParam = (paramId ?? '').trim();
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

  if (session.user.role !== 'admin' && (data as any).assigned_to !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const d: any = data as any;
  const lead = {
    id: String(d.id),
    name: d.full_name || '',
    email: d.email || '',
    phone: d.phone || '',
    company: d.company || '',
    platform: d.platform || '',
    preferredTime: d.preferred_call_time || '',
    startTimeline: d.start_timeline || '',
    hasWebsite: typeof d.has_website === 'boolean' ? d.has_website : undefined,
    businessDetails: d.business_details || '',
    assignedTo: d.assigned_to || null,
    notes: [],
  };

  return NextResponse.json({ lead });
}