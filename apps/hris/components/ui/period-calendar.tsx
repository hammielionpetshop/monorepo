import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export type CalendarCell = {
  date: string;
  /** Tanda utama di bawah tanggal, mis. "Libur", "Penuh". */
  label?: string | null;
  tone?: 'selected' | 'muted' | 'warn' | 'info';
  /** Nama di bawah tanggal, mis. teman yang libur (KEH-107). */
  names?: string[];
  disabled?: boolean;
};

function dayIndex(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/**
 * Kalender periode 26–25 (KEH-L26/L27): tanggal disusun per minggu Senin–Minggu, tiap tanggal bertanda.
 * Bisa diketuk bila `onPick` diisi; tanggal `disabled` tidak bisa diketuk.
 */
export function PeriodCalendar({ cells, onPick, today, footer }: {
  cells: CalendarCell[]; onPick?: (date: string) => void; today?: string; footer?: (cell: CalendarCell) => ReactNode;
}) {
  if (!cells.length) return null;
  const blanks = dayIndex(cells[0].date);
  return (
    <div className="rounded-card border border-line bg-surface p-2">
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-ink-muted">
        {DAY_NAMES.map((name) => <div key={name} className="py-1 font-medium">{name}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: blanks }, (_, index) => <div key={`blank-${index}`} />)}
        {cells.map((cell) => {
          const [, month, day] = cell.date.split('-');
          const clickable = Boolean(onPick) && !cell.disabled;
          const content = (
            <>
              <span className={cn('block text-sm font-semibold', cell.date === today && 'underline')}>{Number(day)}/{Number(month)}</span>
              {cell.label && <span className="block text-[10px] leading-tight">{cell.label}</span>}
              {cell.names?.length ? <span className="block truncate text-[10px] leading-tight text-ink-muted">{cell.names.join(', ')}</span> : null}
              {footer?.(cell)}
            </>
          );
          const className = cn(
            'min-h-16 rounded-lg border p-1 text-left',
            cell.tone === 'selected' && 'border-brand-600 bg-brand-600 text-white',
            cell.tone === 'muted' && 'border-line bg-canvas text-ink-muted',
            cell.tone === 'warn' && 'border-line bg-warn-bg text-warn-fg',
            cell.tone === 'info' && 'border-line bg-info-bg text-info-fg',
            !cell.tone && 'border-line',
            clickable && 'hover:border-brand-600',
          );
          return clickable ? (
            <button key={cell.date} type="button" className={className} onClick={() => onPick!(cell.date)} aria-pressed={cell.tone === 'selected'}>
              {content}
            </button>
          ) : <div key={cell.date} className={className}>{content}</div>;
        })}
      </div>
    </div>
  );
}
