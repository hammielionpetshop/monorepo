'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { MONEY_DATE_FREE_DAYS, daysBetween, longDate, periodLabel, placeSchedule, rupiah } from '../rules/advance';

/** DRV-L29 Serahkan Uang Kasbon (3 langkah). Nominal = nominal akhir, tidak diketik (DRV-126). */
export function HandoverFlow({ id, number, name, amount, installments, approvedOn, today, sources, people, self, canHandOver, decidedBy }: {
  id: number; number: string; name: string; amount: number; installments: number[]; approvedOn: string; today: string;
  sources: { id: number; name: string; method: string }[]; people: { id: number; name: string; branchName: string }[]; self: boolean; canHandOver: boolean; decidedBy: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [sourceId, setSourceId] = useState(sources.length === 1 ? String(sources[0].id) : '');
  const [moneyDate, setMoneyDate] = useState(today);
  const [dateReason, setDateReason] = useState('');
  const [via, setVia] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const source = sources.find((s) => String(s.id) === sourceId);
  const needsReason = moneyDate < approvedOn || (moneyDate <= today && daysBetween(moneyDate, today) > MONEY_DATE_FREE_DAYS);
  const firstPeriod = /^\d{4}-\d{2}-\d{2}$/.test(moneyDate) ? placeSchedule(installments, moneyDate, new Set())[0] : null;
  const viaName = people.find((p) => String(p.id) === via)?.name;

  if (!canHandOver) {
    return <Card className="max-w-xl"><Alert tone="warn">{self ? 'Kasbon Anda sendiri diserahkan orang lain.' : 'Kasbon ini tidak bisa diserahkan sekarang.'}</Alert></Card>;
  }

  function next() {
    setError(null);
    if (step === 2) {
      if (!source) return setError('Pilih sumber uang.');
      if (moneyDate > today) return setError('Tanggal uang tidak boleh sesudah hari ini.');
      if (needsReason && dateReason.trim().length < 15) return setError('Tulis alasan tanggal uang, paling sedikit 15 huruf.');
    }
    setStep(step + 1);
  }

  async function save() {
    setBusy(true);
    setError(null);
    let proofFileId: string | null = null;
    if (photo) {
      const body = new FormData();
      body.append('file', photo);
      const uploaded = await postJson('/api/files', body);
      if (!uploaded.ok) { setBusy(false); return setError(uploaded.error ?? 'Foto gagal diunggah.'); }
      proofFileId = String(uploaded.data?.id);
    }
    const result = await postJson('/api/advances', {
      kind: 'hand_over', id, sourceId: Number(sourceId), moneyDate, dateReason: needsReason ? dateReason.trim() : null, viaEmployeeId: via ? Number(via) : null, proofFileId,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(String(result.data?.message ?? 'Tersimpan.'), 'ok');
    router.push(`/gaji/kasbon/${id}`);
    router.refresh();
  }

  return (
    <Card className="max-w-xl space-y-4">
      <p className="text-sm text-ink-muted">Langkah {step} dari 3</p>
      {step === 1 && (
        <div className="space-y-1 text-sm">
          <p className="text-xs text-ink-muted">{number}</p>
          <p className="text-2xl font-semibold tabular-nums">{rupiah(amount)}</p>
          <p>untuk <b>{name}</b>, {installments.length} kali potong ({installments.map(rupiah).join(' + ')})</p>
          <p className="text-ink-muted">Disetujui {longDate(approvedOn)} oleh {decidedBy}.</p>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-3">
          <Field id="ho-source" label="Dari mana (sumber uang)">
            <Select id="ho-source" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
              <option value="">Pilih sumber uang</option>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.method === 'TRANSFER' ? 'transfer' : 'tunai'}</option>)}
            </Select>
          </Field>
          <Field id="ho-date" label="Tanggal uang" hint={`Boleh mundur sampai ${MONEY_DATE_FREE_DAYS} hari; lebih jauh, atau sebelum tanggal disetujui, wajib alasan.`}>
            <Input id="ho-date" type="date" value={moneyDate} max={today} onChange={(e) => setMoneyDate(e.target.value)} />
          </Field>
          {needsReason && (
            <Field id="ho-reason" label="Alasan tanggal uang" hint={moneyDate < approvedOn ? 'Uang keluar sebelum kasbon disetujui; ditandai untuk Pemilik dan GM.' : undefined}>
              <Textarea id="ho-reason" value={dateReason} onChange={(e) => setDateReason(e.target.value)} />
            </Field>
          )}
          <Field id="ho-via" label="Diserahkan kepada">
            <Select id="ho-via" value={via} onChange={(e) => setVia(e.target.value)}>
              <option value="">Langsung ke orangnya</option>
              {people.map((p) => <option key={p.id} value={p.id}>Dititipkan lewat {p.name} · {p.branchName}</option>)}
            </Select>
          </Field>
          <Field id="ho-photo" label="Foto bukti (dianjurkan)"><Input id="ho-photo" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></Field>
        </div>
      )}
      {step === 3 && (
        <p className="text-sm">
          {rupiah(amount)} untuk {name} dari {source?.name}, tanggal {longDate(moneyDate)}, {viaName ? `dititipkan lewat ${viaName}` : 'langsung ke orangnya'};
          cicilan pertama masuk slip {firstPeriod ? periodLabel(firstPeriod) : '—'} (atau slip berikutnya bila slip itu sudah ditutup).
        </p>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {step > 1 ? <Button variant="secondary" onClick={() => setStep(step - 1)}>Kembali</Button> : <Link className={buttonClass({ variant: 'secondary' })} href={`/gaji/kasbon/${id}`}>Batal</Link>}
        {step < 3 ? <Button onClick={next}>Lanjut</Button> : <HoldButton loading={busy} onClick={save}>Serahkan</HoldButton>}
      </div>
    </Card>
  );
}
