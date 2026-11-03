'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { rupiah, splitInstallments } from '../rules/advance';

type Row = {
  id: number; number: string; name: string; branchName: string; amount: number; installments: number; remaining: number | null;
  stageLabel: string; tone: 'info' | 'ok' | 'warn' | 'danger'; requestId: number | null;
};

/**
 * Sisa Kasbon Bawaan (spec L9 §3.1, SIS-28): Finance mengetik satu angka sisa per orang dari sistem lama, Pemilik/GM
 * mengesahkan di Persetujuan. Disahkan = kasbon berjalan bertanda "Bawaan sistem lama", dipotong mulai slip hari pindah.
 */
export function LegacyAdvanceScreen({ cutover, rows, candidates, canEnter, maxInstallments, total }: {
  cutover: string | null; rows: Row[]; candidates: { id: number; name: string; branchName: string; basis: string | null }[];
  canEnter: boolean; maxInstallments: number; total: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [employeeId, setEmployeeId] = useState('');
  const [amount, setAmount] = useState('');
  const [installments, setInstallments] = useState(String(maxInstallments));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const value = Number(amount) || 0;
  const count = Number(installments) || 1;
  const person = candidates.find((p) => String(p.id) === employeeId);
  const cutoverText = cutover ? cutover.split('-').reverse().join('-') : null;

  async function submit() {
    setError(null);
    if (!person) return setError('Pilih karyawan.');
    if (!person.basis) return setError('Jabatan orang ini belum punya dasar gaji (bulanan/mingguan) di Pengaturan Jabatan.');
    if (value <= 0) return setError('Isi sisa kasbon lebih dari 0.');
    setBusy(true);
    const result = await postJson('/api/requests', {
      kind: 'submit', typeKey: 'advance_legacy', attachmentIds: [], resubmittedFromId: null,
      fields: { employeeId: person.id, amount: value, installments: count, note: note.trim() },
    });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal mengirim.');
    toast('Sisa kasbon bawaan terkirim. Menunggu disahkan Pemilik atau GM.', 'ok');
    setEmployeeId('');
    setAmount('');
    setNote('');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {!cutover && <Alert tone="warn">Hari pindah belum ditetapkan. Isi dulu di Pengaturan › Pindah sistem.</Alert>}
      {cutoverText && (
        <Alert tone="info">
          Hari pindah: <b>{cutoverText}</b>. Sisa yang disahkan dipotong mulai slip yang dimulai hari itu, paling banyak {maxInstallments} kali.
          Sisa boleh di atas batas kasbon per orang; orangnya baru bisa mengajukan kasbon baru setelah sisanya di bawah batas.
        </Alert>
      )}
      {canEnter && cutover && (
        <Card className="max-w-xl space-y-3">
          <h2 className="font-semibold">Ketik sisa kasbon</h2>
          {candidates.length === 0 ? <p className="text-sm text-ink-muted">Semua karyawan aktif sudah punya sisa kasbon bawaan.</p> : (
            <>
              <Field id="lg-person" label="Karyawan" hint="Bukan untuk Anda sendiri. Satu orang satu sisa.">
                <Select id="lg-person" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                  <option value="">Pilih karyawan</option>
                  {candidates.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.branchName}{p.basis ? '' : ' (belum ada dasar gaji)'}</option>)}
                </Select>
              </Field>
              <Field id="lg-amount" label="Sisa kasbon di sistem lama (Rp)">
                <Input id="lg-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} />
              </Field>
              <Field id="lg-count" label="Kali potong">
                <Select id="lg-count" value={installments} onChange={(e) => setInstallments(e.target.value)}>
                  {Array.from({ length: maxInstallments }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} kali</option>)}
                </Select>
              </Field>
              {value > 0 && <p className="text-sm text-ink-muted">{count} kali potong: {splitInstallments(value, count).map(rupiah).join(' + ')}</p>}
              <Field id="lg-note" label="Catatan (boleh kosong)" hint="Mis. nomor kasbon di sistem lama.">
                <Textarea id="lg-note" value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              {error && <Alert tone="danger">{error}</Alert>}
              <Button loading={busy} onClick={submit}>Kirim untuk disahkan</Button>
            </>
          )}
        </Card>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Daftar sisa kasbon bawaan</h2>
        <p className="text-sm text-ink-muted">Sisa berjalan: <b>{rupiah(total)}</b></p>
      </div>
      <DataList
        rows={rows}
        rowKey={(r) => r.id}
        empty="Belum ada sisa kasbon bawaan."
        columns={[
          { key: 'name', header: 'Karyawan', primary: true, render: (r) => <Link className="underline" href={`/gaji/kasbon/${r.id}`}>{r.name}</Link> },
          { key: 'number', header: 'Nomor', render: (r) => r.number },
          { key: 'branch', header: 'Cabang', render: (r) => r.branchName },
          { key: 'amount', header: 'Sisa diketik', render: (r) => `${rupiah(r.amount)} · ${r.installments}×` },
          { key: 'remaining', header: 'Sisa sekarang', render: (r) => (r.remaining == null ? '—' : rupiah(r.remaining)) },
          {
            key: 'stage', header: 'Keadaan',
            render: (r) => (r.requestId && r.remaining == null && r.stageLabel
              ? <Link href={`/persetujuan/${r.requestId}`}><Badge tone={r.tone}>{r.stageLabel}</Badge></Link>
              : <Badge tone={r.tone}>{r.stageLabel}</Badge>),
          },
        ]}
      />
    </div>
  );
}
