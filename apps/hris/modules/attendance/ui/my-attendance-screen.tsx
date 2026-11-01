'use client';

import { useRouter } from 'next/navigation';
import { Field, Select } from '@/components/ui/field';
import { Badge, Card, EmptyState } from '@/components/ui/surface';
import type { RecapTotals } from '../rules/review';
import type { DayCard } from '../server/review';
import { DayCardBody } from './day-card';

type Period = { start: string; end: string };

/**
 * KEH-L17 Kehadiran Saya (HP). Angka sama dengan rekap kantor (KEH-76); telat apa adanya,
 * tanpa kata toleransi dan tanpa nominal potongan (KEH-119).
 */
export function MyAttendanceScreen({ period, periods, totals, days }: {
  period: Period; periods: Period[]; totals: RecapTotals; days: (DayCard & { note: string | null })[];
}) {
  const router = useRouter();
  const tiles: [string, string][] = [
    ['Hadir', String(totals.present)],
    ['Telat', totals.lateCount ? `${totals.lateCount}× (${totals.lateMinutes} menit)` : '0'],
    ['Pulang cepat', String(totals.earlyCount)],
    ['Hari tutup', String(totals.closed)],
    ['Libur terjadwal', String(totals.dayOff)],
    ['Belum ditentukan', String(totals.undetermined)],
    ['Izin, sakit, cuti, alpha, lembur', '-'],
  ];
  return (
    <div className="space-y-4">
      <Field id="my-period" label="Periode">
        <Select id="my-period" value={period.start} onChange={(event) => router.push(`/kehadiran-saya?period=${event.target.value}`)}>
          {periods.map((item) => <option key={item.start} value={item.start}>{item.start} s.d. {item.end}</option>)}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map(([label, value]) => (
          <Card key={label} className="p-3 sm:p-3">
            <p className="text-xs text-ink-muted">{label}</p>
            <p className="text-lg font-semibold tabular-nums">{value}</p>
          </Card>
        ))}
      </div>
      {!days.length && <EmptyState title="Belum ada catatan kehadiran di periode ini." />}
      <ul className="space-y-2">
        {days.map((day) => (
          <li key={day.workDate}>
            <details className="rounded-card border border-line bg-surface p-3">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{day.workDate}</span>
                <span className="text-sm text-ink-muted">{day.times.IN}–{day.times.OUT}{day.lateMinutes ? ` · telat ${day.lateMinutes} menit` : ''}</span>
                <Badge tone={day.status === 'PRESENT' ? 'ok' : day.status === 'CLOSED' ? 'info' : 'warn'}>{day.statusLabel}</Badge>
              </summary>
              <div className="mt-3 space-y-2">
                <DayCardBody card={day} office={false} />
                {day.note && <p className="text-sm text-ink-muted">{day.note}</p>}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
