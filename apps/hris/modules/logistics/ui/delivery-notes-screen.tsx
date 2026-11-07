import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert, Badge } from '@/components/ui/surface';
import type { QueueStatus } from '../rules/delivery-notes';
import { rupiah } from '../rules/rates';
import type { NoteRow, NotesFilter } from '../server/delivery-notes';
import { NoteDecision } from './note-decision';
import { LoadPhotoBadge } from './load-photo-badge';

type Option = { id: number; name: string };

const selectClass = 'min-h-9 rounded-lg border border-line bg-surface px-3 text-sm';

function href(filter: NotesFilter, tab: QueueStatus) {
  const params = new URLSearchParams({ tab });
  if (filter.originId) params.set('asal', String(filter.originId));
  if (filter.routeId) params.set('rute', String(filter.routeId));
  if (filter.q) params.set('cari', filter.q);
  return `/logistik/surat-jalan?${params}`;
}

/** Surat Jalan (spec LT1 §12): nota dan PO Internal bertanda truk Gudang, dibaca langsung dari kasir. */
export function DeliveryNotesScreen({ tab, tabs, rows, truncated, from, hasBackoffice, origins, routes, filter, canStores, canDecide, reopenDays, pending }: {
  /** Tab Tertunda (spec LT1 §14.1 butir 3) di halaman sendiri. */
  pending: { total: number; red: number };
  tab: QueueStatus; tabs: { status: QueueStatus; label: string; count: number }[]; rows: NoteRow[]; truncated: boolean; from: string; today: string;
  hasBackoffice: boolean; origins: Option[]; routes: Option[]; filter: NotesFilter; canStores: boolean; canDecide: boolean; reopenDays: number;
}) {
  const decisionTab = tab === 'NEEDS_DECISION' || tab === 'DROPPED' || tab === 'DELIVERED';
  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-1" aria-label="Tab surat jalan">
        {tabs.map((t) => (
          <Link key={t.status} href={href(filter, t.status)} className={buttonClass({ variant: t.status === tab ? 'primary' : 'secondary', size: 'sm' })}>
            {t.label} <span className="ml-1 tabular-nums opacity-80">{t.count}</span>
          </Link>
        ))}
        <Link href="/logistik/surat-jalan/tertunda" className={buttonClass({ variant: pending.red ? 'danger' : 'secondary', size: 'sm' })}>
          Tertunda <span className="ml-1 tabular-nums opacity-80">{pending.total}</span>
        </Link>
        <NewBadge feature="/logistik/surat-jalan/tertunda" />
      </nav>

      <form action="/logistik/surat-jalan" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value={tab} />
        <select name="asal" defaultValue={filter.originId ?? ''} className={selectClass} aria-label="Cabang asal">
          <option value="">Semua cabang asal</option>
          {origins.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select name="rute" defaultValue={filter.routeId ?? ''} className={selectClass} aria-label="Rute bawaan">
          <option value="">Semua rute</option>
          {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <input name="cari" defaultValue={filter.q} placeholder="Nomor atau nama toko" className={`${selectClass} w-52`} />
        <button type="submit" className={buttonClass({ variant: 'secondary', size: 'sm' })}>Tampilkan</button>
      </form>

      {tab === 'WAITING' && (
        <p className="text-sm text-ink-muted">
          Nota yang dipilih <b>Dikirim truk Gudang</b> di kasir dan PO Internal yang dikirim <b>Truk Gudang</b>, sejak {from}, paling lama di atas.
          Salah tandai? Ubah cara kirimnya di Back Office; nota langsung keluar dari daftar ini. Masukkan ke trip lewat
          {' '}<Link href="/logistik/trip/baru" className="underline">Buat trip</Link>.
        </p>
      )}
      {tab === 'ON_TRIP' && (
        <p className="text-sm text-ink-muted">
          Surat jalan yang sudah dicentang ke trip. Untuk mengeluarkannya, buka trip-nya lalu tekan <b>Lepas</b> (atau ubah trip selagi Draft).
        </p>
      )}
      {tab === 'NEEDS_DECISION' && (
        <p className="text-sm text-ink-muted">
          Kiriman yang Gagal di toko (ditolak, batal pesan, alamat tidak ketemu). <b>Kirim ulang</b> mengembalikannya ke antrean;
          {' '}<b>Batal</b> menghentikan pengiriman (batalkan juga notanya di kasir).
        </p>
      )}
      {tab === 'DROPPED' && <p className="text-sm text-ink-muted">Dibatalkan logistik. Pemilik atau GM bisa membuka lagi sampai {reopenDays} hari sesudah dibatalkan.</p>}
      {!hasBackoffice && <Alert tone="warn">Alamat Back Office belum diatur, jadi tombol Ubah tidak tampil. Buka Back Office › Transaksi lalu cari nomornya.</Alert>}
      {truncated && <Alert tone="warn">Daftar terlalu panjang; hanya 300 terlama per jenis yang ditampilkan. Persempit dengan saringan.</Alert>}

      <DataList
        rows={rows}
        rowKey={(r) => r.key}
        empty={{
          WAITING: 'Tidak ada yang menunggu dikirim.', ON_TRIP: 'Tidak ada surat jalan di trip.', NEEDS_DECISION: 'Tidak ada yang perlu diputuskan.',
          DELIVERED: 'Belum ada yang terkirim.', RECEIVED: 'Belum ada PO Internal yang diterima.', CANCELLED: 'Tidak ada yang batal di kasir.', DROPPED: 'Tidak ada yang dibatalkan logistik.',
        }[tab]}
        columns={[
          {
            key: 'number', header: 'Nomor', primary: true,
            render: (r) => (
              <span className="inline-flex flex-wrap items-center gap-1">
                <span className="font-medium">{r.number}</span>
                <Badge tone={r.kind === 'SALE' ? 'info' : 'ok'}>{r.kind === 'SALE' ? 'Nota' : 'PO Internal'}</Badge>
                {r.revised && <Badge tone="warn">Dikoreksi</Badge>}
                {r.pendingVoid && <Badge tone="warn">Menunggu batal</Badge>}
                {r.tomorrowCount > 0 && <Badge tone="warn">Pernah tertunda ×{r.tomorrowCount}</Badge>}
                <LoadPhotoBadge load={r.load} />
              </span>
            ),
          },
          { key: 'on', header: 'Tanggal', render: (r) => <span>{r.on}{tab === 'WAITING' && <span className="text-ink-muted"> · {r.age === 0 ? 'hari ini' : `${r.age} hari`}</span>}</span> },
          { key: 'origin', header: 'Dari', render: (r) => r.origin },
          {
            key: 'to', header: 'Tujuan',
            render: (r) => (r.customerId && canStores
              ? <Link href={`/logistik/toko/${r.customerId}`} className="underline">{r.destination}</Link>
              : <span>{r.destination}{r.kind === 'TRANSFER' && <span className="text-ink-muted"> (cabang)</span>}</span>),
          },
          { key: 'route', header: 'Rute bawaan', render: (r) => (r.kind === 'TRANSFER' ? '—' : r.route ?? <span className="text-ink-muted">belum diisi</span>) },
          ...(tab === 'ON_TRIP' || tab === 'CANCELLED' ? [{
            key: 'trip', header: 'Trip',
            render: (r: NoteRow) => (r.trip ? <Link href={`/logistik/trip/${r.trip.id}`} className="underline">{r.trip.number}</Link> : '—'),
          }] : []),
          ...(decisionTab ? [{
            key: 'event', header: tab === 'DELIVERED' ? 'Terkirim' : tab === 'DROPPED' ? 'Dibatalkan' : 'Gagal',
            render: (r: NoteRow) => (r.event ? (
              <span className="text-sm">
                {r.event.on} {r.event.at}
                {r.event.trip && <> · <Link href={`/logistik/trip/${r.event.trip.id}`} className="underline">{r.event.trip.number}</Link></>}
                {r.event.reason && <span className="block text-ink-muted">{r.event.reason}</span>}
              </span>
            ) : '—'),
          }] : []),
          { key: 'amount', header: 'Nominal', render: (r) => (r.amount == null ? '—' : <span className="tabular-nums">{rupiah(r.amount)}</span>) },
          ...((tab === 'NEEDS_DECISION' && canDecide) || tab === 'DROPPED' ? [{
            key: 'decide', header: '',
            render: (r: NoteRow) => (r.noteId && (tab === 'NEEDS_DECISION' || r.canReopen)
              ? <NoteDecision noteId={r.noteId} number={r.number} mode={tab === 'NEEDS_DECISION' ? 'decide' : 'reopen'} link={r.link} />
              : null),
          }] : []),
          {
            key: 'link', header: '',
            render: (r) => (r.link
              ? <a href={r.link} target="_blank" rel="noreferrer" className={buttonClass({ variant: 'ghost', size: 'sm' })}>Ubah di Back Office</a>
              : null),
          },
        ]}
      />
    </div>
  );
}
