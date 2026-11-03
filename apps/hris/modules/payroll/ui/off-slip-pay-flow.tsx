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
import type { offSlipPayScreen } from '../server/off-slip';

type Data = NonNullable<Awaited<ReturnType<typeof offSlipPayScreen>>>;

/**
 * GAJ-L37 Bayar di Luar Slip (3 langkah): tagihan + Piutang Lain yang dipotongkan + sisa → sumber uang, tanggal uang, foto bukti
 * (dilewati bila sisa Rp0) → tahan 3 detik.
 */
export function OffSlipPayFlow({ claim, problem, settlements, cash, today, sources }: Data) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [sourceId, setSourceId] = useState(sources[0] ? String(sources[0].id) : '');
  const [moneyDate, setMoneyDate] = useState(today);
  const [dateReason, setDateReason] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const source = sources.find((s) => String(s.id) === sourceId);
  const settled = claim.amount - cash;
  const back7 = daysBetween(moneyDate || today, today) > MONEY_DATE_FREE_DAYS;
  const dateBad = !moneyDate || moneyDate > today;
  const step2Ready = cash === 0 || (Boolean(source) && !dateBad && (!back7 || dateReason.trim().length >= 15));
  const next = () => setStep(step === 1 && cash === 0 ? 3 : step + 1);
  const prev = () => { setError(null); setStep(step === 3 && cash === 0 ? 1 : step - 1); };

  async function pay() {
    setBusy(true);
    setError(null);
    let proofFileId: string | null = null;
    if (photo && cash > 0) {
      const form = new FormData();
      form.append('file', photo);
      const uploaded = await postJson('/api/files', form);
      if (!uploaded.ok) { setBusy(false); return setError(uploaded.error ?? 'Foto bukti gagal diunggah.'); }
      proofFileId = String(uploaded.data?.id);
    }
    const result = await postJson('/api/payroll', {
      kind: 'off_slip_pay', claimId: claim.id, ...(cash > 0 ? { sourceId: Number(sourceId), moneyDate, dateReason: back7 ? dateReason.trim() : null, proofFileId } : {}),
    });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal membayar.');
    toast(String(result.data?.effect ?? 'Dibayar.'), 'ok');
    router.push('/gaji/jadwal-bayar');
    router.refresh();
  }

  if (problem) {
    return (
      <Card className="max-w-2xl space-y-3 text-sm">
        <Alert tone="warn">{problem}</Alert>
        <Link className={buttonClass({ variant: 'secondary' })} href="/gaji/jadwal-bayar">Kembali ke Jadwal Bayar</Link>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl space-y-4 text-sm">
      <p className="text-ink-muted">Langkah {step} dari 3</p>
      {step === 1 && (
        <>
          <p className="font-medium">{claim.name}: {claim.label}</p>
          <p>{claim.kind} · <b className="tabular-nums">{rupiah(claim.amount)}</b> · slip terakhir <Link className="underline" href={`/gaji/slip/${claim.lastSlipId}`}>{claim.lastSlipNumber}</Link> sudah Dibayar</p>
          {settlements.length > 0 ? (
            <Alert tone="info" title={`Dipotongkan ke Piutang Lain lebih dulu: ${rupiah(settled)}`}>
              <ul className="mt-1 space-y-1">
                {settlements.map((s) => (
                  <li key={s.receivableId}>Piutang #{s.receivableId}: sisa {rupiah(s.remaining)} → dipotong {rupiah(s.amount)}{s.clears ? ' (Lunas)' : ''}</li>
                ))}
              </ul>
              <p className="mt-1">Tanpa uang bergerak.</p>
            </Alert>
          ) : <p className="text-ink-muted">Orang ini tidak punya Piutang Lain terbuka.</p>}
          <p className="font-medium">Dibayar dengan uang: <span className="tabular-nums">{rupiah(cash)}</span></p>
          {cash === 0 && <p className="text-ink-muted">Seluruh tagihan habis dipotongkan ke piutang, jadi tidak ada uang yang keluar.</p>}
        </>
      )}
      {step === 2 && (
        <>
          {!sources.length && <Alert tone="warn">Belum ada Sumber Uang aktif. Tambahkan di Pengaturan › Sumber Uang.</Alert>}
          <Field id="os-source" label="Sumber uang">
            <Select id="os-source" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.methodLabel})</option>)}
            </Select>
          </Field>
          <Field id="os-date" label="Tanggal uang" hint={`Hari uangnya keluar. Boleh mundur sampai ${MONEY_DATE_FREE_DAYS} hari; lebih jauh tulis alasan.`}>
            <Input id="os-date" type="date" value={moneyDate} max={today} onChange={(e) => setMoneyDate(e.target.value)} />
          </Field>
          {back7 && (
            <Field id="os-reason" label="Alasan tanggal mundur" hint="Paling sedikit 15 huruf.">
              <Textarea id="os-reason" value={dateReason} onChange={(e) => setDateReason(e.target.value)} />
            </Field>
          )}
          <Field id="os-proof" label="Foto bukti (dianjurkan)">
            <Input id="os-proof" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </Field>
          {dateBad && moneyDate && <Alert tone="warn">Tanggal uang tidak boleh sesudah hari ini.</Alert>}
        </>
      )}
      {step === 3 && (
        <>
          <p className="font-medium">
            {claim.label} {claim.name} {rupiah(claim.amount)}
            {settled > 0 ? `: ${rupiah(settled)} dipotongkan ke Piutang Lain` : ''}
            {cash > 0 ? `${settled > 0 ? ', ' : ': '}${rupiah(cash)} dari ${source?.name} (${source?.methodLabel}) tanggal ${longDate(moneyDate)}` : ''}.
          </p>
          {cash > 0 && !photo && <p><Badge tone="warn">Tanpa foto bukti</Badge></p>}
          <p className="text-ink-muted">{claim.name} diberi tahu. Yang salah bisa dibatalkan lewat Batal bayar di Jadwal Bayar; semuanya dibalik.</p>
        </>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {step > 1 ? <Button variant="secondary" onClick={prev} disabled={busy}>Kembali</Button>
          : <Link className={buttonClass({ variant: 'secondary' })} href="/gaji/jadwal-bayar">Batal</Link>}
        {step === 1 && <Button onClick={next}>Lanjut</Button>}
        {step === 2 && <Button onClick={next} disabled={!step2Ready}>Lanjut</Button>}
        {step === 3 && <HoldButton loading={busy} disabled={busy || !step2Ready} onClick={pay}>Bayar di luar slip</HoldButton>}
      </div>
    </Card>
  );
}
