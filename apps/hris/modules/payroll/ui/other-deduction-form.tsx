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
import { scheduleInstallments } from '../rules/deductions';
import { longDate, rupiah } from '../rules/salary';

/** GAJ-L17 Ajukan Potongan Lain (4 langkah). HR = usulan; Pemilik/GM langsung berjalan. */
export function OtherDeductionForm({ people, types, maxInstallments, firstPeriod, direct }: {
  people: { id: number; name: string; branchName: string }[]; types: { id: number; name: string }[]; maxInstallments: number; firstPeriod: string; direct: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [employeeId, setEmployeeId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [count, setCount] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const value = Number(amount || 0);
  const plan = value > 0 ? scheduleInstallments(value, Number(count), firstPeriod) : [];
  const person = people.find((p) => String(p.id) === employeeId);
  const type = types.find((t) => String(t.id) === typeId);

  function next() {
    setError(null);
    if (step === 1 && !employeeId) return setError('Pilih orangnya.');
    if (step === 2 && !typeId) return setError('Pilih jenis.');
    if (step === 2 && (!value || value <= 0)) return setError('Nominal harus rupiah bulat lebih dari 0.');
    if (step === 2 && reason.trim().length < 15) return setError('Alasan paling sedikit 15 huruf.');
    setStep(step + 1);
  }

  async function save() {
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
    const result = await postJson('/api/payroll', { kind: 'other_record', employeeId: Number(employeeId), typeId: Number(typeId), amount: value, reason: reason.trim(), installments: Number(count), attachmentId });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(direct ? 'Potongan Lain berjalan. Orangnya diberi tahu.' : String(result.data?.message ?? 'Usulan terkirim.'), 'ok');
    router.push('/potongan/lain');
    router.refresh();
  }

  return (
    <Card className="max-w-2xl space-y-4">
      <p className="text-sm text-ink-muted">Langkah {step} dari 4 · {direct ? 'langsung berjalan' : 'usulan ke Pemilik atau GM'}</p>
      {step === 1 && (
        <Field id="of-person" label="Orang" hint="Pemilik, GM, dan diri sendiri tidak bisa dipilih.">
          <Select id="of-person" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Pilih orang</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.branchName}</option>)}
          </Select>
        </Field>
      )}
      {step === 2 && (
        <div className="space-y-3">
          <Field id="of-type" label="Jenis">
            <Select id="of-type" value={typeId} onChange={(e) => setTypeId(e.target.value)}><option value="">Pilih jenis</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
          </Field>
          <Field id="of-amount" label="Nominal (rupiah)"><Input id="of-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} /></Field>
          {value > 0 && <p className="text-sm tabular-nums">{rupiah(value)}</p>}
          <Field id="of-reason" label="Alasan" hint="Paling sedikit 15 huruf."><Textarea id="of-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <Field id="of-photo" label="Foto (bila ada)"><Input id="of-photo" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></Field>
        </div>
      )}
      {step === 3 && (
        <div className="space-y-3 text-sm">
          <Field id="of-count" label="Kali potong">
            <Select id="of-count" value={count} onChange={(e) => setCount(e.target.value)}>
              {Array.from({ length: maxInstallments }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} kali</option>)}
            </Select>
          </Field>
          <ul>{plan.map((p) => <li key={p.sequence}>Slip periode {longDate(p.periodStart)}: <b className="tabular-nums">{rupiah(p.amount)}</b></li>)}</ul>
          <p className="text-ink-muted">Cicilan pertama di slip periode saat disahkan; dibagi rata, sisanya di cicilan terakhir.</p>
        </div>
      )}
      {step === 4 && (
        <div className="space-y-2 text-sm">
          <p><b>{type?.name}</b> untuk <b>{person?.name}</b>: <b className="tabular-nums">{rupiah(value)}</b>, {count} kali.</p>
          <ul>{plan.map((p) => <li key={p.sequence}>Slip {longDate(p.periodStart)}: {rupiah(p.amount)}</li>)}</ul>
          <p className="text-ink-muted">Alasan: {reason}</p>
          <p className="text-ink-muted">{direct ? 'Langsung berjalan.' : 'Terkirim sebagai usulan; belum dipotong sampai disahkan.'} Orangnya diberi tahu dan boleh mengajukan keberatan paling lambat 3 hari.</p>
        </div>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {step > 1 ? <Button variant="secondary" onClick={() => { setError(null); setStep(step - 1); }}>Kembali</Button> : <Link className={buttonClass({ variant: 'secondary' })} href="/potongan/lain">Batal</Link>}
        {step < 4 ? <Button onClick={next}>Lanjut</Button> : <HoldButton loading={busy} onClick={save}>{direct ? 'Simpan' : 'Kirim usulan'}</HoldButton>}
      </div>
    </Card>
  );
}
