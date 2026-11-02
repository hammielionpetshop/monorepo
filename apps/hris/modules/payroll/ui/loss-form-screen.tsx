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
import { LossSplitTable, type SplitView } from './loss-split-table';

/** GAJ-L13 Catat Kehilangan Barang (4 langkah). Pemilik/GM langsung berlaku; HR mengirim usulan. */
export function LossFormScreen({ branches, today, direct }: { branches: { id: number; name: string }[]; today: string; direct: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [branchId, setBranchId] = useState('');
  const [foundOn, setFoundOn] = useState(today);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [split, setSplit] = useState<SplitView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const value = Number(amount || 0);
  const branchName = branches.find((b) => String(b.id) === branchId)?.name ?? '';

  async function next() {
    setError(null);
    if (step === 1 && (!branchId || !foundOn)) return setError('Pilih cabang dan tanggal ditemukan.');
    if (step === 1 && foundOn > today) return setError('Tanggal ditemukan tidak boleh di masa depan.');
    if (step === 2 && (!value || value <= 0)) return setError('Nilai harus rupiah bulat lebih dari 0.');
    if (step === 2 && description.trim().length < 10) return setError('Keterangan paling sedikit 10 huruf.');
    if (step === 3) {
      if (!photo) return setError('Foto hasil opname wajib dilampirkan.');
      setBusy(true);
      const result = await postJson('/api/payroll', { kind: 'loss_preview', branchId: Number(branchId), foundOn, amount: value });
      setBusy(false);
      if (!result.ok) return setError(result.error ?? 'Pratinjau gagal.');
      setSplit(result.data?.split as SplitView);
    }
    setStep(step + 1);
  }

  async function save() {
    if (!photo) return;
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.append('file', photo);
    const uploaded = await postJson('/api/files', body);
    if (!uploaded.ok) { setBusy(false); return setError(uploaded.error ?? 'Foto gagal diunggah.'); }
    const result = await postJson('/api/payroll', {
      kind: 'loss_record', branchId: Number(branchId), foundOn, amount: value, description: description.trim(), attachmentId: String(uploaded.data?.id),
    });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(direct ? 'Kehilangan barang berlaku. Yang menanggung diberi tahu bagiannya.' : String(result.data?.message ?? 'Usulan terkirim.'), 'ok');
    router.push('/potongan/kehilangan-barang');
    router.refresh();
  }

  return (
    <Card className="max-w-2xl space-y-4">
      <p className="text-sm text-ink-muted">Langkah {step} dari 4 · {direct ? 'langsung berlaku' : 'usulan ke Pemilik atau GM'}</p>
      {step === 1 && (
        <div className="space-y-3">
          <Field id="lf-branch" label="Cabang">
            <Select id="lf-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Pilih cabang</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field id="lf-date" label="Tanggal ditemukan" hint="Tanggal hasil opname. Kehilangan masuk periode tanggal ini.">
            <Input id="lf-date" type="date" max={today} value={foundOn} onChange={(e) => setFoundOn(e.target.value)} />
          </Field>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-3">
          <Field id="lf-amount" label="Nilai (rupiah)">
            <Input id="lf-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
          </Field>
          {value > 0 && <p className="text-sm tabular-nums">{rupiah(value)}</p>}
          <Field id="lf-desc" label="Keterangan" hint='Paling sedikit 10 huruf, misalnya "hasil opname November: makanan kucing".'>
            <Textarea id="lf-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
      )}
      {step === 3 && (
        <Field id="lf-photo" label="Foto hasil opname (wajib)">
          <Input id="lf-photo" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        </Field>
      )}
      {step === 4 && split && (
        <div className="space-y-3 text-sm">
          <p>Kehilangan <b className="tabular-nums">{rupiah(value)}</b> di <b>{branchName}</b>, ditemukan {longDate(foundOn)}.</p>
          <p className="text-ink-muted">{description}</p>
          <LossSplitTable split={split} amount={value} />
          {!split.shares.length && <Alert tone="warn">Tidak ada yang ikut menanggung di cabang ini pada periode itu. Seluruhnya ditanggung kantor.{direct ? '' : ' Usulan HR akan ditolak; minta Pemilik atau GM yang mencatat.'}</Alert>}
          <p className="text-ink-muted">{direct ? 'Langsung berlaku; tiap orang diberi tahu bagiannya dan pemilik lain diberi tahu.' : 'Terkirim sebagai usulan ke Pemilik atau GM. Belum dipotong sampai disahkan.'}</p>
        </div>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {step > 1
          ? <Button variant="secondary" onClick={() => { setError(null); setStep(step - 1); }}>Kembali</Button>
          : <Link className={buttonClass({ variant: 'secondary' })} href="/potongan/kehilangan-barang">Batal</Link>}
        {step < 4 ? <Button loading={busy} onClick={next}>Lanjut</Button> : <HoldButton loading={busy} onClick={save}>{direct ? 'Simpan' : 'Kirim usulan'}</HoldButton>}
      </div>
    </Card>
  );
}
