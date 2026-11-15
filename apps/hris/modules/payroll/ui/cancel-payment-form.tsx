'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';

/** GAJ-L35 Batal Bayar (3 langkah): pembayaran → alasan (≥ 15 huruf) dan akibatnya → tahan 3 detik. */
export function CancelPaymentForm({ slipId, claimId, payment, effects, back }: { slipId?: number; claimId?: number; payment: string[]; effects?: string[]; back: string }) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const short = reason.trim().length < 15;

  async function save() {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/payroll', claimId ? { kind: 'off_slip_pay_cancel', claimId, reason: reason.trim() } : { kind: 'payslip_pay_cancel', slipId, reason: reason.trim() });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal membatalkan.');
    toast(String(result.data?.effect ?? 'Pembayaran dibatalkan.'), 'ok');
    router.push(back);
    router.refresh();
  }

  return (
    <Card className="max-w-2xl space-y-4 text-sm">
      <p className="text-ink-muted">Langkah {step} dari 3</p>
      {step === 1 && (
        <>
          <p className="font-medium">Pembayaran yang dibatalkan</p>
          <ul className="list-disc space-y-1 pl-5">{payment.map((p) => <li key={p}>{p}</li>)}</ul>
        </>
      )}
      {step === 2 && (
        <>
          <Field id="cp-reason" label="Alasan" hint="Paling sedikit 15 huruf. Tercatat di riwayat slip dan dikirim ke orangnya.">
            <Textarea id="cp-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <ul className="list-disc space-y-1 pl-5 text-ink-muted">
            {(effects ?? [
              'Pembayaran ditandai Dibatalkan (tidak dihapus).',
              'Slip kembali Ditutup dan muncul lagi di Jadwal Bayar.',
              'Orangnya dan pemilik lain diberi tahu beserta alasannya.',
              'Sesudahnya bayar ulang, atau buka kembali slipnya bila isinya yang salah.',
            ]).map((e) => <li key={e}>{e}</li>)}
          </ul>
        </>
      )}
      {step === 3 && (
        <>
          <p className="font-medium">Batalkan pembayaran ini?</p>
          <p className="text-ink-muted">Alasan: {reason.trim()}</p>
        </>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {step > 1 ? <Button variant="secondary" onClick={() => { setError(null); setStep(step - 1); }} disabled={busy}>Kembali</Button>
          : <Link className={buttonClass({ variant: 'secondary' })} href={back}>Batal</Link>}
        {step < 3 && <Button onClick={() => setStep(step + 1)} disabled={step === 2 && short}>Lanjut</Button>}
        {step === 3 && <HoldButton variant="danger" loading={busy} disabled={busy || short} onClick={save}>Batalkan pembayaran</HoldButton>}
      </div>
    </Card>
  );
}
