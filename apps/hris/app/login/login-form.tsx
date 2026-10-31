'use client';

import { useEffect, useState } from 'react';

type Step = 'login' | 'change-password';

async function csrfToken(): Promise<string> {
  const res = await fetch('/api/auth/csrf', { cache: 'no-store' });
  return (await res.json()).token as string;
}

async function post(path: string, body: unknown) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': await csrfToken() },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data } as { ok: boolean; data: { error?: string; mustChangePassword?: boolean } };
}

export function LoginForm() {
  const [step, setStep] = useState<Step>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Mengeluarkan nonce CSRF pra-login lebih awal agar kirim pertama tidak gagal.
  useEffect(() => { void csrfToken(); }, []);

  async function submit(event: React.SyntheticEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (step === 'login') {
        const { ok, data } = await post('/api/auth/login', { identifier, password });
        if (!ok) return setError(data.error ?? 'Login tidak berhasil.');
        if (data.mustChangePassword) return setStep('change-password');
      } else {
        const { ok, data } = await post('/api/auth/change-password', { currentPassword: password, newPassword });
        if (!ok) return setError(data.error ?? 'Password gagal diganti.');
      }
      window.location.assign('/');
    } catch {
      setError('Terjadi kesalahan jaringan, silakan coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border p-6">
      <h1 className="text-xl font-semibold">
        {step === 'login' ? 'Masuk HRIS' : 'Ganti password awal'}
      </h1>
      {step === 'login' ? (
        <>
          <input className="w-full rounded border p-2" placeholder="Username atau email" autoComplete="username"
            value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
          <input className="w-full rounded border p-2" type="password" placeholder="Password" autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)} required />
        </>
      ) : (
        <>
          <p className="text-sm text-gray-600">Password awal wajib diganti sebelum membuka HRIS. Perangkat lain akan keluar.</p>
          <input className="w-full rounded border p-2" type="password" placeholder="Password baru (minimal 8 karakter)"
            autoComplete="new-password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
        </>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy} className="w-full rounded bg-black p-2 text-white disabled:opacity-50">
        {busy ? 'Memproses…' : step === 'login' ? 'Masuk' : 'Simpan dan masuk'}
      </button>
    </form>
  );
}
