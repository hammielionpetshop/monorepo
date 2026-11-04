import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { NewBadge } from '@/components/ui/new-badge';
import { Badge, Card } from '@/components/ui/surface';
import { rupiah } from '../rules/rates';
import type { TripNoteView, TripPickupView, TripVisitView } from '../server/trip-notes';

function ChangeBadge({ note }: { note: TripNoteView }) {
  if (!note.change) return null;
  if (note.change.kind === 'cancelled') return <Badge tone="danger">{note.change.pending ? 'Menunggu batal di kasir' : 'Dibatalkan di kasir'}</Badge>;
  if (note.change.from === note.change.to) return <Badge tone="warn">Dikoreksi di kasir</Badge>;
  return <Badge tone="warn">Berubah di kasir: {rupiah(note.change.from)} → {rupiah(note.change.to)}</Badge>;
}

export type VisitAction = 'DELIVERED' | 'TOMORROW' | 'FAILED' | 'RETRY';
export type PointAction = 'NEW' | 'CORRECTION';

/**
 * Surat jalan di trip (spec LT1 §3.4–3.6): langkah ambil barang di cabang asal dan kunjungan per tujuan. Dipakai rincian
 * trip (kantor, ada tombol Lepas) dan Trip Saya (awak: ambil barang, Terkirim / Kirim Besok / Gagal / Coba lagi, LT1b-2a).
 */
export function TripNotesPanel({ visits, pickups, onRelease, onPickup, onVisit, onPoint, storeLinks, compact }: {
  visits: TripVisitView[]; pickups: TripPickupView[];
  onRelease?: (visit: TripVisitView) => void; onPickup?: (pickup: TripPickupView) => void; onVisit?: (visit: TripVisitView, action: VisitAction) => void;
  /** Titik toko dari kunjungan (spec LT1 §13.4): awak trip selama Berjalan. */
  onPoint?: (visit: TripVisitView, action: PointAction) => void;
  storeLinks?: boolean; compact?: boolean;
}) {
  const shown = visits.filter((v) => v.status !== 'RELEASED' || !compact);
  const pickupsShown = pickups.filter((p) => p.status !== 'DROPPED');
  const totalNotes = visits.filter((v) => v.status === 'OPEN').reduce((sum, v) => sum + v.notes.length, 0);
  const counted = visits.filter((v) => v.status !== 'RELEASED');
  // Kunjungan Kirim Besok yang sudah dicoba lagi tidak dihitung dua kali.
  const retried = new Set(counted.filter((v) => v.status === 'OPEN').map((v) => v.customerId ?? `B${v.destination}`));
  const finished = counted.filter((v) => v.status !== 'OPEN' && !(v.status === 'TOMORROW' && retried.has(v.customerId ?? `B${v.destination}`))).length;
  const total = finished + counted.filter((v) => v.status === 'OPEN').length;
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">Surat jalan <NewBadge feature="fitur/surat-jalan-di-trip" /></h2>
        <span className="text-sm text-ink-muted">
          {total > 0 && <>{finished} dari {total} selesai · </>}{visits.filter((v) => v.status === 'OPEN').length} tujuan belum dikunjungi · {totalNotes} surat jalan
        </span>
      </div>
      {!visits.length && !pickups.length && <p className="text-sm text-ink-muted">Trip ini tanpa surat jalan.</p>}

      {pickupsShown.length > 0 && (
        <ul className="space-y-2">
          {pickupsShown.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-2 text-sm">
              <span className="inline-flex flex-wrap items-center gap-1">
                <span className="font-medium">Ambil barang di {p.origin}</span>
                <span className="text-ink-muted">({p.noteCount} surat jalan)</span>
                <Badge tone={p.status === 'DONE' ? 'ok' : p.status === 'OPEN' ? 'info' : 'warn'}>{p.statusLabel}</Badge>
                {p.reason && p.status !== 'DONE' && <span className="text-ink-muted">· {p.reason}</span>}
                {p.photoUrl && <a href={p.photoUrl} target="_blank" rel="noreferrer" className="underline">Foto barang</a>}
              </span>
              {onPickup && p.status === 'OPEN' && <Button size="sm" onClick={() => onPickup(p)}>Barang sudah diambil</Button>}
            </li>
          ))}
        </ul>
      )}

      {shown.length > 0 && (
        <ul className="space-y-2">
          {shown.map((v) => (
            <li key={v.id} className="space-y-1 rounded-lg border border-line p-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex flex-wrap items-center gap-1">
                  {storeLinks && v.customerId
                    ? <Link href={`/logistik/toko/${v.customerId}`} className="font-medium underline">{v.destination}</Link>
                    : <span className="font-medium">{v.destination}</span>}
                  {v.customerId == null && <span className="text-ink-muted">(cabang)</span>}
                  <Badge tone={v.tone}>{v.statusLabel}</Badge>
                  {v.at && <span className="text-ink-muted">{v.at}{v.by ? ` · ${v.by}` : ''}</span>}
                  {v.reason && v.status !== 'OPEN' && <span className="text-ink-muted">· {v.reason}</span>}
                  {v.photoUrl && <a href={v.photoUrl} target="_blank" rel="noreferrer" className="underline">Foto</a>}
                </span>
                {onRelease && v.status === 'OPEN' && <Button size="sm" variant="ghost" onClick={() => onRelease(v)}>Lepas</Button>}
              </div>
              {(v.phone || v.address || v.deliveryNote) && (
                <div className="space-y-0.5 text-xs text-ink-muted">
                  {v.address && <p>{v.address}</p>}
                  {v.phone && <p>Telp <a href={`tel:${v.phone.replace(/[^\d+]/g, '')}`} className="underline">{v.phone}</a></p>}
                  {v.deliveryNote && <p className="text-ink">Catatan: {v.deliveryNote}</p>}
                </div>
              )}
              {v.customerId != null && (v.point || v.pointPending || onPoint || v.distanceM != null) && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {v.point && <a href={v.point.mapUrl} target="_blank" rel="noreferrer" className="font-medium underline">Buka peta</a>}
                  {v.pointPending && <Badge tone="warn">Titik menunggu persetujuan</Badge>}
                  {!compact && v.distanceM != null && (
                    <span className="inline-flex items-center gap-1 text-ink-muted">
                      Terkirim ± {v.distanceM} m dari titik {v.outside && <Badge tone="warn">Di luar titik</Badge>}
                    </span>
                  )}
                  {onPoint && !v.pointPending && (v.point
                    ? <Button size="sm" variant="ghost" onClick={() => onPoint(v, 'CORRECTION')}>Laporkan titik salah</Button>
                    : <Button size="sm" variant="secondary" onClick={() => onPoint(v, 'NEW')}>Pasang titik toko</Button>)}
                  <NewBadge feature="fitur/titik-toko" />
                </div>
              )}
              {v.waitsForPickup.length > 0 && <p className="text-xs text-ink-muted">Menunggu barang diambil di {v.waitsForPickup.join(', ')}.</p>}
              <ul className="space-y-0.5 pl-2">
                {v.notes.map((n) => (
                  <li key={n.key} className="flex flex-wrap items-center gap-1">
                    <span className="tabular-nums">{n.number}</span>
                    <Badge tone={n.kind === 'SALE' ? 'info' : 'ok'}>{n.kind === 'SALE' ? 'Nota' : 'PO Internal'}</Badge>
                    <span className="text-ink-muted">dari {n.origin}</span>
                    {n.amount != null && <span className="tabular-nums">{rupiah(n.amount)}</span>}
                    {n.tomorrowCount > 0 && <Badge tone="warn">Pernah tertunda ×{n.tomorrowCount}</Badge>}
                    <ChangeBadge note={n} />
                    {!compact && n.link && <a href={n.link} target="_blank" rel="noreferrer" className="underline">Back Office</a>}
                  </li>
                ))}
              </ul>
              {onVisit && v.status === 'OPEN' && (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <Button className="min-h-11" onClick={() => onVisit(v, 'DELIVERED')}>Terkirim</Button>
                  <Button className="min-h-11" variant="secondary" onClick={() => onVisit(v, 'TOMORROW')}>Kirim Besok</Button>
                  <Button className="min-h-11" variant="danger" onClick={() => onVisit(v, 'FAILED')}>Gagal</Button>
                </div>
              )}
              {onVisit && v.status === 'TOMORROW' && !retried.has(v.customerId ?? `B${v.destination}`) && (
                <Button size="sm" variant="secondary" onClick={() => onVisit(v, 'RETRY')}>Coba lagi</Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
