'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { MONEY_DATE_FREE_DAYS, daysBetween } from '../rules/payment';
import { longDate, rupiah } from '../rules/salary';
import type { payPreviewScreen, PayOutcome } from '../server/payment';

type Data = NonNullable<Awaited<ReturnType<typeof payPreviewScreen>>>;

/** GAJ-L34 Bayar Slip (3 langkah): yang dibayar → sumber uang, tanggal uang, foto bukti → tahan 3 detik → hasil. */
export function PaySlipFlow({ ready, skipped, total, today, latestClosedOn, sources, back }: Data & { back: string }) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [sourceId, setSourceId] = useState(sources[0] ? String(sources[0].id) : '');
  const [moneyDate, setMoneyDate] = useState(today);
  const [dateReason, setDateReason] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<PayOutcome[] | null>(null);
  const source = sources.find((s) => String(s.id) === sourceId);
  const back7 = daysBetween(moneyDate || today, today) > MONEY_DATE_FREE_DAYS;
  const dateBad = !moneyDate || moneyDate > today || (latestClosedOn != null && moneyDate < latestClosedOn);
  const step2Ready = Boolean(source) && !dateBad && (!back7 || dateReason.trim().length >= 15);

  async function pay() {
    setBusy(true);
    setError(null);
    let proofFileId: string | null = null;
    if (photo) {
      const form = new FormData();
      form.append('file', photo);
      const uploaded = await postJson('/api/files', form);
      if (!uploaded.ok) { setBusy(false); return setError(uploaded.error ?? 'Foto bukti gagal diunggah.'); }
      proofFileId = String(uploaded.data?.id);
    }
    const result = await postJson('/api/payroll', {
      kind: 'payslip_pay', slipIds: ready.map((r) => r.slipId), sourceId: Number(sourceId), moneyDate, dateReason: back7 ? dateReason.trim() : null, proofFileId,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal membayar.');
    const list = (result.data?.outcomes ?? []) as PayOutcome[];
    setOutcomes(list);
    const paid = list.filter((o) => o.result === 'PAID').length;
    toast(`${paid} slip ditandai Dibayar${list.length > paid ? `, ${list.length - paid} gagal` : ''}.`, paid ? 'ok' : 'danger');
    router.refresh();
  }

  if (outcomes) {
    const paid = outcomes.filter((o) => o.result === 'PAID');
    const failed = outcomes.filter((o) => o.result !== 'PAID');
    return (
      <Card className="max-w-2xl space-y-3 text-sm">
        <p className="font-medium">{paid.length} slip dibayar · {rupiah(paid.reduce((s, o) => s + o.net, 0))}</p>
        {failed.length > 0 && (
          <Alert tone="warn" title={`${failed.length} gagal`}>
            <ul className="mt-1 space-y-1">{failed.map((o) => <li key={o.slipId}>{o.name}: {o.text}</li>)}</ul>
          </Alert>
        )}
        <Link className={buttonClass({})} href={back}>Selesai</Link>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl space-y-4 text-sm">
      <p className="text-ink-muted">Langkah {step} dari 3</p>
      {step === 1 && (
        <>
          <p className="font-medium">Yang dibayar: {ready.length} slip · {rupiah(total)}</p>
          <ul className="divide-y divide-line">
            {ready.map((r) => (
              <li key={r.slipId} className="flex flex-wrap gap-x-3 py-2">
                <span>{r.name}</span><span className="text-ink-muted">{r.number} · {r.period}</span><b className="tabular-nums">{rupiah(r.net)}</b>
              </li>
            ))}
          </ul>
          {skipped.length > 0 && (
            <Alert tone="info" title="Tidak ikut dibayar">
              <ul className="mt-1 space-y-1">{skipped.map((s) => <li key={s.slipId}>{s.name}: {s.text}</li>)}</ul>
            </Alert>
          )}
          <p className="text-ink-muted">Nominal tiap slip = bersih slip; tidak diketik. Satu slip dibayar sekali dan penuh.</p>
        </>
      )}
      {step === 2 && (
        <>
          {!sources.length && <Alert tone="warn">Belum ada Sumber Uang aktif. Tambahkan di Pengaturan › Sumber Uang.</Alert>}
          <Field id="ps-source" label="Sumber uang">
            <Select id="ps-source" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.methodLabel})</option>)}
            </Select>
          </Field>
          <Field id="ps-date" label="Tanggal uang" hint={`Hari uangnya keluar. Boleh mundur sampai ${MONEY_DATE_FREE_DAYS} hari; lebih jauh tulis alasan. Tidak sebelum slip ditutup${latestClosedOn ? ` (${longDate(latestClosedOn)})` : ''}.`}>
            <Input id="ps-date" type="date" value={moneyDate} max={today} min={latestClosedOn ?? undefined} onChange={(e) => setMoneyDate(e.target.value)} />
          </Field>
          {back7 && (
            <Field id="ps-reason" label="Alasan tanggal mundur" hint="Paling sedikit 15 huruf.">
              <Textarea id="ps-reason" value={dateReason} onChange={(e) => setDateReason(e.target.value)} />
            </Field>
          )}
          <Field id="ps-proof" label="Foto bukti (dianjurkan)" hint="Mis. tangkapan layar transfer massal. Satu foto untuk semua slip ini.">
            <Input id="ps-proof" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </Field>
          {dateBad && moneyDate && <Alert tone="warn">Tanggal uang tidak boleh sesudah hari ini atau sebelum slip ditutup.</Alert>}
        </>
      )}
      {step === 3 && (
        <>
          <p className="font-medium">
            {ready.length} slip, {rupiah(total)}, dari {source?.name} ({source?.methodLabel}), tanggal {longDate(moneyDate)}.
          </p>
          {!photo && <p><Badge tone="warn">Tanpa foto bukti</Badge></p>}
          {back7 && <p className="text-ink-muted">Alasan tanggal mundur: {dateReason.trim()}</p>}
          <p className="text-ink-muted">Tiap orang diberi tahu tanggal dan cara bayarnya. Yang salah bisa dibatalkan lewat Batal bayar di layar slip.</p>
        </>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {step > 1 ? <Button variant="secondary" onClick={() => { setError(null); setStep(step - 1); }} disabled={busy}>Kembali</Button>
          : <Link className={buttonClass({ variant: 'secondary' })} href={back}>Batal</Link>}
        {step === 1 && <Button onClick={() => setStep(2)} disabled={!ready.length}>Lanjut</Button>}
        {step === 2 && <Button onClick={() => setStep(3)} disabled={!step2Ready}>Lanjut</Button>}
        {step === 3 && <HoldButton loading={busy} disabled={busy} onClick={pay}>Bayar {ready.length} slip</HoldButton>}
      </div>
    </Card>
  );
}
