'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { rupiah } from '../rules/salary';
import { OBJECTION_REASON_MIN } from '../rules/slip-objection';
import type { slipObjectionFormScreen } from '../server/slip-objection';

type Data = NonNullable<Awaited<ReturnType<typeof slipObjectionFormScreen>>>;

const timeFormat = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/** GAJ-L41 Ajukan Keberatan Slip (HP, 3 langkah): baris yang salah (atau pembayaran), alasan + foto, periksa dan kirim. */
export function SlipObjectionForm({ data }: { data: Data }) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [picked, setPicked] = useState<string[]>(data.prefill?.lines ?? []);
  const [other, setOther] = useState(Boolean(data.prefill && !data.prefill.lines.length));
  const [reason, setReason] = useState(data.prefill?.reason ?? '');
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const back = `/pendapatan/slip/${data.slip.id}`;

  if (data.pendingRequestId) {
    return (
      <Alert tone="info">
        Keberatan macam ini untuk slip ini sudah dikirim dan masih menunggu. Untuk menambah keterangan, tarik dulu lalu Ajukan ulang.{' '}
        <Link className="underline" href={`/pengajuan/${data.pendingRequestId}`}>Lihat pengajuannya</Link>
      </Alert>
    );
  }
  if (!data.open) return <Alert tone="warn">{data.closedReason}</Alert>;

  const wrong = data.kind === 'WRONG';
  const chosen = data.lines.filter((l) => picked.includes(l.key));

  function toggle(key: string) {
    setPicked((list) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]));
  }

  function next() {
    setError(null);
    if (step === 1 && wrong && !picked.length && !other) return setError('Centang baris yang salah, atau pilih "Lainnya".');
    if (step === 2 && reason.trim().length < OBJECTION_REASON_MIN) return setError(`Alasan paling sedikit ${OBJECTION_REASON_MIN} huruf.`);
    setStep(step + 1);
  }

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
    const result = await postJson('/api/payroll', {
      kind: 'slip_objection_submit', slipId: data.slip.id, objectionKind: data.kind, lines: wrong ? picked : [],
      reason: reason.trim(), attachmentId, resubmittedFromId: data.resubmittedFromId,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal mengirim.');
    toast(String(result.data?.message ?? 'Keberatan terkirim.'), 'ok');
    router.push(back);
    router.refresh();
  }

  return (
    <Card className="max-w-xl space-y-4">
      <p className="text-sm text-ink-muted">
        Langkah {step} dari 3 · {data.kindLabel} · batas {data.until ? timeFormat.format(new Date(data.until)) : 'sampai slip ditutup lalu 3 hari'}
      </p>
      <p className="text-sm">Slip {data.slip.number ?? '(Perkiraan)'} · periode {data.slip.period}</p>

      {step === 1 && wrong && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Baris mana yang salah?</legend>
          {data.lines.map((l) => (
            <label key={l.key} className="flex items-start gap-2 rounded-lg border border-line p-2 text-sm">
              <input type="checkbox" className="mt-1" checked={picked.includes(l.key)} onChange={() => toggle(l.key)} />
              <span className="flex-1">{l.label}</span>
              <span className="tabular-nums">{l.section === 'DEDUCTION' ? '−' : ''}{rupiah(l.amount)}</span>
            </label>
          ))}
          <label className="flex items-start gap-2 rounded-lg border border-line p-2 text-sm">
            <input type="checkbox" className="mt-1" checked={other} onChange={(e) => setOther(e.target.checked)} />
            <span>Lainnya (tidak ada di baris slip)</span>
          </label>
        </fieldset>
      )}
      {step === 1 && !wrong && (
        <div className="space-y-1 text-sm">
          <p className="font-medium">Pembayaran yang belum Anda terima</p>
          <p>{data.payment?.text}</p>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <Field id="so-reason" label="Alasan keberatan" hint={`Paling sedikit ${OBJECTION_REASON_MIN} huruf. Jelaskan apa yang salah dan seharusnya berapa.`}>
            <Textarea id="so-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Field id="so-photo" label="Foto (bila ada)"><Input id="so-photo" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></Field>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-2 text-sm">
          <p className="font-medium">{data.kindLabel}</p>
          {wrong && <p>Baris: {chosen.length ? chosen.map((l) => l.label).join(', ') : ''}{chosen.length && other ? ', ' : ''}{other ? 'Lainnya' : ''}</p>}
          {!wrong && <p>{data.payment?.text}</p>}
          <p className="text-ink-muted">Alasan: {reason}</p>
          {photo && <p className="text-ink-muted">Foto: {photo.name}</p>}
          <p className="text-ink-muted">Yang memutuskan: {data.decider}. Slip tidak ditahan selama menunggu.</p>
        </div>
      )}

      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {step > 1 ? <Button variant="secondary" onClick={() => setStep(step - 1)} disabled={busy}>Kembali</Button> : <Link className={buttonClass({ variant: 'secondary' })} href={back}>Batal</Link>}
        {step < 3 ? <Button onClick={next}>Lanjut</Button> : <HoldButton loading={busy} onClick={send}>Kirim keberatan</HoldButton>}
      </div>
    </Card>
  );
}
