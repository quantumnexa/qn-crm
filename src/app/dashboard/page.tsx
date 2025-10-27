"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';

type User = { id: string; name: string; email: string; role: 'admin' | 'sales' };

type Lead = {
  platform: string;
  preferredTime: string;
  startTimeline: string;
  hasWebsite: any;
  businessDetails: string; id: string; name: string; email: string; phone?: string; company?: string; assignedTo?: string | null; notes: any[]; closedAmount?: number; closedMonth?: string;
};

export default function DashboardPage() {
  const [me, setMe] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leadQuery, setLeadQuery] = useState('');
  const [leadAssignedFilter, setLeadAssignedFilter] = useState<'all' | 'assigned' | 'unassigned' | 'by_user'>('all');
  const [filterUserId, setFilterUserId] = useState('');
  const [bulkUserA, setBulkUserA] = useState('');
  const [bulkUserB, setBulkUserB] = useState('');

  // Keep Employee A and B distinct: when A picks B’s current user, clear B, and vice versa
  useEffect(() => {
    if (bulkUserA && bulkUserA === bulkUserB) {
      setBulkUserB('');
    }
  }, [bulkUserA]);
  useEffect(() => {
    if (bulkUserB && bulkUserA === bulkUserB) {
      setBulkUserA('');
    }
  }, [bulkUserB]);
  // Upload preview state
  const [uploadPreviewRows, setUploadPreviewRows] = useState<any[]>([]);
  const [uploadPreviewCols, setUploadPreviewCols] = useState<string[]>([]);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadParsing, setUploadParsing] = useState(false);
  const [uploadParseError, setUploadParseError] = useState<string | null>(null);
  const [followInputs, setFollowInputs] = useState<Record<string, string>>({});
  const [closedInputs, setClosedInputs] = useState<Record<string, string>>({});

  // Helper: safely parse JSON responses, falling back to text
  async function safeJson(res: Response): Promise<any> {
    try {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        return await res.json();
      }
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        return { error: text };
      }
    } catch {
      return {};
    }
  }

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setUploadPreviewRows([]);
      setUploadPreviewCols([]);
      setUploadFileName('');
      setUploadParseError(null);
      return;
    }
    setUploadParsing(true);
    setUploadParseError(null);
    setUploadFileName(file.name);
    try {
      let records: any[] = [];
      const filename = (file.name || '').toLowerCase();
      if (filename.endsWith('.csv')) {
        const text = await file.text();
        const wb = XLSX.read(text, { type: 'string' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        records = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
        const ab = await file.arrayBuffer();
        const wb = XLSX.read(ab, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        records = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      } else {
        // Fallback: try treating as CSV
        const text = await file.text();
        const wb = XLSX.read(text, { type: 'string' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        records = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      }
      const cols = Array.from(new Set(records.flatMap((r: any) => Object.keys(r))));
      setUploadPreviewRows(records);
      setUploadPreviewCols(cols);
    } catch (err: any) {
      setUploadParseError(err?.message || 'Failed to parse file');
      setUploadPreviewRows([]);
      setUploadPreviewCols([]);
    } finally {
      setUploadParsing(false);
    }
  };

  // Replace direct res.json() calls with safeJson
  // Initial load
  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch('/api/me');
        if (!meRes.ok) throw new Error('Not authenticated');
        const meData = await safeJson(meRes);
        setMe(meData.user);
        const leadsRes = await fetch('/api/leads');
        const leadsData = await safeJson(leadsRes);
        setLeads(leadsData.leads || []);
        if (meData.user.role === 'admin') {
          const usersRes = await fetch('/api/users');
          const usersData = await safeJson(usersRes);
          setUsers(usersData.users || []);
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  
  // Refresh leads
  const refreshLeads = async () => {
    const leadsRes = await fetch('/api/leads');
    const leadsData = await safeJson(leadsRes);
    setLeads(leadsData.leads || []);
  };
  
  // Assignment and upload handlers
  const onUploadCSV = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = (e.currentTarget.elements.namedItem('file') as HTMLInputElement) || null;
    if (!input || !input.files || input.files.length === 0) return;
    const fd = new FormData();
    fd.append('file', input.files[0]);
    const res = await fetch('/api/leads', { method: 'POST', body: fd });
    const data = await safeJson(res);
    if (!res.ok) {
      alert((data && data.error) || 'Upload failed');
      return;
    }
    await refreshLeads();
    alert(`Uploaded ${data.added} new leads`);
    setUploadPreviewRows([]);
    setUploadPreviewCols([]);
    setUploadFileName('');
    setUploadParseError(null);
    (e.currentTarget.reset && e.currentTarget.reset());
  };
  
  const onAssign = async (leadId: string, userId: string) => {
    const res = await fetch('/api/leads/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, userId }),
    });
    const data = await safeJson(res);
    if (!res.ok) {
      alert((data && data.error) || 'Assignment failed');
      return;
    }
    await refreshLeads();
  };
  
  const onBulkAssign = async () => {
    if (!bulkUserA || !bulkUserB) {
      alert('Select Employee A and Employee B');
      return;
    }
    if (bulkUserA === bulkUserB) {
      alert('Choose two different employees');
      return;
    }
    const targetIds = filteredLeads.filter((l) => !l.assignedTo).map((l) => l.id);
    if (targetIds.length === 0) {
      alert('No unassigned leads in current view');
      return;
    }
    const res = await fetch('/api/leads/assign/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userA: bulkUserA, userB: bulkUserB, leadIds: targetIds }),
    });
    const data = await safeJson(res);
    if (!res.ok) {
      alert((data && data.error) || 'Bulk assign failed');
      return;
    }
    await refreshLeads();
    alert(`Assigned ${data.assigned} leads alternately`);
  };

  const onAddFollowQuick = async (leadId: string, content: string) => {
    const id = (leadId ?? '').trim();
    if (!id) { alert('Lead id missing'); return; }
    const res = await fetch(`/api/leads/${encodeURIComponent(id)}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    const data = await safeJson(res);
    if (!res.ok) { alert((data && data.error) || 'Failed'); return; }
    setFollowInputs((prev) => ({ ...prev, [id]: '' }));
    await refreshLeads();
  };
  
  const onUpdateClosedAmount = async (leadId: string) => {
    const id = (leadId ?? '').trim();
    const val = (closedInputs[id] || '').trim();
    const amt = Number(val);
    if (!id) { alert('Lead id missing'); return; }
    if (!Number.isFinite(amt) || amt < 0) { alert('Invalid amount'); return; }
    const res = await fetch(`/api/leads/${encodeURIComponent(id)}/closed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amt, closedMonth: currentMonthIsoStart() }),
    });
    const data = await safeJson(res);
    if (!res.ok) { alert((data && data.error) || 'Failed'); return; }
    setClosedInputs((prev) => ({ ...prev, [id]: '' }));
    await refreshLeads();
  };
  
  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <p style={{ color: '#fca5a5' }}>Error: {error}</p>;
  if (!me) return <p>Please sign in.</p>;

  const salesUsers = users.filter((u) => u.role === 'sales');
  const filteredLeads = leads.filter((l) => {
    const q = leadQuery.toLowerCase().trim();
    const matchesQuery = q
      ? ((l.name || '').toLowerCase().includes(q) ||
         (l.email || '').toLowerCase().includes(q) ||
         (l.company || '').toLowerCase().includes(q) ||
         (l.phone || '').toLowerCase().includes(q))
      : true;
    let matchesAssign = true;
    if (leadAssignedFilter === 'assigned') matchesAssign = !!l.assignedTo;
    else if (leadAssignedFilter === 'unassigned') matchesAssign = !l.assignedTo;
    else if (leadAssignedFilter === 'by_user') matchesAssign = !!filterUserId && l.assignedTo === filterUserId;
    return matchesQuery && matchesAssign;
  });
  const totalLeadsCount = leads.length;
  const assignedCount = leads.filter((l) => !!l.assignedTo).length;
  const unassignedCount = totalLeadsCount - assignedCount;
  const countsByUser: Record<string, number> = salesUsers.reduce((acc, u) => {
    acc[u.id] = leads.filter((l) => l.assignedTo === u.id).length;
    return acc;
  }, {} as Record<string, number>);
  const unassignedFilteredCount = filteredLeads.filter((l) => !l.assignedTo).length;
  const expectedA = bulkUserA && bulkUserB ? Math.ceil(unassignedFilteredCount / 2) : 0;
  const expectedB = bulkUserA && bulkUserB ? Math.floor(unassignedFilteredCount / 2) : 0;
  const maxNotesCount = Math.max(0, ...leads.map((l) => (Array.isArray(l.notes) ? l.notes.length : 0)));

  return (
    <div className="grid">
      {me.role === 'admin' ? (
        <>
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="title">Admin Dashboard</div>
            <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <div className="muted">Total: {totalLeadsCount}</div>
              <div className="muted">Assigned: {assignedCount}</div>
              <div className="muted">Unassigned: {unassignedCount}</div>
            </div>
            <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
              <input
                className="input"
                placeholder="Search by name, email, company, phone"
                value={leadQuery}
                onChange={(e) => setLeadQuery(e.target.value)}
                style={{ minWidth: 280 }}
              />
              <select
                className="input"
                value={leadAssignedFilter}
                onChange={(e) => setLeadAssignedFilter(e.target.value as any)}
              >
                <option value="all">All</option>
                <option value="assigned">Assigned</option>
                <option value="unassigned">Unassigned</option>
                <option value="by_user">By Employee</option>
              </select>
              {leadAssignedFilter === 'by_user' && (
                <select
                  className="input"
                  value={filterUserId}
                  onChange={(e) => setFilterUserId(e.target.value)}
                >
                  <option value="">— Select Employee —</option>
                  {salesUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({countsByUser[u.id] || 0})</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="title">Bulk Assign (Unassigned in Current View)</div>
            <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
              <select className="input" value={bulkUserA} onChange={(e) => setBulkUserA(e.target.value)}>
                <option value="">Employee A</option>
                {salesUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <select className="input" value={bulkUserB} onChange={(e) => setBulkUserB(e.target.value)}>
                <option value="">Employee B</option>
                {salesUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <button className="btn" onClick={onBulkAssign}>Assign Alternately</button>
            </div>
            <p className="muted">Unassigned in view: {unassignedFilteredCount} · Expected A: {expectedA}, B: {expectedB}</p>
          </div>

          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="title">Upload Leads (CSV/Excel)</div>
            <form onSubmit={onUploadCSV} className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <input name="file" type="file" accept=".csv,.xlsx,.xls" onChange={onFileSelected} />
              <button className="btn btn-primary" type="submit" disabled={uploadParsing}>Upload</button>
              {uploadFileName && <span className="muted">{uploadFileName}</span>}
              {uploadParsing && <span className="muted">Parsing…</span>}
              {uploadParseError && <span style={{ color: '#fca5a5' }}>{uploadParseError}</span>}
            </form>
            {uploadPreviewRows.length > 0 && (
              <div style={{ marginTop: 12, overflowX: 'auto' }}>
                <table className="table" style={{ minWidth: 800 }}>
                  <thead>
                    <tr>
                      {uploadPreviewCols.map((c) => (<th key={c} className="px-4 py-2 text-left">{c}</th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {uploadPreviewRows.slice(0, 10).map((r, i) => (
                      <tr key={`prev-${i}`}>
                        {uploadPreviewCols.map((c) => (<td key={`prev-${i}-${c}`}>{String((r as any)[c] ?? '')}</td>))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="muted">Showing first 10 rows</p>
              </div>
            )}
          </div>

          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="title">Leads</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table leads" style={{ minWidth: 1400, whiteSpace: 'nowrap' }}>
                <thead>
                  <tr>
                    <th>S.no</th>
                    <th className="px-4 py-2 text-left">Email</th>
                    <th className="px-4 py-2 text-left">Phone</th>
                    <th className="px-4 py-2 text-left">Platform</th>
                    <th className="px-4 py-2 text-left">Preferred Time</th>
                    <th className="px-4 py-2 text-left">Start Timeline</th>
                    <th className="px-4 py-2 text-left">Website</th>
                    <th className="px-4 py-2 text-left">Business Details</th>
                    <th className="px-4 py-2 text-left">Assign To</th>
                    <th className="px-4 py-2 text-left">Closed Amount</th>
                    <th className="px-4 py-2 text-left">Commission (10%)</th>
                    <th className="px-4 py-2 text-left">Recurring (3%)</th>
                    {Array.from({ length: maxNotesCount }).map((_, i) => (
                      <th key={`follow-h-admin-${i}`} className="px-4 py-2 text-left">{`Follow Up ${i + 1}`}</th>
                    ))}
                    <th className="px-4 py-2 text-left">Add Follow Up</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((l, idx) => (
                    <tr key={l.id}>
                      <td>{idx + 1}</td>
                      <td>
                        <Link href={`/leads/${encodeURIComponent(l.id)}`}>{l.email}</Link>
                      </td>
                      <td>{l.phone || '—'}</td>
                      <td>{l.platform || '—'}</td>
                      <td>{l.preferredTime || '—'}</td>
                      <td>{l.startTimeline || '—'}</td>
                      <td>{
                        typeof l.hasWebsite === 'boolean'
                          ? (l.hasWebsite ? 'Yes' : 'No')
                          : (typeof l.hasWebsite === 'string'
                              ? ((['yes','y','true'].includes(l.hasWebsite.toLowerCase().trim())) ? 'Yes' : ((['no','n','false'].includes(l.hasWebsite.toLowerCase().trim())) ? 'No' : l.hasWebsite))
                              : '—')
                      }</td>
                      <td>{l.businessDetails || '—'}</td>
                      <td>
                        <select
                          className="input"
                          style={{ minWidth: 160 }}
                          value={l.assignedTo ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) return;
                            onAssign(l.id, val);
                          }}
                        >
                          <option value="">— Select —</option>
                          {salesUsers.map((u) => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <form onSubmit={(e) => { e.preventDefault(); onUpdateClosedAmount(l.id); }}>
                          <input
                            className="input"
                            type="number"
                            step="0.01"
                            placeholder="Closed amount"
                            value={closedInputs[l.id] ?? (typeof l.closedAmount === 'number' ? String(l.closedAmount) : '')}
                            onChange={(e) => setClosedInputs((prev) => ({ ...prev, [l.id]: e.target.value }))}
                          />
                        </form>
                      </td>
                      <td>{typeof l.closedAmount === 'number' ? (l.closedAmount * 0.10).toFixed(2) : '—'}</td>
                      <td>{typeof l.closedAmount === 'number' ? (isRecurringEligible(l.closedMonth) ? (l.closedAmount * 0.03).toFixed(2) : '—') : '—'}</td>
                      {Array.from({ length: maxNotesCount }).map((_, i) => (
                        <td key={`fu-admin-${l.id}-${i}`}>{(l.notes?.[i]?.content) || '—'}</td>
                      ))}
                      <td>
                        <form onSubmit={(e) => { e.preventDefault(); const val = (followInputs[l.id] || '').trim(); if (!val) return; onAddFollowQuick(l.id, val); }}>
                          <input
                            className="input"
                            placeholder={`Follow up ${(l.notes?.length || 0) + 1}`}
                            value={followInputs[l.id] || ''}
                            onChange={(e) => setFollowInputs((prev) => ({ ...prev, [l.id]: e.target.value }))}
                          />
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
           <div className="card" style={{ gridColumn: '1 / -1' }}>
             <div className="title">My Leads</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table leads" style={{ minWidth: 1300, whiteSpace: 'nowrap' }}>
              <thead>
                <tr>
                  <th>S.no</th>
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-left">Phone</th>
                  <th className="px-4 py-2 text-left">Platform</th>
                  <th className="px-4 py-2 text-left">Please choose prefered time to call you by our agent!</th>
                  <th className="px-4 py-2 text-left">how soon you are looking to start</th>
                  <th className="px-4 py-2 text-left">Do you have website?</th>
                  <th className="px-4 py-2 text-left">please share your business details!</th>
                  <th className="px-4 py-2 text-left">Closed Amount</th>
                  <th className="px-4 py-2 text-left">My Commission (10%)</th>
                  <th className="px-4 py-2 text-left">Recurring Commission (3%)</th>
                  {Array.from({ length: maxNotesCount }).map((_, i) => (
                    <th key={`follow-h-${i}`} className="px-4 py-2 text-left">{`Follow Up ${i + 1}`}</th>
                  ))}
                  <th className="px-4 py-2 text-left">Add Follow Up</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l, idx) => (
                  <tr key={l.id}>
                    <td>{idx + 1}</td>
                    <td>{l.email}</td>
                    <td>{l.phone || '—'}</td>
                    <td>{l.platform || '—'}</td>
                    <td>{l.preferredTime || '—'}</td>
                    <td>{l.startTimeline || '—'}</td>
                    <td>{
                      typeof l.hasWebsite === 'boolean'
                        ? (l.hasWebsite ? 'Yes' : 'No')
                        : (typeof l.hasWebsite === 'string'
                            ? ((['yes','y','true'].includes(l.hasWebsite.toLowerCase().trim())) ? 'Yes' : ((['no','n','false'].includes(l.hasWebsite.toLowerCase().trim())) ? 'No' : l.hasWebsite))
                            : '—')
                    }</td>
                    <td>{l.businessDetails || '—'}</td>
                    <td>
                      <form onSubmit={(e) => { e.preventDefault(); onUpdateClosedAmount(l.id); }}>
                        <input
                          className="input"
                          type="number"
                          step="0.01"
                          placeholder="Closed amount"
                          value={closedInputs[l.id] ?? (typeof l.closedAmount === 'number' ? String(l.closedAmount) : '')}
                          onChange={(e) => setClosedInputs((prev) => ({ ...prev, [l.id]: e.target.value }))}
                        />
                      </form>
                    </td>
                    <td>{typeof l.closedAmount === 'number' ? (l.closedAmount * 0.10).toFixed(2) : '—'}</td>
                    <td>{typeof l.closedAmount === 'number' ? (isRecurringEligible(l.closedMonth) ? (l.closedAmount * 0.03).toFixed(2) : '—') : '—'}</td>
                    {Array.from({ length: maxNotesCount }).map((_, i) => (
                      <td key={`fu-${l.id}-${i}`}>{(l.notes?.[i]?.content) || '—'}</td>
                    ))}
                    <td>
                      <form onSubmit={(e) => { e.preventDefault(); const val = (followInputs[l.id] || '').trim(); if (!val) return; onAddFollowQuick(l.id, val); }}>
                        <input
                          className="input"
                          placeholder={`Follow up ${(l.notes?.length || 0) + 1}`}
                          value={followInputs[l.id] || ''}
                          onChange={(e) => setFollowInputs((prev) => ({ ...prev, [l.id]: e.target.value }))}
                        />
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
       )}
     </div>
   );
 }
// Month helpers for recurring eligibility
function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function toMonthKey(s?: string | null): string | null {
  if (!s) return null;
  // Try ISO date parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  // Fallback: assume YYYY-MM
  const m = String(s).slice(0, 7);
  return /^\d{4}-\d{2}$/.test(m) ? m : null;
}
function isRecurringEligible(closedMonth?: string | null): boolean {
  const c = toMonthKey(closedMonth);
  if (!c) return false;
  return c < currentMonthKey();
}
function currentMonthIsoStart(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}