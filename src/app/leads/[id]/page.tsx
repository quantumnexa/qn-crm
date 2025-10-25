"use client";
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id as string;
  const [lead, setLead] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch(`/api/leads/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setLead(data.lead);
      const nres = await fetch(`/api/leads/${id}/notes`);
      const ndata = await nres.json();
      if (!nres.ok) throw new Error(ndata.error || 'Failed');
      setNotes(ndata.notes || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) load();
  }, [id]);

  const onAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/leads/${id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Failed'); return; }
    setNotes((prev) => [data.note, ...prev]);
    setContent('');
  };

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <p style={{ color: '#fca5a5' }}>Error: {error}</p>;
  if (!lead) return <p>Lead not found</p>;

  return (
    <div className="grid">
      <div className="card">
        <div className="title">Lead Details</div>
        <p><b>Name:</b> {lead.name || '—'}</p>
        <p><b>Email:</b> {lead.email}</p>
        <p><b>Phone:</b> {lead.phone || '—'}</p>
        <p><b>Company:</b> {lead.company || '—'}</p>
        <p><b>Platform:</b> {lead.platform || '—'}</p>
        <p><b>Preferred Time:</b> {lead.preferredTime || '—'}</p>
        <p><b>Start Timeline:</b> {lead.startTimeline || '—'}</p>
        <p><b>Website:</b> {
          typeof lead.hasWebsite === 'boolean'
            ? (lead.hasWebsite ? 'Yes' : 'No')
            : (typeof lead.hasWebsite === 'string'
                ? ((['yes','y','true'].includes(lead.hasWebsite.toLowerCase().trim())) ? 'Yes' : ((['no','n','false'].includes(lead.hasWebsite.toLowerCase().trim())) ? 'No' : lead.hasWebsite))
                : '—')
        }</p>
        <p><b>Business Details:</b> {lead.businessDetails || '—'}</p>
        <p><b>Assigned To:</b> {lead.assignedTo ? lead.assignedTo : 'Unassigned'}</p>
        <div style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => router.push('/dashboard')}>Back to Dashboard</button>
        </div>
      </div>
      <div className="card">
        <div className="title">Notes</div>
        <form onSubmit={onAddNote}>
          <textarea className="textarea" rows={3} placeholder="Add update/comment" value={content} onChange={(e) => setContent(e.target.value)} required />
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-primary" type="submit">Add Note</button>
          </div>
        </form>
        <div style={{ marginTop: 12 }}>
          {notes.length === 0 ? (
            <p className="muted">No notes yet.</p>
          ) : (
            notes.map((n) => (
              <div key={n.id} className="note">
                <div className="timestamp">{new Date(n.createdAt).toLocaleString()}</div>
                <div>{n.content}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}