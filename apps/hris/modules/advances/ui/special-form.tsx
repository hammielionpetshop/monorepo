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
import { rupiah, splitInstallments } from '../rules/advance';

/**
 * DRV-L37 Buat Kasbon Khusus (4 langkah): untuk siapa, kejadian, berapa, periksa. Pemilik/GM, bukan untuk dirinya.
 * Tanpa syarat 6 bulan, batas orang, dan dana (DRV-76). Lahir Disetujui; "Buat dan serahkan sekarang" ke Serah Uang.
 */
export function SpecialAdvanceForm({ people, kinds, amountStep, reasonMin, maxInstallments }: {
  people: { id: number; name: string; branchName: string }[]; kinds: string[]; amountStep: number; reasonMin: number; maxInstallments: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [employeeId, setEmployeeId] = useState('');
  const [eventKind, setEventKind] = useState('');
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [installments, setInstallments] = useState('3');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const value = Number(amount) || 0;
  const count = Number(installments) || 1;
  const person = people.find((p) => String(p.id) === employeeId);

  function next() {
    setError(null);
    if (step === 1 && !person) return setError('Pilih karyawan.');
    if (step === 2) {
      if (!eventKind) return setError('Pilih jenis kejadian.');
      if (reason.trim().length < reasonMin) return setError(`Alasan paling sedikit ${reasonMin} huruf.`);
    }
    if (step === 3 && (value <= 0 || value % amountStep !== 0)) return setError(`Nominal harus kelipatan ${rupiah(amountStep)}.`);
    setStep(step + 1);
  }

  async function save(handNow: boolean) {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/advances', { kind: 'special', employeeId: Number(employeeId), eventKind, reason: reason.trim(), amount: value, installments: count });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(String(result.data?.message ?? 'Tersimpan.'), 'ok');
    const id = Number(result.data?.id);
    router.push(handNow ? `/gaji/kasbon/${id}/serahkan` : `/gaji/kasbon/${id}`);
    router.refresh();
  }

  if (!people.length) return <Card className="max-w-xl"><Alert tone="warn">Belum ada karyawan aktif berslip bulanan yang bisa diberi Kasbon Khusus.</Alert></Card>;

  return (
    <Card className="max-w-xl space-y-4">
      <p className="text-sm text-ink-muted">Langkah {step} dari 4</p>
      {step === 1 && (
        <Field id="sp-person" label="Untuk siapa" hint="Karyawan aktif berslip bulanan; bukan untuk Anda sendiri.">
          <Select id="sp-person" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Pilih karyawan</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.branchName}</option>)}
          </Select>
        </Field>
      )}
      {step === 2 && (
        <>
          <Field id="sp-kind" label="Jenis kejadian">
            <Select id="sp-kind" value={eventKind} onChange={(e) => setEventKind(e.target.value)}>
              <option value="">Pilih</option>
              {kinds.map((k) => <option key={k} value={k}>{k}</option>)}
            </Select>
          </Field>
          <Field id="sp-reason" label="Alasan" hint={`Paling sedikit ${reasonMin} huruf.`}><Textarea id="sp-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </>
      )}
      {step === 3 && (
        <>
          <Field id="sp-amount" label="Nominal" hint={`Kelipatan ${rupiah(amountStep)}; tanpa batas atas.`}>
            <Input id="sp-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} />
          </Field>
          <Field id="sp-count" label="Kali potong">
            <Select id="sp-count" value={installments} onChange={(e) => setInstallments(e.target.value)}>
              {Array.from({ length: maxInstallments }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} kali</option>)}
            </Select>
          </Field>
          {value > 0 && <p className="text-sm text-ink-muted">{count} kali potong: {splitInstallments(value, count).map(rupiah).join(' + ')}</p>}
        </>
      )}
      {step === 4 && (
        <div className="space-y-1 text-sm">
          <p>Kasbon Khusus <b>{rupiah(value)}</b> untuk <b>{person?.name}</b> ({eventKind}), {count} kali potong.</p>
          <p className="text-ink-muted">Langsung Disetujui, belum diberikan. Tidak dihitung di batas orang dan Dana Kasbon. Para pemilik dan orangnya diberi tahu.</p>
        </div>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {step > 1 ? <Button variant="secondary" onClick={() => setStep(step - 1)}>Kembali</Button> : <Link className={buttonClass({ variant: 'secondary' })} href="/gaji/kasbon">Batal</Link>}
        {step < 4 ? <Button onClick={next}>Lanjut</Button> : (
          <>
            <HoldButton loading={busy} onClick={() => save(true)}>Buat dan serahkan sekarang</HoldButton>
            <Button variant="secondary" loading={busy} onClick={() => save(false)}>Buat saja</Button>
          </>
        )}
      </div>
    </Card>
  );
}
