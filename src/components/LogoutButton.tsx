"use client";
import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();
  const onLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      router.push('/');
    } catch (e) {}
  };
  return (
    <button className="btn" onClick={onLogout} title="Logout">Logout</button>
  );
}