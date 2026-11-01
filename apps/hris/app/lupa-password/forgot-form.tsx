'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Alert, Card } from '@/components/ui/surface';

type Reply = { error?: string; ticket?: string; blockedUntil?: string; useCode?: boolean };

async function post(path: string, body: unknown): Promise<{ ok: boolean; data: Reply }> {
  try {
    const csrf = await (await fetch('/api/auth/csrf', { cache: 'no-store' })).json();
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf.token },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, data: { error: 'Terjadi kesalahan jaringan, silakan coba lagi.' } };
  }
}

function useCountdown(until: string | null): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [until]);
  if (!until) return null;
  const left = Math.ceil((new Date(until).getTime() - now) / 1000);
  if (left <= 0) return null;
  if (left >= 3600) return `${Math.ceil(left / 3600)} jam`;
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}

function NewPasswordFields({ password, setPassword, repeat, setRepeat }: {
  password: string; setPassword: (v: string) => void; repeat: string; setRepeat: (v: string) => void;
}) {
  return (
    <>
      <Field id="new-password" label="Password baru" hint="Minimal 8 karakter.">
        <Input id="new-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      <Field id="repeat-password" label="Ulangi password baru">
        <Input id="repeat-password" type="password" autoComplete="new-password" minLength={8} value={repeat} onChange={(e) => setRepeat(e.target.value)} required />
      </Field>
    </>
  );
}

const BackToLogin = () => <Link href="/login" className="block text-center text-sm text-brand-700">Kembali ke Masuk</Link>;

/** KAR-L04: cocokkan data, lalu password baru. */
export function ForgotForm() {
  const [ticket, setTicket] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [blockedUntil, setBlockedUntil] = useState<string | null>(null);
  const [useCode, setUseCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const countdown = useCountdown(blockedUntil);

  async function submit(event: React.SyntheticEvent) {
    event.preventDefault();
    setError(null);
    if (ticket && password !== repeat) return setError('Kedua password baru tidak sama.');
    setBusy(true);
    const { ok, data } = ticket
      ? await post('/api/auth/forgot/complete', { ticket, newPassword: password })
      : await post('/api/auth/forgot/verify', { identifier, phone, birthDate });
    setBusy(false);
    if (!ok) {
      setError(data.error ?? 'Permintaan gagal.');
      setBlockedUntil(data.blockedUntil ?? null);
      setUseCode(!!data.useCode);
      return;
    }
    if (ticket) return window.location.assign('/');
    setTicket(data.ticket ?? null);
  }

  return (
    <Card className="w-full max-w-sm">
      <form onSubmit={submit} className="space-y-4">
        <h1 className="text-xl font-semibold">Lupa password</h1>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          Langkah {ticket ? 2 : 1} dari 2 — {ticket ? 'Password baru' : 'Cocokkan data'}
        </p>
        {ticket ? (
          <>
            <Alert tone="warn">Catat password ini di tempat aman. Semua perangkat Anda, termasuk kasir, akan keluar.</Alert>
            <NewPasswordFields password={password} setPassword={setPassword} repeat={repeat} setRepeat={setRepeat} />
          </>
        ) : (
          <>
            <Field id="identifier" label="Username atau email">
              <Input id="identifier" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
            </Field>
            <Field id="phone" label="Nomor HP">
              <Input id="phone" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </Field>
            <Field id="birth-date" label="Tanggal lahir">
              <Input id="birth-date" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required />
            </Field>
          </>
        )}
        {error && <Alert tone="danger">{error}{countdown && <span className="mt-1 block font-semibold">Coba lagi dalam {countdown}</span>}</Alert>}
        <Button type="submit" block loading={busy} disabled={!!countdown}>{ticket ? 'Simpan dan masuk' : 'Periksa'}</Button>
        {(useCode || !ticket) && <Link href="/lupa-password/kode" className="block text-center text-sm text-brand-700">Saya punya kode dari GM</Link>}
        <BackToLogin />
      </form>
    </Card>
  );
}

/** KAR-L05: email, kode, password baru dua kali. */
export function CodeForm() {
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.SyntheticEvent) {
    event.preventDefault();
    setError(null);
    if (password !== repeat) return setError('Kedua password baru tidak sama.');
    setBusy(true);
    const { ok, data } = await post('/api/auth/forgot/code', { identifier, code, newPassword: password });
    setBusy(false);
    if (!ok) return setError(data.error ?? 'Permintaan gagal.');
    window.location.assign('/');
  }

  return (
    <Card className="w-full max-w-sm">
      <form onSubmit={submit} className="space-y-4">
        <h1 className="text-xl font-semibold">Pakai kode dari GM</h1>
        <Field id="identifier" label="Username atau email">
          <Input id="identifier" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        </Field>
        <Field id="code" label="Kode" hint="6 angka, berlaku 1 jam, sekali pakai.">
          <Input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required />
        </Field>
        <Alert tone="warn">Catat password ini di tempat aman. Semua perangkat Anda, termasuk kasir, akan keluar.</Alert>
        <NewPasswordFields password={password} setPassword={setPassword} repeat={repeat} setRepeat={setRepeat} />
        {error && <Alert tone="danger">{error}</Alert>}
        <Button type="submit" block loading={busy}>Simpan dan masuk</Button>
        <BackToLogin />
      </form>
    </Card>
  );
}
