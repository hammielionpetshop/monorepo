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
import { FUND_LABELS, fundChangeProblem, type Fund, type FundChange, type FundEntryKind, type FundState } from '../rules/funds';
import { rupiah } from '../rules/salary';

type ManualKind = Exclude<FundEntryKind, 'SLIP' | 'OFF_SLIP'>;

const KIND_TEXT: Record<ManualKind, string> = {
  OPENING: 'Isi saldo awal bawaan sistem lama (sekali per dana, bertanggal hari pindah; SIS-33: dihitung dari slip periode terakhir sistem lama)',
  ADJUSTMENT: 'Sesuaikan (tambah atau kurang)',
  TRANSFER: 'Pindah Dana Tidak Hadir ke Dana Disiplin',
};

/** GAJ-L26 Pindah dan Sesuaikan Dana (3 langkah, hanya Pemilik/GM). */
export function FundChangeForm({ state, initialKind, initialFund }: { state: FundState; initialKind: ManualKind; initialFund: Fund }) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [kind, setKind] = useState<ManualKind>(initialKind);
  const [fund, setFund] = useState<Fund>(initialFund);
  const [direction, setDirection] = useState<'PLUS' | 'MINUS'>('PLUS');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const value = Number(amount || 0);
  const signedValue = kind === 'ADJUSTMENT' && direction === 'MINUS' ? -value : value;
  const change: FundChange = kind === 'TRANSFER' ? { kind, amount: value } : { kind, fund, amount: signedValue };
  const current = (f: Fund) => (f === 'DISCIPLINE' ? state.discipline.balance : state.absence.balance);

  function next() {
    setError(null);
    if (step === 2) {
      const problem = fundChangeProblem(change, state, reason);
      if (problem) return setError(problem);
    }
    setStep(step + 1);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/payroll', { kind: 'fund_change', change: kind, fund: kind === 'TRANSFER' ? null : fund, amount: kind === 'TRANSFER' ? value : signedValue, reason: reason.trim() });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast('Dana diperbarui. Pemilik lain diberi tahu.', 'ok');
    router.push('/dana');
    router.refresh();
  }

  const summary = kind === 'TRANSFER'
    ? <>Pindah <b className="tabular-nums">{rupiah(value)}</b> dari Dana Tidak Hadir (saldo {rupiah(state.absence.balance)} → {rupiah(state.absence.balance - value)}) ke Dana Disiplin (saldo {rupiah(state.discipline.balance)} → {rupiah(state.discipline.balance + value)}).</>
    : <>{kind === 'OPENING' ? 'Saldo awal' : 'Penyesuaian'} {FUND_LABELS[fund]}: <b className="tabular-nums">{signedValue < 0 ? `−${rupiah(-signedValue)}` : rupiah(signedValue)}</b>. Saldo {rupiah(current(fund))} → {rupiah(current(fund) + signedValue)}.</>;

  return (
    <Card className="max-w-2xl space-y-4">
      <p className="text-sm text-ink-muted">Langkah {step} dari 3</p>
      {step === 1 && (
        <div className="space-y-3">
          <Field id="fc-kind" label="Yang dilakukan">
            <Select id="fc-kind" value={kind} onChange={(e) => setKind(e.target.value as ManualKind)}>
              {(Object.keys(KIND_TEXT) as ManualKind[]).map((k) => <option key={k} value={k}>{KIND_TEXT[k]}</option>)}
            </Select>
          </Field>
          {kind !== 'TRANSFER' && (
            <Field id="fc-fund" label="Dana">
              <Select id="fc-fund" value={fund} onChange={(e) => setFund(e.target.value as Fund)}>
                {(Object.keys(FUND_LABELS) as Fund[]).map((f) => <option key={f} value={f}>{FUND_LABELS[f]} (saldo {rupiah(current(f))})</option>)}
              </Select>
            </Field>
          )}
          {kind === 'TRANSFER' && <p className="text-sm">Saldo berjalan Dana Tidak Hadir {rupiah(state.absence.balance)}; paling banyak dipindah {rupiah(Math.max(state.absence.balance, 0))}.</p>}
        </div>
      )}
      {step === 2 && (
        <div className="space-y-3">
          {kind === 'ADJUSTMENT' && (
            <Field id="fc-dir" label="Arah">
              <Select id="fc-dir" value={direction} onChange={(e) => setDirection(e.target.value as 'PLUS' | 'MINUS')}>
                <option value="PLUS">Tambah</option><option value="MINUS">Kurang</option>
              </Select>
            </Field>
          )}
          <Field id="fc-amount" label="Nominal (rupiah)"><Input id="fc-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} /></Field>
          {value > 0 && <p className="text-sm tabular-nums">{rupiah(value)}</p>}
          {kind === 'ADJUSTMENT' && fund === 'DISCIPLINE' && direction === 'MINUS' && (
            <p className="text-sm text-ink-muted">Terpesan bonus {rupiah(state.discipline.reserved)}; paling banyak dikurangi {rupiah(Math.max(state.discipline.available, 0))}.</p>
          )}
          <Field id="fc-reason" label="Alasan" hint="Paling sedikit 15 huruf."><Textarea id="fc-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </div>
      )}
      {step === 3 && (
        <div className="space-y-2 text-sm">
          <p>{summary}</p>
          <p className="text-ink-muted">Alasan: {reason}</p>
          <p className="text-ink-muted">Mutasi tidak bisa dihapus; salah isi dibetulkan dengan penyesuaian baru. Pemilik lain diberi tahu.</p>
        </div>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {step > 1 ? <Button variant="secondary" onClick={() => { setError(null); setStep(step - 1); }}>Kembali</Button> : <Link className={buttonClass({ variant: 'secondary' })} href="/dana">Batal</Link>}
        {step < 3 ? <Button onClick={next}>Lanjut</Button> : <HoldButton loading={busy} onClick={save}>Simpan</HoldButton>}
      </div>
    </Card>
  );
}
