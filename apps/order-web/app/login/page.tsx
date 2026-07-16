'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Step = 'phone' | 'otp';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Gagal mengirim kode OTP');
        return;
      }
      setStep('otp');
    } catch {
      setError('Terjadi kesalahan, coba lagi');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Kode OTP salah');
        return;
      }
      router.push('/');
    } catch {
      setError('Terjadi kesalahan, coba lagi');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Login Pelanggan</h1>

      {step === 'phone' && (
        <form onSubmit={handleRequestOtp} className="flex w-full max-w-sm flex-col gap-3">
          <label htmlFor="phone" className="text-sm text-muted-foreground">
            Nomor HP (WhatsApp)
          </label>
          <input
            id="phone"
            type="tel"
            required
            placeholder="08123456789"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-lg"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          >
            {loading ? 'Mengirim...' : 'Kirim Kode OTP'}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={handleVerifyOtp} className="flex w-full max-w-sm flex-col gap-3">
          <p className="text-sm text-muted-foreground">Kode OTP terkirim ke {phone}</p>
          <label htmlFor="code" className="text-sm text-muted-foreground">
            Kode OTP (6 digit)
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            required
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-lg tracking-widest"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          >
            {loading ? 'Memverifikasi...' : 'Masuk'}
          </button>
          <button type="button" onClick={() => setStep('phone')} className="text-sm text-muted-foreground underline">
            Ganti nomor HP
          </button>
        </form>
      )}
    </main>
  );
}
