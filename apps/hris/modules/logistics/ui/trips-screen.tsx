import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { Alert, EmptyState } from '@/components/ui/surface';
import type { TripCard, TripTab } from '../server/screens';
import { TripCardView } from './trip-card';

const TABS: { key: TripTab; label: string }[] = [
  { key: 'today', label: 'Hari ini' },
  { key: 'hanging', label: 'Menggantung' },
  { key: 'history', label: 'Riwayat' },
];

/** Layar Trip (spec L6 §4) untuk Kepala Gudang, Pemilik, GM. */
export function TripsScreen({ tab, date, trips, canManage, fence }: {
  tab: TripTab; date: string; today: string; trips: TripCard[]; canManage: boolean; fence: { until: string; reason: string } | null;
}) {
  return (
    <div className="space-y-4">
      {fence && <Alert tone="warn" title="Pagar uji mati">Sampai Garasi tidak diperiksa titiknya sampai {fence.until}. Alasan: {fence.reason}</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav className="flex flex-wrap gap-1" aria-label="Tab trip">
          {TABS.map((t) => (
            <Link key={t.key} href={`/logistik/trip?tab=${t.key}`} className={buttonClass({ variant: t.key === tab ? 'primary' : 'secondary', size: 'sm' })}>{t.label}</Link>
          ))}
        </nav>
        {canManage && <Link href="/logistik/trip/baru" className={buttonClass({ size: 'sm' })}>Buat trip</Link>}
      </div>
      {tab === 'history' && (
        <form action="/logistik/trip" className="flex items-center gap-2">
          <input type="hidden" name="tab" value="history" />
          <input type="date" name="tanggal" defaultValue={date} className="min-h-9 rounded-lg border border-line bg-surface px-3 text-sm" />
          <button type="submit" className={buttonClass({ variant: 'secondary', size: 'sm' })}>Tampilkan</button>
        </form>
      )}
      {!trips.length ? (
        <EmptyState title={tab === 'hanging' ? 'Tidak ada trip menggantung' : tab === 'history' ? `Tidak ada trip pada ${date}` : 'Belum ada trip hari ini'}>
          {tab === 'today' && canManage ? 'Buat trip: pilih mobil, rute kirim, supplier belanja, driver, dan kenek.' : undefined}
        </EmptyState>
      ) : trips.map((t) => <TripCardView key={t.id} card={t} href={`/logistik/trip/${t.id}`} />)}
    </div>
  );
}
