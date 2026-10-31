'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Badge } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { formatLongDate } from '../rules/dates';
import { WORK_STATUS_LABELS, type WorkStatus } from '../rules/history';
import { postJson } from './api';

const HOLD_SECONDS = 3;

/** Tombol simpan yang ditahan 3 detik untuk tindakan berakibat (TAM-15). Hitungan mulai saat tampil. */
export function HoldButton({ children, ...rest }: ButtonProps) {
  const [countdown, setCountdown] = useState(HOLD_SECONDS);
  useEffect(() => {
    const timer = setInterval(() => setCountdown((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Button {...rest} disabled={rest.disabled || countdown > 0}>
      {countdown > 0 ? <>{children} ({countdown})</> : children}
    </Button>
  );
}

/** Simpan → pesan berhasil → muat ulang data server. Galat ditampilkan di layar pemanggil. */
export function useMutation(path: string) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send(body: unknown, success: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    const result = await postJson(path, body);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Gagal menyimpan.');
      return false;
    }
    toast(success, 'ok');
    router.refresh();
    return true;
  }
  return { busy, error, setError, send };
}

export function WorkStatusBadge({ status }: { status: WorkStatus }) {
  return <Badge tone={status === 'TRAINING' ? 'warn' : 'info'}>{WORK_STATUS_LABELS[status]}</Badge>;
}

export function ActiveBadge({ active }: { active: boolean }) {
  return active ? <Badge tone="ok">Aktif</Badge> : <Badge tone="danger">Nonaktif</Badge>;
}

export function LongDate({ value }: { value: string | null }) {
  return <>{value ? formatLongDate(value.slice(0, 10)) : '—'}</>;
}

/** Penanda langkah bertahap: "Langkah 2 dari 4". */
export function StepLabel({ step, total, title }: { step: number; total: number; title: string }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
      Langkah {step} dari {total} — {title}
    </p>
  );
}
