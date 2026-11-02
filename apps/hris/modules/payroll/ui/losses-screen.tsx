'use client';

import Link from 'next/link';
import { Button, buttonClass } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Field, Select } from '@/components/ui/field';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { longDate, rupiah } from '../rules/salary';

type Status = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'CANCELLED';
const STATUS: Record<Status, { tone: 'info' | 'ok' | 'warn' | 'danger'; label: string }> = {
  PENDING: { tone: 'warn', label: 'Menunggu pengesahan' }, ACTIVE: { tone: 'ok', label: 'Berlaku' },
  REJECTED: { tone: 'danger', label: 'Ditolak' }, CANCELLED: { tone: 'danger', label: 'Dibatalkan' },
};

type Row = { id: number; branchName: string; foundOn: string; amount: number; description: string; status: Status; recordedBy: string; approvedBy: string | null; requestId: number | null };

/** GAJ-L12 Kehilangan Barang: kejadian per periode; klik baris untuk kartu pembagian. */
export function LossesScreen({ period, periods, filter, branches, missingOffice, canRecord, rows }: {
  period: { start: string; label: string };
  periods: { start: string; label: string }[];
  filter: { branchId: number | null; status: Status | null };
  branches: { id: number; name: string }[];
  missingOffice: string[];
  canRecord: boolean;
  rows: Row[];
}) {
  const active = rows.filter((r) => r.status === 'ACTIVE').reduce((s, r) => s + r.amount, 0);
  return (
    <div className="space-y-4">
      {missingOffice.length > 0 && (
        <Alert tone="danger" title="Persen kantor belum diisi">
          {missingOffice.join(', ')} belum punya persen kantor untuk periode ini, jadi kehilangannya belum bisa dicatat.{' '}
          <Link className="underline" href="/pengaturan/tanggungan-kehilangan">Isi di Tanggungan Kehilangan</Link>
        </Alert>
      )}
      <form className="flex flex-wrap items-end gap-3" method="get">
        <Field id="ls-period" label="Periode">
          <Select id="ls-period" name="periode" defaultValue={period.start}>{periods.map((p) => <option key={p.start} value={p.start}>{p.label}</option>)}</Select>
        </Field>
        <Field id="ls-branch" label="Cabang">
          <Select id="ls-branch" name="cabang" defaultValue={filter.branchId ?? ''}>
            <option value="">Semua</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        <Field id="ls-status" label="Status">
          <Select id="ls-status" name="status" defaultValue={filter.status ?? ''}>
            <option value="">Semua</option>{(Object.keys(STATUS) as Status[]).map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
          </Select>
        </Field>
        <Button type="submit" variant="secondary">Tampilkan</Button>
        {canRecord && <Link className={buttonClass({})} href="/potongan/kehilangan-barang/catat">Catat Kehilangan</Link>}
      </form>
      <Card><p className="text-sm">Periode {period.label}: {rows.length} catatan, yang berlaku {rupiah(active)}.</p></Card>
      <DataList
        rows={rows}
        rowKey={(r) => String(r.id)}
        empty="Belum ada kehilangan barang di periode ini."
        columns={[
          { key: 'branch', header: 'Cabang', primary: true, render: (r) => <Link className="underline" href={`/potongan/kehilangan-barang/${r.id}`}>{r.branchName}</Link> },
          { key: 'date', header: 'Ditemukan', render: (r) => longDate(r.foundOn) },
          { key: 'amount', header: 'Nilai', render: (r) => <span className="tabular-nums">{rupiah(r.amount)}</span> },
          { key: 'desc', header: 'Keterangan', render: (r) => r.description },
          { key: 'who', header: 'Dicatat / disahkan', render: (r) => `${r.recordedBy}${r.approvedBy ? ` / ${r.approvedBy}` : ''}` },
          { key: 'status', header: 'Status', render: (r) => <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge> },
          { key: 'req', header: '', render: (r) => (r.status === 'PENDING' && r.requestId ? <Link className="underline text-sm" href={`/persetujuan/${r.requestId}`}>Lihat usulan</Link> : null) },
        ]}
      />
      <p className="text-sm text-ink-muted">Kehilangan dibagi ke orang yang ditempatkan di cabang itu dengan jabatan bertanda, sebanding bobot dan hari. <Link className="underline" href="/panduan/aturan-potongan">Aturan Potongan</Link></p>
    </div>
  );
}
