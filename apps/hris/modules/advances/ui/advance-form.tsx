'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { amountProblem, longDate, rupiah, splitInstallments, tenureMessage, type AdvanceRules } from '../rules/advance';

type Person = { id: number; name: string; branchName: string; tenureOk: boolean; tenureFrom: string };

/**
 * DRV-L24 Ajukan Kasbon (3 langkah, untuk diri sendiri) dan DRV-L25 Isikan Kasbon atas Nama (4 langkah, langkah 1 = untuk siapa).
 * Batas orang dan sisa dana diperiksa server; angkanya tidak pernah dikirim ke layar ini (DRV-56).
 */
export function AdvanceForm({ mode, rules, quick, blocked, people, initial, resubmittedFromId }: {
  mode: 'self' | 'other'; rules: AdvanceRules; quick: number[]; blocked: string | null; people: Person[];
  initial?: { amount: number; installments: number; reason: string } | null; resubmittedFromId?: number | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const offset = mode === 'other' ? 1 : 0;
  const total = 3 + offset;
  const [step, setStep] = useState(1);
  const [personId, setPersonId] = useState('');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [count, setCount] = useState(String(initial?.installments ?? 1));
  const [reason, setReason] = useState(initial?.reason ?? '');
  const [error, setError] = useState<string | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const value = Number(amount || 0);
  const plan = value > 0 ? splitInstallments(value, Number(count)) : [];
  const person = people.find((p) => String(p.id) === personId);
  const back = mode === 'other' ? '/gaji/kasbon' : '/kasbon';

  if (blocked) {
    return (
      <Card className="max-w-xl space-y-3">
        <Alert tone="warn">{blocked}</Alert>
        <Link href={back} className={buttonClass({ variant: 'secondary' })}>Kembali</Link>
      </Card>
    );
  }

  const at = step - offset;

  function next() {
    setError(null);
    if (mode === 'other' && step === 1) {
      if (!person) return setError('Pilih karyawan.');
      if (!person.tenureOk) return setError(`${tenureMessage(rules.minTenureMonths)} (${person.name} baru bisa mulai ${longDate(person.tenureFrom)}.)`);
    }
    if (at === 1) {
      const problem = amountProblem(value, rules);
      if (problem) return setError(problem);
    }
    if (at === 2 && reason.trim().length < rules.reasonMin) return setError(`Alasan paling sedikit ${rules.reasonMin} huruf.`);
    setStep(step + 1);
  }

  async function send() {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/advances', {
      kind: 'submit', employeeId: mode === 'other' ? Number(personId) : null, amount: value, installments: Number(count), reason: reason.trim(),
      resubmittedFromId: resubmittedFromId ?? null,
    });
    setBusy(false);
    if (!result.ok) return setRefused(result.error ?? 'Pengajuan ditolak.');
    toast(mode === 'other'
      ? `Pengajuan kasbon ${person?.name} terkirim. ${person?.name} diberi tahu dan bisa menariknya. Menunggu diperiksa Finance.`
      : 'Kasbon diproses paling cepat 2 hari setelah pengajuan, tidak bisa langsung cair. Menunggu diperiksa Finance.', 'ok');
    router.push(back);
    router.refresh();
  }

  return (
    <Card className="max-w-xl space-y-4">
      <p className="text-sm text-ink-muted">Langkah {step} dari {total}</p>
      {mode === 'other' && step === 1 && (
        <Field id="adv-person" label="Untuk siapa" hint="Diri Anda sendiri tidak bisa dipilih; kasbon Anda lewat Kasbon Saya.">
          <Select id="adv-person" value={personId} onChange={(e) => setPersonId(e.target.value)}>
            <option value="">Pilih karyawan</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.branchName}{p.tenureOk ? '' : ' (belum 6 bulan)'}</option>)}
          </Select>
        </Field>
      )}
      {at === 1 && (
        <div className="space-y-3">
          <Field id="adv-amount" label="Berapa" hint={`Kelipatan ${rupiah(rules.amountStep)}, paling sedikit ${rupiah(rules.amountMin)}.`}>
            <Input id="adv-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <div className="flex flex-wrap gap-2">
            {quick.map((q) => (
              <Button key={q} size="sm" variant={value === q ? 'primary' : 'secondary'} onClick={() => setAmount(String(q))}>{rupiah(q)}</Button>
            ))}
          </div>
          <Field id="adv-count" label="Berapa kali potong">
            <Select id="adv-count" value={count} onChange={(e) => setCount(e.target.value)}>
              {Array.from({ length: rules.maxInstallments }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} kali</option>)}
            </Select>
          </Field>
          {value > 0 && (
            <p className="text-sm">
              {count} kali potong: <b className="tabular-nums">{plan.map(rupiah).join(' + ')}</b> tiap gajian.
              <span className="block text-ink-muted">Angka ini bisa diubah saat diperiksa. Yang berlaku adalah yang disetujui.</span>
            </p>
          )}
        </div>
      )}
      {at === 2 && (
        <Field id="adv-reason" label="Alasan" hint={`Paling sedikit ${rules.reasonMin} huruf · ${reason.trim().length} huruf`}>
          <Textarea id="adv-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      )}
      {at === 3 && (
        <div className="space-y-2 text-sm">
          <p>
            Kasbon <b className="tabular-nums">{rupiah(value)}</b>{mode === 'other' && person ? <> untuk <b>{person.name}</b></> : null}, {count} kali potong,
            dipotong dari gaji sesudah uang diberikan.
          </p>
          <p className="text-ink-muted">Alasan: {reason.trim()}</p>
          <p className="text-ink-muted">Kasbon diproses paling cepat 2 hari setelah pengajuan, tidak bisa langsung cair.</p>
        </div>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {step > 1
          ? <Button variant="secondary" onClick={() => { setError(null); setStep(step - 1); }}>Kembali</Button>
          : <Link className={buttonClass({ variant: 'secondary' })} href={back}>Batal</Link>}
        {step < total ? <Button onClick={next}>Lanjut</Button> : <HoldButton loading={busy} onClick={send}>Kirim</HoldButton>}
      </div>
      <Dialog open={refused !== null} onClose={() => setRefused(null)} title="Kasbon belum bisa diajukan">
        <div className="space-y-3">
          <p>{refused}</p>
          <div className="flex justify-end"><Button onClick={() => setRefused(null)}>OK, paham</Button></div>
        </div>
      </Dialog>
    </Card>
  );
}
