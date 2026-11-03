import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { rupiah } from '../rules/salary';

type Row = { id: number; period: string; status: string; number: string | null; net: number | null; version: number };

/** Tab Slip di Gaji Seseorang: daftar slip orang itu per periode. */
export function PersonSlipsScreen({ person, rows }: { person: { id: number; name: string }; rows: Row[] }) {
  return (
    <div className="space-y-3">
      <Link className={buttonClass({ variant: 'ghost' })} href={`/gaji/${person.id}`}>Kembali ke Gaji</Link>
      <DataList
        rows={rows}
        rowKey={(r) => r.id}
        empty="Belum ada slip."
        columns={[
          { key: 'period', header: 'Periode', primary: true, render: (r) => <Link className="underline" href={`/gaji/slip/${r.id}`}>{r.period}</Link> },
          { key: 'status', header: 'Status', render: (r) => `${r.status}${r.version > 1 ? ` · versi ${r.version}` : ''}` },
          { key: 'number', header: 'Nomor', render: (r) => r.number ?? '—' },
          { key: 'net', header: 'Bersih', render: (r) => (r.net == null ? 'Perkiraan' : rupiah(r.net)) },
        ]}
      />
    </div>
  );
}
