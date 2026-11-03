import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { Card, EmptyState } from '@/components/ui/surface';
import type { TripCard } from '../server/screens';
import { TripCardView } from './trip-card';

/** Absen Trip Hari Ini (KEH-L19): trip per tanggal + foto awak, perlu perhatian, Tidak jalan. */
export function TripAttendanceScreen({ date, today, prev, next, trips, attention, notRunning, canOpenTrip }: {
  date: string; today: string; prev: string; next: string | null; trips: (TripCard & { photoUrl: string | null })[]; attention: TripCard[];
  notRunning: { id: number; name: string; positionName: string }[]; canOpenTrip: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/kehadiran/absen-trip?tanggal=${prev}`} className={buttonClass({ variant: 'secondary', size: 'sm' })}>‹</Link>
        <span className="text-sm font-medium">{date === today ? `Hari ini, ${date}` : date}</span>
        {next && <Link href={`/kehadiran/absen-trip?tanggal=${next}`} className={buttonClass({ variant: 'secondary', size: 'sm' })}>›</Link>}
      </div>
      <p className="text-sm text-ink-muted">Absen masuk = Berangkat (satu foto awak), absen pulang = Sampai Garasi trip terakhir. Telat, istirahat, dan lembur tidak dihitung.</p>
      {attention.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Perlu perhatian</h2>
          {attention.map((t) => <TripCardView key={`a-${t.id}`} card={t} href={canOpenTrip ? `/logistik/trip/${t.id}` : null} />)}
        </section>
      )}
      <section className="space-y-2">
        <h2 className="font-semibold">Trip</h2>
        {!trips.length ? <EmptyState title="Belum ada trip berangkat pada tanggal ini." /> : trips.map((t) => (
          <TripCardView
            key={t.id} card={t} href={canOpenTrip ? `/logistik/trip/${t.id}` : null}
            extra={t.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <a href={t.photoUrl} target="_blank" rel="noreferrer"><img src={t.photoUrl} alt={`Foto awak ${t.number}`} className="max-h-40 rounded-lg" /></a>
            ) : null}
          />
        ))}
      </section>
      <Card className="space-y-2">
        <h2 className="font-semibold">Tidak jalan</h2>
        <p className="text-sm text-ink-muted">Orang yang absen lewat trip dan tidak ada di trip mana pun pada tanggal ini. Tanpa akibat.</p>
        {!notRunning.length ? <p className="text-sm">Tidak ada.</p> : (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">{notRunning.map((p) => <li key={p.id}>{p.name} <span className="text-ink-muted">({p.positionName})</span></li>)}</ul>
        )}
      </Card>
    </div>
  );
}
