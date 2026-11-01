'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Alert, Card } from '@/components/ui/surface';

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
    <Card className="w-full max-w-sm">
      <form onSubmit={submit} className="space-y-4">
        <h1 className="text-xl font-semibold">{step === 'login' ? 'Masuk' : 'Ganti password awal'}</h1>
        {step === 'login' ? (
          <>
            <Field id="identifier" label="Username atau email">
              <Input id="identifier" autoComplete="username" value={identifier}
                onChange={(e) => setIdentifier(e.target.value)} required />
            </Field>
            <Field id="password" label="Password">
              <Input id="password" type="password" autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)} required />
            </Field>
          </>
        ) : (
          <>
            <Alert tone="info">Password awal wajib diganti sebelum membuka HRIS. Perangkat lain akan keluar.</Alert>
            <Field id="new-password" label="Password baru" hint="Minimal 8 karakter.">
              <Input id="new-password" type="password" autoComplete="new-password" minLength={8} value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)} required />
            </Field>
          </>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        <Button type="submit" block loading={busy}>{step === 'login' ? 'Masuk' : 'Simpan dan masuk'}</Button>
        {step === 'login' && <Link href="/lupa-password" className="block text-center text-sm text-brand-700">Lupa password</Link>}
      </form>
    </Card>
  );
}
