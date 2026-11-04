import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert, Badge } from '@/components/ui/surface';
import type { StoreRow } from '../server/delivery-notes';

/** Tab Data Toko: daftar toko dan Titik menunggu (spec LT1 §13.4 butir 2). */
export function StoreTabs({ tab, pendingPoints }: { tab: 'list' | 'points'; pendingPoints: number }) {
  return (
    <nav className="flex flex-wrap items-center gap-1" aria-label="Tab Data Toko">
      <Link href="/logistik/toko" className={buttonClass({ variant: tab === 'list' ? 'primary' : 'secondary', size: 'sm' })}>Daftar toko</Link>
      <Link href="/logistik/toko?tab=titik" className={buttonClass({ variant: tab === 'points' ? 'primary' : 'secondary', size: 'sm' })}>
        Titik menunggu <span className="ml-1 tabular-nums opacity-80">{pendingPoints}</span>
      </Link>
      <NewBadge feature="fitur/titik-toko" />
    </nav>
  );
}

/** Data Toko (spec LT1 §12): toko = pelanggan kasir. HRIS hanya menambah rute bawaan dan catatan pengiriman. */
export function StoresScreen({ stores, query, searching, truncated, from, pendingPoints }: {
  stores: StoreRow[]; query: string; searching: boolean; truncated: boolean; from: string; pendingPoints: number;
}) {
  return (
    <div className="space-y-4">
      <StoreTabs tab="list" pendingPoints={pendingPoints} />
      <form action="/logistik/toko" className="flex flex-wrap items-center gap-2">
        <input name="cari" defaultValue={query} placeholder="Cari nama, kode, atau HP pelanggan" className="min-h-9 w-72 rounded-lg border border-line bg-surface px-3 text-sm" />
        <button type="submit" className={buttonClass({ variant: 'secondary', size: 'sm' })}>Cari</button>
        {searching && <Link href="/logistik/toko" className={buttonClass({ variant: 'ghost', size: 'sm' })}>Kembali ke daftar</Link>}
      </form>
      <p className="text-sm text-ink-muted">
        {searching
          ? `Hasil cari semua pelanggan kasir untuk "${query}".`
          : `Toko yang pernah dikirimi truk Gudang sejak ${from} atau sudah diisi data pengirimannya. Toko lain: pakai kotak cari.`}
        {' '}Nama, HP, dan alamat diubah di kasir.
      </p>
      {truncated && <Alert tone="warn">Hanya 300 toko pertama yang ditampilkan. Persempit pencarian.</Alert>}
      <DataList
        rows={stores}
        rowKey={(s) => s.customerId}
        empty={searching ? 'Pelanggan tidak ditemukan.' : 'Belum ada toko yang dikirimi truk.'}
        columns={[
          {
            key: 'name', header: 'Toko', primary: true,
            render: (s) => (
              <span className="inline-flex flex-wrap items-center gap-1">
                <Link href={`/logistik/toko/${s.customerId}`} className="font-medium underline">{s.name}</Link>
                {s.code && <span className="text-ink-muted">{s.code}</span>}
                {!s.active && <Badge tone="danger">Nonaktif di kasir</Badge>}
              </span>
            ),
          },
          { key: 'phone', header: 'HP', render: (s) => s.phone ?? '—' },
          {
            key: 'point', header: 'Titik',
            render: (s) => (s.pointPending ? <Badge tone="warn">Menunggu</Badge> : s.hasPoint ? <Badge tone="ok">Ada</Badge> : <span className="text-ink-muted">belum</span>),
          },
          { key: 'route', header: 'Rute bawaan', render: (s) => s.route ?? <span className="text-ink-muted">belum diisi</span> },
          { key: 'waiting', header: 'Menunggu dikirim', render: (s) => <span className="tabular-nums">{s.waiting}</span> },
          { key: 'last', header: 'Nota truk terakhir', render: (s) => s.lastOn ?? '—' },
        ]}
      />
    </div>
  );
}
