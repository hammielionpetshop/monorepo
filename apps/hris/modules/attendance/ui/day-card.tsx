import { Badge } from '@/components/ui/surface';
import type { DayCard as DayCardData } from '../server/review';

/** Isi kartu satu hari kerja; dipakai Catatan Hari Kerja, Rekap, dan Kehadiran Saya supaya angkanya sama (KEH-76). */
export function DayCardBody({ card, office }: { card: DayCardData; office: boolean }) {
  const rows: [string, string][] = [
    ['Cabang', card.branch],
    ['Shift', card.shift ? `${card.shift}${card.hours ? ` (${card.hours})` : ''}` : 'Belum ditentukan'],
    ['Masuk', card.times.IN],
    ['Istirahat', card.times.BREAK],
    ['Masuk kembali', card.times.RETURN],
    ['Pulang', card.times.OUT],
    ['Telat', card.lateMinutes != null ? `${card.lateMinutes} menit` : '-'],
    ['Pulang cepat', card.earlyLeaveMinutes != null ? `${card.earlyLeaveMinutes} menit` : '-'],
    ['Lewat batas istirahat', card.breakOverMinutes != null ? `${card.breakOverMinutes} menit` : '-'],
    ['Lembur', '-'],
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={card.status === 'PRESENT' ? 'ok' : card.status === 'CLOSED' ? 'info' : 'warn'}>{card.statusLabel}</Badge>
        {card.status !== 'UNDETERMINED' && <span className="text-xs text-ink-muted">Asal: {card.source}</span>}
        {office && card.inTolerance && <Badge>Dalam toleransi</Badge>}
        {card.tags.map((tag) => <Badge key={tag} tone={tag === 'Perlu ditinjau' ? 'warn' : 'info'}>{tag}</Badge>)}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-ink-muted">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
