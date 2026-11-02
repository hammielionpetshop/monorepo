'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';

type Props = {
  day: { id: number; dateLabel: string; scheduledEnd: string; outClock: string; hours: number; deadline: string; left: string };
  orderers: { id: number; name: string }[];
  resubmit: Record<string, unknown> | null;
  resubmittedFromId: number | null;
};

const STEPS = ['Foto kertas lembur', 'Yang menyuruh', 'Periksa dan kirim'];

/** Langkah klaim KEH-L41: foto kertas, yang menyuruh, periksa lalu kirim (ditahan, menyangkut uang; tanpa nominal). */
export function OvertimeClaimForm({ day, orderers, resubmit, resubmittedFromId }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [ordererId, setOrdererId] = useState(() => {
    const old = Number(resubmit?.ordererId);
    return orderers.some((o) => o.id === old) ? String(old) : '';
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!photo) return setUrl(null);
    const next = URL.createObjectURL(photo);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [photo]);
  const orderer = orderers.find((o) => String(o.id) === ordererId);

  function next() {
    if (step === 0 && !photo) return setError('Foto kertas lembur dulu.');
    if (step === 1 && !orderer) return setError('Pilih yang menyuruh.');
    setError(null);
    setStep(step + 1);
  }

  async function submit() {
    if (!photo || !orderer) return;
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.append('file', photo);
    const uploaded = await postJson('/api/files', body);
    if (!uploaded.ok) {
      setBusy(false);
      return setError(uploaded.error ?? 'Foto gagal diunggah.');
    }
    const result = await postJson('/api/requests', {
      kind: 'submit', typeKey: 'overtime_claim', fields: { overtimeDayId: day.id, ordererId: orderer.id },
      attachmentIds: [String(uploaded.data?.id)], resubmittedFromId,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Klaim gagal dikirim.');
    toast('Klaim lembur terkirim. Menunggu keputusan HR atau pemilik.', 'ok');
    router.push('/lembur?tab=waiting');
    router.refresh();
  }

  return (
    <Card className="mx-auto max-w-md space-y-4">
      <div>
        <p className="text-xs text-ink-muted">Langkah {step + 1} dari {STEPS.length}</p>
        <h2 className="font-semibold">{STEPS[step]}</h2>
        <p className="text-sm text-ink-muted">Lembur {day.hours} jam, {day.dateLabel}. {day.left}, batas {day.deadline}.</p>
      </div>
      {step === 0 && (
        <Field id="ot-photo" label="Foto kertas lembur" hint="Dari kamera atau galeri.">
          <div className="space-y-2">
            <Input id="ot-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {url && <img src={url} alt="Foto kertas lembur" className="max-h-48 rounded-lg" />}
          </div>
        </Field>
      )}
      {step === 1 && (
        <Field id="ot-orderer" label="Yang menyuruh" hint="Hanya dicatat. Yang dipilih tidak diberi tahu.">
          <Select id="ot-orderer" value={ordererId} onChange={(event) => setOrdererId(event.target.value)}>
            <option value="">Pilih nama</option>
            {orderers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
        </Field>
      )}
      {step === 2 && (
        <dl className="space-y-1 text-sm">
          <div><dt className="inline text-ink-muted">Tanggal: </dt><dd className="inline">{day.dateLabel}</dd></div>
          <div><dt className="inline text-ink-muted">Jadwal pulang: </dt><dd className="inline">{day.scheduledEnd}</dd></div>
          <div><dt className="inline text-ink-muted">Jam pulang: </dt><dd className="inline">{day.outClock}</dd></div>
          <div><dt className="inline text-ink-muted">Jam diklaim: </dt><dd className="inline font-medium">{day.hours} jam</dd></div>
          <div><dt className="inline text-ink-muted">Yang menyuruh: </dt><dd className="inline">{orderer?.name}</dd></div>
        </dl>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="ghost" disabled={busy} onClick={() => { setError(null); if (step) setStep(step - 1); else router.push('/lembur'); }}>Kembali</Button>
        {step < 2 ? <Button onClick={next}>Lanjut</Button> : <HoldButton loading={busy} onClick={submit}>Kirim klaim</HoldButton>}
      </div>
      {step === 2 && <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setPhoto(null); setOrdererId(''); setError(null); setStep(0); }}>Ulangi dari awal</Button>}
    </Card>
  );
}
