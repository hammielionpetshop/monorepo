'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Field, Select } from '@/components/ui/field';
import { Badge, EmptyState } from '@/components/ui/surface';
import type { TeamOvertimeTab } from '../server/overtime';
import { TabNav } from './tab-nav';

type Row = {
  id: number; name: string; branch: string; dateLabel: string; hours: number; claimedHours: number | null; approvedHours: number | null;
  left: string; urgency: 'normal' | 'warn' | 'danger' | 'over'; requestId: number | null; canOpen: boolean; waitingDays: number;
};

const TONES = { normal: 'info', warn: 'warn', danger: 'danger', over: 'info' } as const;

/** KEH-L42 Lembur Tim. Hanya baca: tanpa Ingatkan, tanpa menghidupkan yang hangus; keputusan tetap di Persetujuan. */
export function TeamOvertimeScreen({ tab, branchId, employeeId, branches, people, rows }: {
  tab: TeamOvertimeTab; branchId: number | null; employeeId: number | null; branches: { id: number; name: string }[];
  people: { id: number; name: string }[]; rows: Row[];
}) {
  const router = useRouter();
  const href = (next: { tab?: string; branch?: string; employee?: string }) => {
    const params = new URLSearchParams();
    const t = next.tab ?? tab;
    if (t !== 'open') params.set('tab', t);
    const branch = next.branch ?? (branchId ? String(branchId) : '');
    if (branch) params.set('branch', branch);
    const employee = next.employee ?? (employeeId ? String(employeeId) : '');
    if (employee) params.set('employee', employee);
    const query = params.toString();
    return query ? `/kehadiran/lembur?${query}` : '/kehadiran/lembur';
  };
  const tabs = [
    { key: 'open', label: 'Terdeteksi, belum diklaim', href: href({ tab: 'open' }) },
    { key: 'soon', label: 'Hampir hangus', href: href({ tab: 'soon' }) },
    { key: 'waiting', label: 'Menunggu keputusan', href: href({ tab: 'waiting' }) },
    { key: 'expired', label: 'Hangus', href: href({ tab: 'expired' }) },
  ];
  return (
    <div className="space-y-4">
      <TabNav label="Lembur Tim" tabs={tabs} active={tab} />
      <div className="grid max-w-lg gap-3 sm:grid-cols-2">
        <Field id="ot-branch" label="Cabang">
          <Select id="ot-branch" value={branchId ?? ''} onChange={(event) => router.push(href({ branch: event.target.value }))}>
            <option value="">Semua yang boleh dilihat</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </Select>
        </Field>
        <Field id="ot-person" label="Orang">
          <Select id="ot-person" value={employeeId ?? ''} onChange={(event) => router.push(href({ employee: event.target.value }))}>
            <option value="">Semua</option>
            {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </Select>
        </Field>
      </div>
      {tab === 'expired' && <p className="text-sm text-ink-muted">Lembur yang hangus dibicarakan langsung dengan orangnya, di luar sistem.</p>}
      {!rows.length ? <EmptyState title="Tidak ada di pilihan ini." /> : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-canvas text-xs text-ink-muted">
              <tr>
                <th className="px-3 py-2">Nama</th>
                <th className="px-3 py-2">Cabang</th>
                <th className="px-3 py-2">Tanggal</th>
                <th className="px-3 py-2 text-right">Terdeteksi</th>
                <th className="px-3 py-2 text-right">Diklaim</th>
                <th className="px-3 py-2">{tab === 'waiting' ? 'Menunggu' : 'Sisa waktu'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2">
                    {tab === 'waiting' && row.canOpen && row.requestId ? <Link className="text-brand-700" href={`/persetujuan/${row.requestId}`}>{row.name}</Link> : row.name}
                  </td>
                  <td className="px-3 py-2">{row.branch}</td>
                  <td className="px-3 py-2">{row.dateLabel}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.hours} jam</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.claimedHours != null ? `${row.claimedHours} jam` : '-'}</td>
                  <td className="px-3 py-2">
                    {tab === 'waiting' ? (row.waitingDays < 1 ? 'Kurang dari 1 hari' : `${row.waitingDays} hari`)
                      : tab === 'expired' ? 'Hangus' : <Badge tone={TONES[row.urgency]}>{row.left}</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
