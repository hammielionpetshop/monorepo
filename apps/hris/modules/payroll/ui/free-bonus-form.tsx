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
import { BONUS_FUND_LABELS, type BonusFund } from '../rules/funds';
import { longDate, rupiah } from '../rules/salary';

/** GAJ-L22 Catat Bonus Bebas (4 langkah). HR = usulan ke Pemilik/GM; Pemilik/GM langsung Disahkan. */
export function FreeBonusForm({ people, types, today, direct, disciplineAvailable }: {
  people: { id: number; name: string; branchName: string }[]; types: { id: number; name: string; defaultFund: string }[];
  today: string; direct: boolean; disciplineAvailable: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [employeeId, setEmployeeId] = useState('');
  const [typeId, setTypeId] = useState(types.length === 1 ? String(types[0].id) : '');
  const [occurredOn, setOccurredOn] = useState(today);
  const [amount, setAmount] = useState('');
  const [fund, setFund] = useState<BonusFund>((types.length === 1 ? types[0].defaultFund : 'OFFICE') as BonusFund);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const value = Number(amount || 0);
  const person = people.find((p) => String(p.id) === employeeId);
  const type = types.find((t) => String(t.id) === typeId);
  const short = fund === 'DISCIPLINE_FUND' && value > disciplineAvailable;

  function pickType(id: string) {
    setTypeId(id);
    const t = types.find((x) => String(x.id) === id);
    if (t) setFund(t.defaultFund as BonusFund);
  }

  function next() {
    setError(null);
    if (step === 1 && !employeeId) return setError('Pilih orangnya.');
    if (step === 2 && !typeId) return setError('Pilih jenis bonus.');
    if (step === 2 && (!value || value <= 0)) return setError('Nominal harus rupiah bulat lebih dari 0.');
    if (step === 2 && (!occurredOn || occurredOn > today)) return setError('Tanggal bonus tidak boleh di masa depan.');
    if (step === 3 && reason.trim().length < 15) return setError('Alasan paling sedikit 15 huruf.');
    setStep(step + 1);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/payroll', { kind: 'free_record', employeeId: Number(employeeId), typeId: Number(typeId), amount: value, occurredOn, fund, reason: reason.trim() });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(direct ? 'Bonus disahkan. Orangnya diberi tahu.' : String(result.data?.message ?? 'Usulan terkirim.'), 'ok');
    router.push('/bonus/persetujuan?tab=free');
    router.refresh();
  }

  return (
    <Card className="max-w-2xl space-y-4">
      <p className="text-sm text-ink-muted">Langkah {step} dari 4 · {direct ? 'langsung disahkan' : 'usulan ke Pemilik atau GM'}</p>
      {step === 1 && (
        <Field id="fb-person" label="Orang" hint="Pemilik, GM, dan diri sendiri tidak bisa dipilih.">
          <Select id="fb-person" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Pilih orang</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.branchName}</option>)}
          </Select>
        </Field>
      )}
      {step === 2 && (
        <div className="space-y-3">
          <Field id="fb-type" label="Jenis">
            <Select id="fb-type" value={typeId} onChange={(e) => pickType(e.target.value)}>
              <option value="">Pilih jenis</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
          <Field id="fb-date" label="Tanggal" hint="Bonus masuk slip periode tanggal ini (atau periode berikutnya bila slipnya sudah ditutup).">
            <Input id="fb-date" type="date" max={today} value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} />
          </Field>
          <Field id="fb-amount" label="Nominal (rupiah)"><Input id="fb-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} /></Field>
          {value > 0 && <p className="text-sm tabular-nums">{rupiah(value)}</p>}
          <Field id="fb-fund" label="Sumber dana">
            <Select id="fb-fund" value={fund} onChange={(e) => setFund(e.target.value as BonusFund)}>
              {(Object.keys(BONUS_FUND_LABELS) as BonusFund[]).map((f) => <option key={f} value={f}>{BONUS_FUND_LABELS[f]}</option>)}
            </Select>
          </Field>
          {fund === 'DISCIPLINE_FUND' && (
            <Alert tone={short ? 'warn' : 'info'}>
              Dana Disiplin tersedia sekarang {rupiah(Math.max(disciplineAvailable, 0))}.{short ? ' Tidak cukup untuk nominal ini; pengesahan akan ditolak.' : ''}
            </Alert>
          )}
        </div>
      )}
      {step === 3 && (
        <Field id="fb-reason" label="Alasan" hint="Paling sedikit 15 huruf. Orangnya membaca alasan ini.">
          <Textarea id="fb-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      )}
      {step === 4 && (
        <div className="space-y-2 text-sm">
          <p><b>{type?.name}</b> untuk <b>{person?.name}</b> ({person?.branchName}): <b className="tabular-nums">{rupiah(value)}</b>.</p>
          <p>Tanggal {longDate(occurredOn)} · dari <b>{BONUS_FUND_LABELS[fund]}</b>.</p>
          <p className="text-ink-muted">Alasan: {reason}</p>
          <p className="text-ink-muted">{direct ? 'Langsung disahkan; orangnya diberi tahu dan pemilik lain diberi tahu.' : 'Terkirim sebagai usulan ke kotak Persetujuan; belum masuk slip sampai Pemilik atau GM mengesahkan.'}</p>
        </div>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {step > 1 ? <Button variant="secondary" onClick={() => { setError(null); setStep(step - 1); }}>Kembali</Button> : <Link className={buttonClass({ variant: 'secondary' })} href="/bonus/persetujuan?tab=free">Batal</Link>}
        {step < 4 ? <Button onClick={next}>Lanjut</Button> : <HoldButton loading={busy} onClick={save}>{direct ? 'Simpan dan sahkan' : 'Kirim usulan'}</HoldButton>}
      </div>
    </Card>
  );
}
