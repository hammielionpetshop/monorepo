'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';

const timeFormat = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/** GAJ-L18 Keberatan Potongan (HP, 3 langkah): potongan yang dikeberati, alasan, periksa dan kirim. */
export function ObjectionForm({ target, targetId, label, text, deadline, expired, live, openRequestId }: {
  target: string; targetId: number; label: string; text: string; deadline: string; expired: boolean; live: boolean; openRequestId: number | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (openRequestId) return <Alert tone="info">Keberatan atas potongan ini sudah dikirim. <Link className="underline" href={`/pengajuan/${openRequestId}`}>Lihat pengajuannya</Link></Alert>;
  if (!live) return <Alert tone="info">Potongan ini sudah tidak berjalan; tidak ada yang perlu dikeberati.</Alert>;
  if (expired) return <Alert tone="warn">Batas keberatan sudah lewat ({timeFormat.format(new Date(deadline))}). Keberatan berikutnya lewat keberatan slip.</Alert>;

  async function send() {
    setBusy(true);
    setError(null);
    let attachmentId: string | null = null;
    if (photo) {
      const body = new FormData();
      body.append('file', photo);
      const uploaded = await postJson('/api/files', body);
      if (!uploaded.ok) { setBusy(false); return setError(uploaded.error ?? 'Foto gagal diunggah.'); }
      attachmentId = String(uploaded.data?.id);
    }
    const result = await postJson('/api/payroll', { kind: 'objection_submit', target, targetId, reason: reason.trim(), attachmentId });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal mengirim.');
    toast(String(result.data?.message ?? 'Keberatan terkirim.'), 'ok');
    router.push('/pengajuan');
    router.refresh();
  }

  return (
    <Card className="max-w-xl space-y-4">
      <p className="text-sm text-ink-muted">Langkah {step} dari 3 · batas {timeFormat.format(new Date(deadline))}</p>
      {step === 1 && <div className="space-y-1"><p className="text-sm text-ink-muted">{label}</p><p>{text}</p></div>}
      {step === 2 && (
        <div className="space-y-3">
          <Field id="ob-reason" label="Alasan keberatan" hint="Paling sedikit 20 huruf."><Textarea id="ob-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <Field id="ob-photo" label="Foto (bila ada)"><Input id="ob-photo" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></Field>
        </div>
      )}
      {step === 3 && (
        <div className="space-y-2 text-sm">
          <p>{text}</p>
          <p className="text-ink-muted">Alasan: {reason}</p>
          <p className="text-ink-muted">Selama menunggu, potongan tetap berjalan. Pemilik atau GM memutuskan: Ditiadakan atau Tetap.</p>
        </div>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {step > 1 && <Button variant="secondary" onClick={() => setStep(step - 1)}>Kembali</Button>}
        {step < 3
          ? <Button onClick={() => { setError(null); if (step === 2 && reason.trim().length < 20) return setError('Alasan paling sedikit 20 huruf.'); setStep(step + 1); }}>Lanjut</Button>
          : <HoldButton loading={busy} onClick={send}>Kirim keberatan</HoldButton>}
      </div>
    </Card>
  );
}
