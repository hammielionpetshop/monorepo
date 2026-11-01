import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

function dayLabel(date: string): string {
  const [, month, day] = date.split('-');
  return `${Number(day)}/${Number(month)}`;
}

/** Tabel minggu: baris = orang, kolom = Senin sampai Minggu (KEH-L02). Di HP bisa digeser ke samping. */
export function WeekTable<T>({
  dates, rows, rowKey, rowLabel, renderCell, empty = 'Belum ada orang.',
}: {
  dates: string[];
  rows: T[];
  rowKey: (row: T) => string | number;
  rowLabel: (row: T) => ReactNode;
  renderCell: (row: T, date: string, index: number) => ReactNode;
  empty?: string;
}) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-ink-muted">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-muted">
            <th scope="col" className="sticky left-0 bg-surface px-3 py-2 font-medium">Nama</th>
            {dates.map((date, index) => (
              <th scope="col" key={date} className="px-2 py-2 font-medium">{DAY_NAMES[index]} {dayLabel(date)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-line last:border-0">
              <th scope="row" className="sticky left-0 bg-surface px-3 py-2 text-left font-medium">{rowLabel(row)}</th>
              {dates.map((date, index) => <td key={date} className="px-1 py-1 align-top">{renderCell(row, date, index)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Strip tujuh hari untuk HP: satu kartu per hari (KEH-L05). */
export function DayStrip({ days }: { days: { date: string; title: string; detail?: string | null; today?: boolean; tone?: 'muted' | 'warn' }[] }) {
  return (
    <ul className="space-y-2">
      {days.map((day, index) => (
        <li
          key={day.date}
          className={cn('flex items-center justify-between rounded-card border border-line bg-surface p-3', day.today && 'border-brand-600')}
        >
          <span className="text-sm font-medium">{DAY_NAMES[index]} {dayLabel(day.date)}{day.today ? ' · Hari ini' : ''}</span>
          <span className={cn('text-right text-sm', day.tone === 'muted' && 'text-ink-muted', day.tone === 'warn' && 'text-warn-fg')}>
            <span className="block font-medium">{day.title}</span>
            {day.detail && <span className="block text-xs text-ink-muted">{day.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
