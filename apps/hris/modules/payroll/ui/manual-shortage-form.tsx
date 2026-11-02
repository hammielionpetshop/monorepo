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
import { longDate, rupiah } from '../rules/salary';

type Person = { employeeId: number; name: string };

/** Catat Minus Kas (4 langkah, GAJ-L15/GAJ-79). Pemilik/GM langsung berlaku; HR dan Finance mengirim usulan. */
export function ManualShortageForm({ branches, today, direct }: { branches: { id: number; name: string }[]; today: string; direct: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [branchId, setBranchId] = useState('');
  const [occurredOn, setOccurredOn] = useState(today);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState<'named' | 'unnamed'>('named');
  const [named, setNamed] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [candidates, setCandidates] = useState<{ present: Person[]; named: Person[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const value = Number(amount || 0);
  const branchName = branches.find((b) => String(b.id) === branchId)?.name ?? '';
  const each = candidates?.present.length ? Math.floor(value / candidates.present.length) : 0;

  async function next() {
    setError(null);
    if (step === 1) {
      if (!branchId || !occurredOn || occurredOn > today) return setError('Pilih cabang dan tanggal kejadian (tidak di masa depan).');
      setBusy(true);
      const result = await postJson('/api/payroll', { kind: 'manual_candidates', branchId: Number(branchId), occurredOn });
      setBusy(false);
      if (!result.ok) return setError(result.error ?? 'Gagal memuat orang.');
      setCandidates(result.data as unknown as { present: Person[]; named: Person[] });
    }
    if (step === 2) {
      if (!value || value <= 0) return setError('Nilai harus rupiah bulat lebih dari 0.');
      if (reason.trim().length < 15) return setError('Alasan paling sedikit 15 huruf dan menjelaskan kenapa tidak lewat shift POS.');
    }
    if (step === 3) {
      if (mode === 'named' && !named) return setError('Pilih nama penanggung.');
      if (mode === 'unnamed' && !candidates?.present.length) return setError('Tidak ada yang hadir. Pilih nama penanggung, atau batalkan.');
    }
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
    const result = await postJson('/api/payroll', {
      kind: 'manual_record', branchId: Number(branchId), occurredOn, amount: value, reason: reason.trim(),
      namedEmployeeId: mode === 'named' ? Number(named) : null, attachmentId,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(direct ? 'Minus kas berlaku. Penanggung diberi tahu.' : String(result.data?.message ?? 'Usulan terkirim.'), 'ok');
    router.push('/potongan/minus-kas?tab=manual');
    router.refresh();
  }

  const namedName = candidates?.named.find((p) => String(p.employeeId) === named)?.name;
  return (
    <Card className="max-w-2xl space-y-4">
      <p className="text-sm text-ink-muted">Langkah {step} dari 4 · {direct ? 'langsung berlaku' : 'usulan ke Pemilik atau GM'}</p>
      {step === 1 && (
        <div className="space-y-3">
          <Field id="mf-branch" label="Cabang">
            <Select id="mf-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Pilih cabang</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field id="mf-date" label="Tanggal kejadian"><Input id="mf-date" type="date" max={today} value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} /></Field>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-3">
          <Field id="mf-amount" label="Nilai (rupiah)"><Input id="mf-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} /></Field>
          {value > 0 && <p className="text-sm tabular-nums">{rupiah(value)}</p>}
          <Field id="mf-reason" label="Alasan" hint="Paling sedikit 15 huruf; jelaskan kenapa tidak lewat shift POS.">
            <Textarea id="mf-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
      )}
      {step === 3 && candidates && (
        <div className="space-y-3 text-sm">
          <label className="flex items-center gap-2"><input type="radio" checked={mode === 'named'} onChange={() => setMode('named')} /> Bernama (ditanggung penuh satu orang)</label>
          {mode === 'named' && (
            <Select aria-label="Penanggung" value={named} onChange={(e) => setNamed(e.target.value)}>
              <option value="">Pilih orang yang ditempatkan atau hadir di cabang itu</option>
              {candidates.named.map((p) => <option key={p.employeeId} value={p.employeeId}>{p.name}</option>)}
            </Select>
          )}
          <label className="flex items-center gap-2"><input type="radio" checked={mode === 'unnamed'} onChange={() => setMode('unnamed')} /> Tanpa nama (dibagi rata ke yang hadir)</label>
          {mode === 'unnamed' && (candidates.present.length
            ? <p>Yang hadir dengan jabatan bertanda: {candidates.present.map((p) => p.name).join(', ')} — masing-masing {rupiah(each)}.</p>
            : <Alert tone="warn">Tidak ada yang hadir. Pilih nama penanggung, atau batalkan.</Alert>)}
          <Field id="mf-photo" label="Foto (bila ada)"><Input id="mf-photo" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></Field>
        </div>
      )}
      {step === 4 && (
        <div className="space-y-2 text-sm">
          <p>Minus kas <b className="tabular-nums">{rupiah(value)}</b> di <b>{branchName}</b>, {longDate(occurredOn)}.</p>
          <p>{mode === 'named' ? <>Ditanggung penuh <b>{namedName}</b>.</> : <>Dibagi rata ke {candidates?.present.length} orang yang hadir, masing-masing {rupiah(each)}; sisa pembulatan ditanggung kantor.</>}</p>
          <p className="text-ink-muted">Alasan: {reason}</p>
          <p className="text-ink-muted">{direct ? 'Langsung berlaku; penanggung diberi tahu.' : 'Terkirim sebagai usulan ke Pemilik atau GM.'}</p>
        </div>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {step > 1
          ? <Button variant="secondary" onClick={() => { setError(null); setStep(step - 1); }}>Kembali</Button>
          : <Link className={buttonClass({ variant: 'secondary' })} href="/potongan/minus-kas?tab=manual">Batal</Link>}
        {step < 4 ? <Button loading={busy} onClick={next}>Lanjut</Button> : <HoldButton loading={busy} onClick={save}>{direct ? 'Simpan' : 'Kirim usulan'}</HoldButton>}
      </div>
    </Card>
  );
}
