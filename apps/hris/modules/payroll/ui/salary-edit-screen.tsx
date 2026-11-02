'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { classifyChange, dailyRateLabel, monthlyTotal, rupiah, type SalaryLine } from '../rules/salary';

type Choice = { from: string; label: string; current: boolean; before: SalaryLine[] | null };

/** GAJ-L03 Ubah Gaji, 4 langkah (TAM-07). Oleh HR = usulan; oleh Pemilik/GM = langsung terjadwal. */
export function SalaryEditScreen({ person, choices, types, startLines, standard, usedStandard, canChange, divisor }: {
  person: { id: number; name: string };
  choices: Choice[]; types: { id: number; name: string }[]; startLines: SalaryLine[];
  standard: { label: string; lines: SalaryLine[] } | null; usedStandard: boolean; canChange: boolean; divisor: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [from, setFrom] = useState('');
  const [lines, setLines] = useState<{ componentTypeId: number; amount: string }[]>(
    startLines.map((l) => ({ componentTypeId: l.componentTypeId, amount: String(l.amount) })),
  );
  const [adding, setAdding] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const typeName = new Map(types.map((t) => [t.id, t.name]));
  const parsed: SalaryLine[] = lines.map((l) => ({ componentTypeId: l.componentTypeId, amount: Number(l.amount.replace(/\D/g, '')) }));
  const choice = choices.find((c) => c.from === from) ?? null;
  const before = choice?.before ?? null;
  const kind = useMemo(() => classifyChange(before, parsed), [before, parsed]);
  const total = monthlyTotal(parsed);
  const unused = types.filter((t) => !lines.some((l) => l.componentTypeId === t.id));

  function next() {
    setError(null);
    if (step === 1 && !from) return setError('Pilih mulai berlaku.');
    if (step === 1 && choice?.current && kind === 'CUT') return setError('Penurunan gaji hanya bisa mulai periode depan.');
    if (step === 2) {
      if (!parsed.length) return setError('Isi paling sedikit satu komponen gaji.');
      if (parsed.some((l) => !Number.isInteger(l.amount) || l.amount <= 0)) return setError('Nominal harus rupiah bulat lebih dari 0. Komponen yang tidak dipakai dihentikan (×).');
      if (choice?.current && kind === 'CUT') return setError('Penurunan gaji hanya bisa mulai periode depan. Kembali ke langkah 1.');
      if (kind === 'SAME') return setError('Isinya sama dengan gaji yang berlaku di tanggal itu.');
    }
    setStep(step + 1);
  }

  async function save() {
    setBusy(true);
    const result = await postJson('/api/payroll', { kind: 'change', employeeId: person.id, effectiveFrom: from, lines: parsed, reason });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(String(result.data?.message ?? 'Tersimpan.'), 'ok');
    router.push(`/gaji/${person.id}`);
    router.refresh();
  }

  const beforeMap = new Map((before ?? []).map((l) => [l.componentTypeId, l.amount]));
  const afterMap = new Map(parsed.map((l) => [l.componentTypeId, l.amount]));
  const ids = [...new Set([...beforeMap.keys(), ...afterMap.keys()])];

  return (
    <Card className="max-w-2xl space-y-4">
      <p className="text-sm text-ink-muted">Langkah {step} dari 4 · {canChange ? 'langsung terjadwal' : 'usulan ke Pemilik atau GM'}</p>
      {usedStandard && standard && step <= 2 && <Alert tone="info">Isian awal dari {standard.label}. Masih bisa diubah.</Alert>}

      {step === 1 && (
        <Field id="se-from" label="Mulai berlaku" hint="Perubahan gaji selalu mulai tanggal 26 (awal periode). Penurunan hanya periode depan.">
          <Select id="se-from" value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">Pilih periode</option>
            {choices.map((c) => <option key={c.from} value={c.from}>{c.label}</option>)}
          </Select>
        </Field>
      )}

      {step === 2 && (
        <div className="space-y-3">
          {lines.map((line, index) => (
            <div key={line.componentTypeId} className="flex items-end gap-2">
              <Field id={`se-l${line.componentTypeId}`} label={typeName.get(line.componentTypeId) ?? `Komponen #${line.componentTypeId}`}>
                <Input id={`se-l${line.componentTypeId}`} inputMode="numeric" value={line.amount}
                  onChange={(e) => setLines(lines.map((l, i) => (i === index ? { ...l, amount: e.target.value.replace(/\D/g, '') } : l)))} />
              </Field>
              <Button variant="ghost" aria-label="Hentikan komponen" onClick={() => setLines(lines.filter((_, i) => i !== index))}>×</Button>
            </div>
          ))}
          {unused.length > 0 && (
            <div className="flex items-end gap-2">
              <Field id="se-add" label="Tambah komponen">
                <Select id="se-add" value={adding} onChange={(e) => setAdding(e.target.value)}>
                  <option value="">Pilih jenis</option>
                  {unused.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              </Field>
              <Button variant="secondary" disabled={!adding} onClick={() => { setLines([...lines, { componentTypeId: Number(adding), amount: '' }]); setAdding(''); }}>Tambah</Button>
            </div>
          )}
          <p className="text-sm">Gaji tetap sebulan <b className="tabular-nums">{rupiah(total)}</b> · gaji harian {dailyRateLabel(parsed, divisor)} (÷ {divisor})</p>
        </div>
      )}

      {step === 3 && (
        <Field id="se-reason" label="Alasan" hint='Misalnya "kenaikan tahunan" atau "promosi kepala toko".'>
          <Textarea id="se-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      )}

      {step === 4 && (
        <div className="space-y-3 text-sm">
          <p>Gaji <b>{person.name}</b> mulai <b>{choice?.label}</b>:</p>
          <table className="w-full">
            <thead><tr className="text-left text-ink-muted"><th>Komponen</th><th className="text-right">Sebelum</th><th className="text-right">Sesudah</th></tr></thead>
            <tbody>
              {ids.map((id) => (
                <tr key={id}>
                  <td>{typeName.get(id) ?? `Komponen #${id}`}</td>
                  <td className="text-right tabular-nums">{beforeMap.has(id) ? rupiah(beforeMap.get(id)!) : '—'}</td>
                  <td className="text-right tabular-nums">{afterMap.has(id) ? rupiah(afterMap.get(id)!) : 'dihentikan'}</td>
                </tr>
              ))}
              <tr className="border-t border-line font-medium">
                <td>Gaji tetap sebulan</td>
                <td className="text-right tabular-nums">{before ? rupiah(monthlyTotal(before)) : 'Belum ada'}</td>
                <td className="text-right tabular-nums">{rupiah(total)}</td>
              </tr>
            </tbody>
          </table>
          {before && <p>Selisih: <b className="tabular-nums">{total - monthlyTotal(before) >= 0 ? '+' : '−'}{rupiah(Math.abs(total - monthlyTotal(before)))}</b></p>}
          {kind === 'CUT' && <Alert tone="danger" title="Gaji turun">Karyawan diberi tahu sebelum berlaku.</Alert>}
          <p className="text-ink-muted">Alasan: {reason}</p>
          <p className="text-ink-muted">{canChange ? `${person.name} diberi tahu tanpa nominal; pemilik lain juga diberi tahu.` : 'Terkirim sebagai usulan. Gaji lama tetap dipakai sampai Pemilik atau GM menyetujui.'}</p>
        </div>
      )}

      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {step > 1
          ? <Button variant="secondary" onClick={() => { setError(null); setStep(step - 1); }}>Kembali</Button>
          : <Link className={buttonClass({ variant: 'secondary' })} href={`/gaji/${person.id}`}>Batal</Link>}
        {step < 4 ? <Button onClick={next}>Lanjut</Button> : <HoldButton loading={busy} onClick={save}>{canChange ? 'Simpan' : 'Kirim usulan'}</HoldButton>}
      </div>
    </Card>
  );
}
