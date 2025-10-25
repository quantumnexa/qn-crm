"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/me');
        if (!res.ok) {
          setIsAdmin(false);
          return;
        }
        const data = await res.json();
        setIsAdmin(data.user?.role === 'admin');
      } catch {
        setIsAdmin(false);
      }
    })();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (password !== confirm) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      setSuccess('Account created successfully.');
      setTimeout(() => router.push('/dashboard'), 1200);
    } catch (err: any) {
      setError(err.message || 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  if (isAdmin === null) {
    return <div className="card" style={{ maxWidth: 520, margin: '40px auto' }}><p className="muted">Checking access…</p></div>;
  }

  if (!isAdmin) {
    return (
      <div className="card" style={{ maxWidth: 520, margin: '40px auto' }}>
        <div className="title">Access Denied</div>
        <p className="muted">Only admins can create accounts.</p>
        <div style={{ marginTop: 12 }}>
          <a className="muted" href="/">Go to login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 520, margin: '40px auto' }}>
      <div className="title">Create Account</div>
      <p className="muted" style={{ marginBottom: 12 }}>New users will be created with the Sales role.</p>
      {error && <p style={{ color: '#fca5a5', marginBottom: 10 }}>{error}</p>}
      {success && <p style={{ color: '#34d399', marginBottom: 10 }}>{success}</p>}
      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 10 }}>
          <label className="muted" htmlFor="name">Full Name</label>
          <input id="name" className="input" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label className="muted" htmlFor="email">Email</label>
          <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label className="muted" htmlFor="password">Password</label>
          <input id="password" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label className="muted" htmlFor="confirm">Confirm Password</label>
          <input id="confirm" className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Creating…' : 'Register'}
        </button>
        <div style={{ marginTop: 12 }}>
          <a className="muted" href="/dashboard">Back to dashboard</a>
        </div>
      </form>
    </div>
  );
}