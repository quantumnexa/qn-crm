import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('leads')
    .select('*');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let rows = data || [];
  if (session.user.role !== 'admin') {
    rows = rows.filter((r: any) => r.assigned_to === session.user!.id);
  }

  const leads = rows.map((r: any) => {
    const notesArr: any[] = [];
    const ts = (r as any).updated_at || (r as any).created_at || new Date().toISOString();
    for (let i = 1; i <= 10; i++) {
      const v = (r as any)[`follow_up_${i}`];
      if (v && String(v).trim().length > 0) {
        notesArr.push({ id: `f${i}`, content: String(v), createdAt: ts });
      }
    }
    return {
      id: String(r.id),
      name: r.full_name || '',
      email: r.email || '',
      phone: r.phone || '',
      company: r.company || '',
      platform: r.platform || '',
      preferredTime: r.preferred_call_time || '',
      startTimeline: r.start_timeline || '',
      hasWebsite: typeof r.has_website === 'boolean' ? r.has_website : undefined,
      businessDetails: r.business_details || '',
      assignedTo: r.assigned_to || null,
      closedAmount: typeof (r as any).closed_amount === 'number' ? (r as any).closed_amount : undefined,
      closedMonth: (r as any).closed_month || undefined,
      notes: notesArr,
    };
  });

  return NextResponse.json({ leads });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'CSV/Excel file required in form field "file"' }, { status: 400 });
  }

  let records: any[] = [];
  const filename = (file.name || '').toLowerCase();

  try {
    if (filename.endsWith('.csv')) {
      const text = await file.text();
      records = parse(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      const ab = await file.arrayBuffer();
      const buf = Buffer.from(ab);
      const wb = XLSX.read(buf, { type: 'buffer' });
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      records = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
    } else {
      // Fallback: try CSV parsing
      const text = await file.text();
      records = parse(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    }
  } catch (err) {
    return NextResponse.json({ error: 'Failed to parse file (CSV/Excel)' }, { status: 400 });
  }

  // Fetch existing emails from DB for deduplication
  const { data: existingRows, error: exErr } = await supabaseAdmin
    .from('leads')
    .select('email');
  if (exErr) {
    return NextResponse.json({ error: exErr.message }, { status: 500 });
  }
  const emailSet = new Set((existingRows || []).map((r: any) => (r.email || '').toLowerCase()));

  const insertRows: any[] = [];
  for (const r of records) {
    const name = r.name || r.Name || r.fullName || '';
    const email = (r.email || r.Email || '').toLowerCase();
    const phone = r.phone || r.Phone || '';
    // Optional extended fields
    const platform = r.platform || r.Platform || '';
    const preferredTime = r.preferredTime || r.PreferredTime || r['Preferred Time'] || r['Please choose prefered time to call you by our agent!'] || r['Please choose preferred time to call you by our agent!'] || '';
    const startTimeline = r.startTimeline || r.StartTimeline || r['Start Timeline'] || r['how soon you are looking to start'] || r['How soon you are looking to start'] || '';
    const hasWebsiteRaw = r.hasWebsite || r.HasWebsite || r['Has Website'] || r['Do you have website?'] || r['Do you have a website?'] || '';
    let hasWebsiteBool: boolean | null = null;
    if (typeof hasWebsiteRaw === 'string') {
      const v = hasWebsiteRaw.toLowerCase().trim();
      if (['yes', 'y', 'true'].includes(v)) hasWebsiteBool = true;
      else if (['no', 'n', 'false'].includes(v)) hasWebsiteBool = false;
      else hasWebsiteBool = null;
    } else if (typeof hasWebsiteRaw === 'boolean') {
      hasWebsiteBool = hasWebsiteRaw;
    }
    const businessDetails = r.businessDetails || r.BusinessDetails || r['Business Details'] || r['please share your business details!'] || r['Please share your business details!'] || '';

    if (!email) continue;
    if (emailSet.has(email)) continue; // dedup by email
    emailSet.add(email);

    insertRows.push({
      full_name: name,
      email,
      phone,
      platform,
      preferred_call_time: preferredTime,
      start_timeline: startTimeline,
      has_website: hasWebsiteBool,
      business_details: businessDetails,
      assigned_to: null,
    });
  }

  if (insertRows.length === 0) {
    return NextResponse.json({ added: 0, total: (existingRows || []).length });
  }

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('leads')
    .insert(insertRows)
    .select('id');

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ added: (inserted || []).length });
}