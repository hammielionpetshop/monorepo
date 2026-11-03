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
import { monthlyTotal, rupiah, type SalaryLine } from '../rules/salary';
import type { salaryCorrectionScreen } from '../server/salary-correction';

type Data = NonNullable<Awaited<ReturnType<typeof salaryCorrectionScreen>>>;
const OFFICE = 'office';

/** Pembetulan gaji periode lalu (GAJ-112), Pemilik/GM: periode tertutup, paket yang benar, keberatan yang ditunjuk atau alasan. */
export function SalaryCorrectionForm({ data }: { data: Data }) {
  const router = useRouter();
  const toast = useToast();
  const [period, setPeriod] = useState(data.chosenPeriod ?? data.periods[0]?.start ?? '');
  const current = data.periods.find((p) => p.start === period) ?? null;
  const [lines, setLines] = useState<{ componentTypeId: number; amount: string }[]>((current?.lines ?? []).map((l) => ({ componentTypeId: l.componentTypeId, amount: String(l.amount) })));
  const [adding, setAdding] = useState('');
  const [objection, setObjection] = useState(data.chosenObjectionId ? String(data.chosenObjectionId) : data.objections.length ? '' : OFFICE);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const back = `/gaji/${data.person.id}`;
  const typeName = new Map(data.types.map((t) => [t.id, t.name]));
  const parsed: SalaryLine[] = lines.map((l) => ({ componentTypeId: l.componentTypeId, amount: Number(l.amount.replace(/\D/g, '')) }));
  const unused = data.types.filter((t) => !lines.some((l) => l.componentTypeId === t.id));

  if (!data.periods.length) return <Alert tone="info">Orang ini belum punya slip yang ditutup. Periode terbuka memakai Ubah Gaji.</Alert>;

  function choosePeriod(start: string) {
    setPeriod(start);
    const p = data.periods.find((x) => x.start === start);
    setLines((p?.lines ?? []).map((l) => ({ componentTypeId: l.componentTypeId, amount: String(l.amount) })));
  }

  async function save() {
    setError(null);
    if (!objection) return setError('Pilih keberatan slip yang dibetulkan, atau "Ditemukan kantor sendiri".');
    if (!parsed.length || parsed.some((l) => !Number.isInteger(l.amount) || l.amount <= 0)) return setError('Isi nominal tiap komponen, rupiah bulat lebih dari 0.');
    setBusy(true);
    const result = await postJson('/api/payroll', {
      kind: 'salary_correct', employeeId: data.person.id, effectiveFrom: period, lines: parsed, reason, objectionId: objection === OFFICE ? null : Number(objection),
    });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(String(result.data?.message ?? 'Tersimpan.'), 'ok');
    router.push(back);
    router.refresh();
  }

  return (
    <Card className="max-w-2xl space-y-4 text-sm">
      <Alert tone="warn">
        Slip lama tidak diubah. Gaji yang dibetulkan berlaku mulai periode yang dipilih sampai perubahan gaji berikutnya; selisih gaji tetap tiap periode
        yang sudah ditutup masuk slip berikutnya sebagai &quot;Koreksi gaji tetap periode …&quot; (dua arah).
      </Alert>
      <Field id="sc-period" label="Periode yang dibetulkan">
        <Select id="sc-period" value={period} onChange={(e) => choosePeriod(e.target.value)}>
          {data.periods.map((p) => <option key={p.start} value={p.start}>{p.label}</option>)}
        </Select>
      </Field>
      {current && <p className="text-ink-muted">Gaji tercatat periode itu: {current.text}</p>}

      <div className="space-y-2">
        <p className="font-medium">Gaji yang benar</p>
        {lines.map((l, index) => (
          <div key={l.componentTypeId} className="flex items-center gap-2">
            <span className="w-40 shrink-0">{typeName.get(l.componentTypeId) ?? '?'}</span>
            <Input inputMode="numeric" value={l.amount} aria-label={`Nominal ${typeName.get(l.componentTypeId) ?? ''}`}
              onChange={(e) => setLines(lines.map((x, i) => (i === index ? { ...x, amount: e.target.value } : x)))} />
            <Button variant="ghost" onClick={() => setLines(lines.filter((_, i) => i !== index))} aria-label="Hapus komponen">×</Button>
          </div>
        ))}
        {unused.length > 0 && (
          <div className="flex items-center gap-2">
            <Select aria-label="Tambah komponen" value={adding} onChange={(e) => setAdding(e.target.value)}>
              <option value="">Tambah komponen…</option>
              {unused.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
            <Button variant="secondary" disabled={!adding} onClick={() => { setLines([...lines, { componentTypeId: Number(adding), amount: '' }]); setAdding(''); }}>Tambah</Button>
          </div>
        )}
        <p>Jumlah: <b className="tabular-nums">{rupiah(monthlyTotal(parsed.filter((l) => l.amount > 0)))}</b>/bulan</p>
      </div>

      <Field id="sc-objection" label="Dasar pembetulan">
        <Select id="sc-objection" value={objection} onChange={(e) => setObjection(e.target.value)}>
          <option value="">Pilih…</option>
          {data.objections.map((o) => <option key={o.id} value={o.id}>{o.text}</option>)}
          <option value={OFFICE}>Ditemukan kantor sendiri (tanpa keberatan)</option>
        </Select>
      </Field>
      <Field id="sc-reason" label="Alasan" hint="Wajib. Dibaca orangnya dan para pemilik.">
        <Textarea id="sc-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Link className={buttonClass({ variant: 'secondary' })} href={back}>Batal</Link>
        <HoldButton loading={busy} onClick={save}>Simpan pembetulan</HoldButton>
      </div>
    </Card>
  );
}
