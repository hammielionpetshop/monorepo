import Link from 'next/link';
import { rupiah } from '../rules/advance';

export type ScheduleView = {
  installments: { id: number; sequence: number; total: number; amount: number; period: string | null; status: string; statusLabel: string; taken: number }[];
  movements: { id: number; kind: string; amount: number; active: boolean; reason: string | null; reversedReason: string | null; text: string; at: string }[];
};

/** Jadwal cicilan per gajian dengan statusnya, lalu catatan berkurang (DRV-78, 142). */
export function ScheduleTable({ installments, movements, reverseHref }: ScheduleView & { reverseHref?: (movementId: number) => string | null }) {
  const live = installments.filter((i) => i.status !== 'CANCELLED');
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-muted">
              <th className="py-1 pr-3 font-medium">Cicilan</th>
              <th className="py-1 pr-3 font-medium">Gajian</th>
              <th className="py-1 pr-3 text-right font-medium">Nominal</th>
              <th className="py-1 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {live.map((i) => (
              <tr key={i.id}>
                <td className="py-1.5 pr-3">{i.sequence} dari {i.total}</td>
                <td className="py-1.5 pr-3">{i.period ?? 'Dipasang saat uang diberikan'}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{rupiah(i.amount)}</td>
                <td className="py-1.5">{i.statusLabel}{i.status === 'PARTIAL' ? ` (terpotong ${rupiah(i.taken)})` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {movements.length > 0 && (
        <ul className="space-y-1 text-sm">
          {movements.map((m) => (
            <li key={m.id} className={m.active ? '' : 'text-ink-muted line-through'}>
              {m.text}: <span className="tabular-nums">{rupiah(m.amount)}</span>
              {m.reason ? ` — ${m.reason}` : ''}
              {!m.active && m.reversedReason ? <span className="no-underline"> (dibalik: {m.reversedReason})</span> : null}
              {m.active && reverseHref?.(m.id) ? <> · <Link className="text-brand-700" href={reverseHref(m.id)!}>Batalkan</Link></> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
