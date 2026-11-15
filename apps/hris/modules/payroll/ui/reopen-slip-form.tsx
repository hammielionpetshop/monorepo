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

/**
 * GAJ-L31 Buka Kembali Slip dan Tutup lebih cepat (3 langkah): akibat → alasan (≥ 15 huruf) → tahan 3 detik.
 * `mode` REOPEN langsung (Pemilik/GM), REQUEST lewat Persetujuan (HR), EARLY tutup lebih cepat slip terakhir.
 */
export function ReopenSlipForm({ mode, slipId, title, effects, back }: {
  mode: 'REOPEN' | 'REQUEST' | 'EARLY'; slipId: number; title: string; effects: string[]; back: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const short = reason.trim().length < 15;
  const button = mode === 'EARLY' ? 'Tutup lebih cepat' : mode === 'REQUEST' ? 'Kirim permintaan' : 'Buka kembali';

  async function save() {
    setBusy(true);
    setError(null);
    const body = mode === 'EARLY'
      ? { kind: 'payslip_close', slipIds: [slipId], early: reason.trim() }
      : { kind: 'payslip_reopen', slipId, reason: reason.trim() };
    const result = await postJson('/api/payroll', body);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    if (mode === 'EARLY') {
      const outcome = (result.data?.outcomes as { result: string; text: string }[] | undefined)?.[0];
      if (outcome?.result !== 'CLOSED') return setError(outcome?.text ?? 'Slip tidak ditutup.');
      toast(`Slip ditutup: ${outcome.text}`, 'ok');
    } else {
      toast(mode === 'REQUEST' ? 'Permintaan buka kembali terkirim. Menunggu Pemilik atau GM.' : 'Slip dibuka kembali. Orangnya dan pemilik lain diberi tahu.', 'ok');
    }
    router.push(back);
    router.refresh();
  }

  return (
    <Card className="max-w-2xl space-y-4 text-sm">
      <p className="text-ink-muted">Langkah {step} dari 3 · {title}</p>
      {step === 1 && (
        <>
          <p className="font-medium">{mode === 'EARLY' ? 'Yang terjadi bila ditutup sekarang' : mode === 'REQUEST' ? 'Bila Pemilik atau GM menyetujui' : 'Yang terjadi bila dibuka kembali'}</p>
          <ul className="list-disc space-y-1 pl-5">{effects.map((e) => <li key={e}>{e}</li>)}</ul>
        </>
      )}
      {step === 2 && (
        <Field id="rs-reason" label="Alasan" hint="Paling sedikit 15 huruf. Tercatat di riwayat slip.">
          <Textarea id="rs-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      )}
      {step === 3 && (
        <>
          <p className="font-medium">{button}?</p>
          <p className="text-ink-muted">Alasan: {reason.trim()}</p>
        </>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {step > 1 ? <Button variant="secondary" onClick={() => { setError(null); setStep(step - 1); }} disabled={busy}>Kembali</Button>
          : <Link className={buttonClass({ variant: 'secondary' })} href={back}>Batal</Link>}
        {step < 3 && <Button onClick={() => setStep(step + 1)} disabled={step === 2 && short}>Lanjut</Button>}
        {step === 3 && <HoldButton variant={mode === 'EARLY' ? 'primary' : 'danger'} loading={busy} disabled={busy || short} onClick={save}>{button}</HoldButton>}
      </div>
    </Card>
  );
}
