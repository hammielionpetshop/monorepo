import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Field, Input, Select } from '@/components/ui/field';
import { Alert, Badge } from '@/components/ui/surface';
import { longDate, rupiah } from '../rules/salary';
import type { SalaryListFilter, SalaryListRow } from '../server/screens';

const STATUS_LABELS = { TRAINING: 'Training', EMPLOYEE: 'Karyawan' } as const;

/** GAJ-L01 Gaji Karyawan. Saring lewat alamat (GET), seperti Daftar Karyawan. */
export function SalaryListScreen({ rows, branches, positions, filter, divisor, periodName, missingCount }: {
  rows: SalaryListRow[]; branches: { id: number; name: string }[]; positions: { id: number; name: string }[];
  filter: SalaryListFilter; divisor: number; periodName: string; missingCount: number;
}) {
  return (
    <div className="space-y-4">
      {missingCount > 0 && (
        <Alert tone="warn" title={`${missingCount} orang belum ada gaji untuk periode ${periodName}`}>
          Slip mereka belum bisa dihitung. Buka orangnya, lalu isi gaji (bisa dari Gaji Standar).
        </Alert>
      )}
      <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6" method="get">
        <Field id="sl-q" label="Cari"><Input id="sl-q" name="q" defaultValue={filter.q ?? ''} placeholder="Nama atau kode" /></Field>
        <Field id="sl-branch" label="Cabang">
          <Select id="sl-branch" name="branch" defaultValue={filter.branch ?? ''}>
            <option value="">Semua</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        <Field id="sl-position" label="Jabatan">
          <Select id="sl-position" name="position" defaultValue={filter.position ?? ''}>
            <option value="">Semua</option>
            {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field id="sl-status" label="Status kerja">
          <Select id="sl-status" name="status" defaultValue={filter.status ?? ''}>
            <option value="">Semua</option>
            <option value="TRAINING">Training</option>
            <option value="EMPLOYEE">Karyawan</option>
          </Select>
        </Field>
        <Field id="sl-flag" label="Tanda">
          <Select id="sl-flag" name="flag" defaultValue={filter.flag ?? ''}>
            <option value="">Semua</option>
            <option value="missing">Belum ada gaji</option>
            <option value="proposal">Ada usulan menunggu</option>
          </Select>
        </Field>
        <div className="flex items-end"><button type="submit" className={buttonClass({ variant: 'secondary', block: true })}>Saring</button></div>
      </form>
      <p className="text-sm text-ink-muted">Gaji harian = gaji tetap sebulan ÷ {divisor}, hanya keterangan (slip tidak membulatkannya lebih dulu).</p>
      <DataList
        rows={rows}
        rowKey={(row) => row.id}
        empty="Tidak ada orang bergaji bulanan yang cocok."
        columns={[
          {
            key: 'name', header: 'Nama', primary: true, render: (row) => (
              <Link className="font-medium text-brand-700 hover:underline" href={`/gaji/${row.id}`}>{row.name}</Link>
            ),
          },
          { key: 'position', header: 'Jabatan', render: (row) => `${row.positionName} · ${row.branchName}` },
          { key: 'status', header: 'Status', render: (row) => STATUS_LABELS[row.workStatus] },
          {
            key: 'total', header: 'Gaji tetap sebulan', render: (row) => (row.total == null
              ? <Badge tone="warn">Belum ada gaji</Badge>
              : <span className="tabular-nums">{rupiah(row.total)}</span>),
          },
          { key: 'daily', header: 'Gaji harian', render: (row) => <span className="tabular-nums text-ink-muted">{row.daily ?? '—'}</span> },
          { key: 'since', header: 'Berlaku sejak', render: (row) => (row.since ? longDate(row.since) : '—') },
          {
            key: 'next', header: 'Perubahan terjadwal', render: (row) => (
              <span className="space-x-1">
                {row.next ? <span>{rupiah(row.next.total)} mulai {longDate(row.next.from)}</span> : null}
                {row.pendingProposal ? <Badge tone="info">Usulan menunggu</Badge> : null}
                {!row.next && !row.pendingProposal ? '—' : null}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
