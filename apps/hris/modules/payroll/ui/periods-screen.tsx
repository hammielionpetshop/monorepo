import Link from 'next/link';
import { DataList } from '@/components/ui/data-list';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert } from '@/components/ui/surface';

type Row = { start: string; label: string; status: string; estimate: number; closed: number; paid: number; opensText: string };
type WeekRow = Row & { key: string };

/** GAJ-L08 Periode Slip: satu baris per periode bulanan, lalu minggu upah (slip mingguan L7b). Admin HR dan Finance hanya melihat tanggal dan status. */
export function PeriodsScreen({ rows, weeks, canOpen, canSummary, from, weeklyFrom }: {
  rows: Row[]; weeks: WeekRow[]; canOpen: boolean; canSummary: boolean; from: string; weeklyFrom: string;
}) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Slip bulanan (26–25)</h2>
        <Alert tone="info">Slip pertama di HRIS mulai periode {from}. Periode sebelumnya dibayar lewat HRIS lama.</Alert>
        <DataList
          rows={rows}
          rowKey={(r) => r.start}
          empty="Belum ada periode slip."
          columns={[
            { key: 'label', header: 'Periode', primary: true, render: (r) => (canOpen ? <Link className="underline" href={`/gaji/periode/${r.start}`}>{r.label}</Link> : r.label) },
            { key: 'status', header: 'Status', render: (r) => r.status },
            ...(canOpen ? [
              { key: 'estimate', header: 'Perkiraan', render: (r: Row) => r.estimate },
              { key: 'closed', header: 'Ditutup', render: (r: Row) => r.closed },
              { key: 'paid', header: 'Dibayar', render: (r: Row) => r.paid },
            ] : []),
            { key: 'opens', header: 'Tutup aktif mulai', render: (r) => r.opensText },
            // Ringkasan Gaji bentuk Finance (L4f-2): total perusahaan tanpa per cabang dan tanpa gaji Pemilik/GM.
            ...(canSummary && !canOpen ? [{ key: 'summary', header: 'Ringkasan', render: (r: Row) => (r.closed ? <Link className="underline" href={`/gaji/periode/${r.start}/ringkasan`}>Ringkasan</Link> : '—') }] : []),
          ]}
        />
      </section>
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">Slip mingguan (driver & kenek) <NewBadge feature="fitur/slip-mingguan" /></h2>
        <p className="text-sm text-ink-muted">
          Satu baris per minggu upah, mulai {weeklyFrom}. Hari awal minggu diatur di Pengaturan › Gaji (bawaan Jumat–Kamis, bayar Sabtu).
        </p>
        <DataList
          rows={weeks}
          rowKey={(r) => r.key}
          empty="Belum ada minggu slip."
          columns={[
            { key: 'label', header: 'Minggu', primary: true, render: (r) => (canOpen ? <Link className="underline" href={`/gaji/periode/${r.key}`}>{r.label}</Link> : r.label) },
            { key: 'status', header: 'Status', render: (r) => r.status },
            ...(canOpen ? [
              { key: 'estimate', header: 'Perkiraan', render: (r: WeekRow) => r.estimate },
              { key: 'closed', header: 'Ditutup', render: (r: WeekRow) => r.closed },
              { key: 'paid', header: 'Dibayar', render: (r: WeekRow) => r.paid },
            ] : []),
            { key: 'opens', header: 'Tutup aktif mulai', render: (r) => r.opensText },
          ]}
        />
      </section>
    </div>
  );
}
