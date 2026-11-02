'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DataList } from '@/components/ui/data-list';
import { Field, Select } from '@/components/ui/field';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import type { RecapTotals } from '../rules/review';
import type { DayCard } from '../server/review';

type Period = { start: string; end: string };

const COLUMNS: { key: keyof RecapTotals | 'pending'; header: string; value: (t: RecapTotals) => string }[] = [
  { key: 'present', header: 'Hadir', value: (t) => String(t.present) },
  { key: 'lateCount', header: 'Telat', value: (t) => (t.lateCount ? `${t.lateCount}× / ${t.lateMinutes} mnt` : '0') },
  { key: 'earlyCount', header: 'Pulang cepat', value: (t) => String(t.earlyCount) },
  { key: 'closed', header: 'Hari tutup', value: (t) => String(t.closed) },
  { key: 'dayOff', header: 'Libur terjadwal', value: (t) => String(t.dayOff) },
  { key: 'permit', header: 'Izin', value: (t) => String(t.permit) },
  { key: 'sick', header: 'Sakit', value: (t) => String(t.sick) },
  { key: 'leave', header: 'Cuti', value: (t) => String(t.leave) },
  { key: 'alpha', header: 'Alpha', value: (t) => String(t.alpha) },
  { key: 'undetermined', header: 'Belum ditentukan', value: (t) => String(t.undetermined) },
  { key: 'pendingReviews', header: 'Perlu ditinjau', value: (t) => String(t.pendingReviews) },
];

// Kolom bagian yang belum dibangun (spec L3c §1): tampil "-".
const LATER = ['Lembur'];

/** KEH-L16 Rekap Kehadiran per periode 26 sampai 25. Angka dihitung server di satu tempat (KEH-76). */
export function RecapScreen({ period, periods, branchId, branches, rows, summary, selected }: {
  period: Period; periods: Period[]; branchId: number | null; branches: { id: number; name: string }[];
  rows: { employeeId: number; name: string; totals: RecapTotals }[]; summary: RecapTotals;
  selected: { employeeId: number; name: string; days: DayCard[] } | null;
}) {
  const router = useRouter();
  const href = (next: { period?: string; branch?: string; employee?: number | null }) => {
    const params = new URLSearchParams({ period: next.period ?? period.start });
    const branch = next.branch ?? (branchId ? String(branchId) : '');
    if (branch) params.set('branch', branch);
    const employee = next.employee === undefined ? selected?.employeeId : next.employee;
    if (employee) params.set('employee', String(employee));
    return `/kehadiran/rekap?${params}`;
  };
  return (
    <div className="space-y-4">
      <div className="grid max-w-lg gap-3 sm:grid-cols-2">
        <Field id="rc-period" label="Periode">
          <Select id="rc-period" value={period.start} onChange={(event) => router.push(href({ period: event.target.value, employee: null }))}>
            {periods.map((item) => <option key={item.start} value={item.start}>{item.start} s.d. {item.end}</option>)}
          </Select>
        </Field>
        <Field id="rc-branch" label="Cabang">
          <Select id="rc-branch" value={branchId ?? ''} onChange={(event) => router.push(href({ branch: event.target.value, employee: null }))}>
            <option value="">Semua yang boleh dilihat</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </Select>
        </Field>
      </div>
      <Alert>Hari yang masih berjalan belum dihitung. Hari kerja tanpa absen yang ditandai mesin pagi harinya tampil Alpha <NewBadge feature="fitur/status-alpha" />; selain itu Belum ditentukan, tidak ditebak. Kolom {LATER.join(', ')} terisi saat bagiannya dibangun.</Alert>
      {!rows.length ? <EmptyState title="Tidak ada orang di pilihan ini." /> : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-canvas text-xs text-ink-muted">
              <tr>
                <th className="px-3 py-2">Nama</th>
                {COLUMNS.map((column) => <th key={column.key} className="px-3 py-2 text-right">{column.header}</th>)}
                {LATER.map((label) => <th key={label} className="px-3 py-2 text-right">{label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.employeeId} className={selected?.employeeId === row.employeeId ? 'bg-brand-50' : undefined}>
                  <td className="px-3 py-2"><Link className="text-brand-700" href={href({ employee: row.employeeId })}>{row.name}</Link></td>
                  {COLUMNS.map((column) => (
                    <td key={column.key} className="px-3 py-2 text-right tabular-nums">
                      <Link href={href({ employee: row.employeeId })}>{column.value(row.totals)}</Link>
                    </td>
                  ))}
                  {LATER.map((label) => <td key={label} className="px-3 py-2 text-right text-ink-muted">-</td>)}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-canvas font-medium">
              <tr>
                <td className="px-3 py-2">Ringkasan ({rows.length} orang)</td>
                {COLUMNS.map((column) => <td key={column.key} className="px-3 py-2 text-right tabular-nums">{column.value(summary)}</td>)}
                {LATER.map((label) => <td key={label} className="px-3 py-2 text-right text-ink-muted">-</td>)}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {selected && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Hari kerja {selected.name}</h2>
            <Link className="text-sm text-brand-700" href={href({ employee: null })}>Tutup</Link>
          </div>
          <DataList
            rows={[...selected.days].reverse()}
            rowKey={(day) => day.workDate}
            empty="Belum ada hari yang dihitung di periode ini."
            columns={[
              {
                key: 'date', header: 'Tanggal', primary: true, render: (day) => (
                  <Link className="text-brand-700" href={`/kehadiran/catatan-hari?employee=${day.employeeId}&date=${day.workDate}`}>{day.workDate}</Link>
                ),
              },
              { key: 'status', header: 'Status', render: (day) => <Badge tone={day.status === 'PRESENT' ? 'ok' : day.status === 'CLOSED' ? 'info' : 'warn'}>{day.statusLabel}</Badge> },
              { key: 'time', header: 'Masuk–pulang', render: (day) => `${day.times.IN}–${day.times.OUT}` },
              { key: 'late', header: 'Telat', render: (day) => (day.lateMinutes ? <>{day.lateMinutes} mnt{day.inTolerance && <> <Badge>Dalam toleransi</Badge></>}</> : '-') },
              { key: 'tags', header: 'Tanda', render: (day) => day.tags.join(', ') || '-' },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
