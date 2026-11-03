import Link from 'next/link';
import { DataList } from '@/components/ui/data-list';
import { Alert } from '@/components/ui/surface';

type Row = { start: string; label: string; status: string; estimate: number; closed: number; paid: number; opensText: string };

/** GAJ-L08 Periode Slip: satu baris per periode. Admin HR dan Finance hanya melihat tanggal dan status. */
export function PeriodsScreen({ rows, canOpen, from }: { rows: Row[]; canOpen: boolean; from: string }) {
  return (
    <div className="space-y-3">
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
        ]}
      />
    </div>
  );
}
