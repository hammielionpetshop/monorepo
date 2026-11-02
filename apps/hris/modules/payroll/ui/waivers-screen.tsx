'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Field, Select } from '@/components/ui/field';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { longDate, rupiah } from '../rules/salary';
import type { WaiverRow, WaiverStatus } from '../server/attendance-pay';
import { WaiveDialog, type WaiveTarget } from './waive-dialog';

const STATUS: Record<WaiverStatus, { tone: 'danger' | 'warn' | 'ok'; label: string }> = {
  CUT: { tone: 'danger', label: 'Dipotong' }, WAIVED: { tone: 'warn', label: 'Ditiadakan' }, EXPLAINED: { tone: 'ok', label: 'Ditiadakan lewat penjelasan' },
};

/** GAJ-L10 Tiadakan Potongan: semua potongan telat dan denda satu periode. HR melihat tanpa tombol. */
export function WaiversScreen({ period, periods, rows, branches, people, filter, canWaive }: {
  period: { start: string; label: string };
  periods: { start: string; label: string }[];
  rows: WaiverRow[];
  branches: { id: number; name: string }[];
  people: { id: number; name: string }[];
  filter: { branchId: number | null; employeeId: number | null; status: WaiverStatus | null };
  canWaive: boolean;
}) {
  const [target, setTarget] = useState<WaiveTarget | null>(null);
  const cut = rows.filter((r) => r.status === 'CUT').reduce((s, r) => s + r.amount, 0);
  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-3" method="get">
        <Field id="wv-period" label="Periode">
          <Select id="wv-period" name="periode" defaultValue={period.start}>{periods.map((p) => <option key={p.start} value={p.start}>{p.label}</option>)}</Select>
        </Field>
        <Field id="wv-branch" label="Cabang">
          <Select id="wv-branch" name="cabang" defaultValue={filter.branchId ?? ''}>
            <option value="">Semua</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        <Field id="wv-person" label="Orang">
          <Select id="wv-person" name="orang" defaultValue={filter.employeeId ?? ''}>
            <option value="">Semua</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field id="wv-status" label="Status">
          <Select id="wv-status" name="status" defaultValue={filter.status ?? ''}>
            <option value="">Semua</option>{(Object.keys(STATUS) as WaiverStatus[]).map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
          </Select>
        </Field>
        <Button type="submit" variant="secondary">Tampilkan</Button>
      </form>
      {!canWaive && <Alert tone="info">Hanya Pemilik atau GM yang bisa meniadakan. Daftar ini untuk mengingatkan sebelum slip ditutup.</Alert>}
      <Card><p className="text-sm">Periode {period.label}: {rows.length} kejadian, yang dipotong {rupiah(cut)}.</p></Card>
      <DataList
        rows={rows}
        rowKey={(r) => `${r.employeeId}-${r.workDate}-${r.kind}-${r.fineKind ?? ''}`}
        empty="Tidak ada potongan telat atau denda di periode ini."
        columns={[
          { key: 'name', header: 'Orang', primary: true, render: (r) => <Link className="underline" href={`/gaji/${r.employeeId}/hitungan?periode=${period.start}`}>{r.name}</Link> },
          { key: 'date', header: 'Tanggal', render: (r) => longDate(r.workDate) },
          { key: 'branch', header: 'Cabang', render: (r) => r.branchName },
          { key: 'what', header: 'Kejadian', render: (r) => r.what },
          { key: 'amount', header: 'Rupiah', render: (r) => (r.status === 'CUT' ? rupiah(r.amount) : <span className="line-through text-ink-muted">{rupiah(r.fullAmount)}</span>) },
          { key: 'status', header: 'Status', render: (r) => <span title={r.note ?? undefined}><Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge></span> },
          {
            key: 'act', header: '', render: (r) => (r.canWaive ? (
              r.status === 'CUT'
                ? <Button size="sm" variant="ghost" onClick={() => setTarget({ mode: 'waive', employeeId: r.employeeId, name: r.name, kind: r.kind, fineKind: r.fineKind, workDate: r.workDate, what: r.kind === 'LATE' ? 'Potongan telat' : r.what.replace(/ \(.*\)$/, ''), amount: r.amount })}>Tiadakan</Button>
                : r.waiverId ? <Button size="sm" variant="ghost" onClick={() => setTarget({ mode: 'cancel', waiverId: r.waiverId!, name: r.name, workDate: r.workDate, what: r.kind === 'LATE' ? 'potongan telat' : r.what.replace(/ \(.*\)$/, '') })}>Batalkan peniadaan</Button> : null
            ) : null),
          },
        ]}
      />
      <p className="text-sm text-ink-muted">Telat dalam toleransi tidak ditampilkan. <Link className={buttonClass({ variant: 'ghost', size: 'sm' })} href="/panduan/aturan-potongan">Aturan Potongan</Link></p>
      <WaiveDialog target={target} onClose={() => setTarget(null)} />
    </div>
  );
}
