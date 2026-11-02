'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Dialog } from '@/components/ui/dialog';
import { Field, Select, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Badge } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { longDate, rupiah } from '../rules/salary';

type Status = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'CANCELLED' | 'WAIVED';
const STATUS: Record<Status, { tone: 'info' | 'ok' | 'warn' | 'danger'; label: string }> = {
  PENDING: { tone: 'warn', label: 'Menunggu pengesahan' }, ACTIVE: { tone: 'ok', label: 'Berjalan' }, REJECTED: { tone: 'danger', label: 'Ditolak' },
  CANCELLED: { tone: 'danger', label: 'Dibatalkan' }, WAIVED: { tone: 'info', label: 'Ditiadakan (keberatan)' },
};

type Row = {
  id: number; employeeId: number; name: string; branchName: string; typeName: string; amount: number; reason: string; installments: number;
  status: Status; requestId: number | null; left: number; recordedBy: string; cancelReason: string | null;
  schedule: { sequence: number; periodStart: string; amount: number; cancelled: boolean }[]; canChange: boolean;
};

/** GAJ-L16 Potongan Lain: ganti rugi perorangan yang dicicil lewat slip. */
export function OtherDeductionsScreen({ rows, filter, branches, canPropose, maxInstallments }: {
  rows: Row[]; filter: { status: Status | null; branchId: number | null }; branches: { id: number; name: string }[]; canPropose: boolean; maxInstallments: number; today: string;
}) {
  const [target, setTarget] = useState<{ mode: 'cancel' | 'reschedule'; row: Row } | null>(null);
  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-3" method="get">
        <Field id="od-branch" label="Cabang">
          <Select id="od-branch" name="cabang" defaultValue={filter.branchId ?? ''}><option value="">Semua</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
        </Field>
        <Field id="od-status" label="Status">
          <Select id="od-status" name="status" defaultValue={filter.status ?? ''}><option value="">Semua</option>{(Object.keys(STATUS) as Status[]).map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}</Select>
        </Field>
        <Button type="submit" variant="secondary">Tampilkan</Button>
        {canPropose && <Link className={buttonClass({})} href="/potongan/lain/ajukan">Ajukan Potongan Lain</Link>}
      </form>
      <DataList
        rows={rows}
        rowKey={(r) => String(r.id)}
        empty="Belum ada Potongan Lain."
        columns={[
          { key: 'name', header: 'Orang', primary: true, render: (r) => <span>{r.name} <span className="text-ink-muted">· {r.branchName}</span></span> },
          { key: 'type', header: 'Jenis', render: (r) => r.typeName },
          { key: 'amount', header: 'Nominal', render: (r) => <span className="tabular-nums">{rupiah(r.amount)} · {r.installments}×</span> },
          { key: 'left', header: 'Sisa', render: (r) => (r.status === 'ACTIVE' ? <span className="tabular-nums">{rupiah(r.left)}</span> : '—') },
          {
            key: 'schedule', header: 'Jadwal', render: (r) => (
              <details className="text-sm"><summary className="cursor-pointer">{r.schedule.filter((s) => !s.cancelled).length} cicilan</summary>
                <ul>{r.schedule.map((s) => <li key={`${s.sequence}`} className={s.cancelled ? 'line-through text-ink-muted' : undefined}>Slip {longDate(s.periodStart)}: {rupiah(s.amount)}</li>)}</ul>
                <p className="text-ink-muted">Alasan: {r.reason}{r.cancelReason ? ` · ${r.cancelReason}` : ''}</p>
              </details>
            ),
          },
          { key: 'status', header: 'Status', render: (r) => <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge> },
          {
            key: 'act', header: '', render: (r) => (r.status === 'PENDING' && r.requestId ? <Link className="underline text-sm" href={`/persetujuan/${r.requestId}`}>Lihat usulan</Link>
              : r.canChange ? (
                <span className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setTarget({ mode: 'reschedule', row: r })}>Ubah jadwal</Button>
                  <Button size="sm" variant="ghost" onClick={() => setTarget({ mode: 'cancel', row: r })}>Batalkan</Button>
                </span>
              ) : null),
          },
        ]}
      />
      <p className="text-sm text-ink-muted">Sisa dihitung dari cicilan yang belum terpotong. Sesudah cicilan pertama terpotong (slip ditutup), Potongan Lain tidak bisa dibatalkan; hanya Hapuskan sisa (menyusul bersama Tutup Slip).</p>
      <ChangeDialog target={target} onClose={() => setTarget(null)} maxInstallments={maxInstallments} />
    </div>
  );
}

function ChangeDialog({ target, onClose, maxInstallments }: { target: { mode: 'cancel' | 'reschedule'; row: Row } | null; onClose: () => void; maxInstallments: number }) {
  const router = useRouter();
  const toast = useToast();
  const [count, setCount] = useState('1');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!target) return null;
  const { mode, row } = target;
  function close() { setCount('1'); setReason(''); setError(null); onClose(); }
  async function save() {
    setBusy(true);
    const body = mode === 'cancel' ? { kind: 'other_cancel', id: row.id, reason } : { kind: 'other_reschedule', id: row.id, installments: Number(count), reason };
    const result = await postJson('/api/payroll', body);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(mode === 'cancel' ? 'Potongan Lain dibatalkan. Orangnya diberi tahu.' : 'Jadwal diubah. Orangnya diberi tahu.', 'ok');
    close();
    router.refresh();
  }
  return (
    <Dialog open onClose={close} title={mode === 'cancel' ? 'Batalkan Potongan Lain' : 'Ubah jadwal Potongan Lain'}
      footer={<><Button variant="secondary" onClick={close}>Kembali</Button><HoldButton variant={mode === 'cancel' ? 'danger' : 'primary'} loading={busy} disabled={!reason.trim()} onClick={save}>{mode === 'cancel' ? 'Batalkan' : 'Simpan jadwal'}</HoldButton></>}>
      <div className="space-y-3">
        <p>{row.typeName} {row.name} {rupiah(row.amount)} (sisa {rupiah(row.left)}).</p>
        {mode === 'reschedule' && (
          <Field id="od-count" label="Sisa dicicil berapa kali" hint="Mulai slip periode berjalan; cicilan lama yang belum terpotong diganti.">
            <Select id="od-count" value={count} onChange={(e) => setCount(e.target.value)}>
              {Array.from({ length: maxInstallments }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} kali</option>)}
            </Select>
          </Field>
        )}
        <Field id="od-reason" label="Alasan"><Textarea id="od-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}
