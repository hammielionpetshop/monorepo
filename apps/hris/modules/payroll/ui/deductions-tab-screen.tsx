import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { Alert, Card } from '@/components/ui/surface';
import type { DeductionGroup, TakenItem } from '../rules/deductions';
import { longDate, rupiah } from '../rules/salary';

const timeFormat = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });

/** GAJ-L19 Potongan dan Sisa: urutan pengambilan satu orang satu periode (perkiraan). Tanpa isian dan tombol ubah. */
export function DeductionsTabScreen({ person, period, periods, computedAt, result, note }: {
  person: { id: number; name: string; positionName: string; branchName: string };
  period: { start: string; end: string; label: string };
  periods: { start: string; label: string }[];
  computedAt: string;
  result: { income: number; items: TakenItem[]; net: number; carried: number; groups: Record<DeductionGroup, string> } | null;
  note: string | null;
}) {
  const groups: DeductionGroup[] = ['a', 'b', 'c', 'd'];
  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-2" method="get">
        <select name="periode" defaultValue={period.start} className="min-h-11 rounded-md border border-line px-3" aria-label="Periode">
          {periods.map((p) => <option key={p.start} value={p.start}>{p.label}</option>)}
        </select>
        <button type="submit" className={buttonClass({ variant: 'secondary' })}>Tampilkan</button>
      </form>
      <p className="text-sm text-ink-muted">{person.positionName} · {person.branchName} · Perkiraan, dihitung pukul {timeFormat.format(new Date(computedAt))}. Slip yang ditutup kelak membaca angka yang tersimpan.</p>
      {note && <Alert tone="info">{note}</Alert>}
      {!result ? <Alert tone="warn">Belum ada gaji untuk periode ini.</Alert> : (
        <Card className="space-y-3 text-sm">
          <div className="flex justify-between font-medium"><span>Pendapatan slip (gaji tetap + lembur + kompensasi libur)</span><span className="tabular-nums">{rupiah(result.income)}</span></div>
          {groups.map((g) => {
            const rows = result.items.filter((i) => i.group === g);
            return (
              <div key={g} className="space-y-1">
                <p className="font-medium">({g}) {result.groups[g]}</p>
                {g === 'd' && !rows.length && <p className="text-ink-muted">Kasbon menyusul (L5).</p>}
                {g !== 'd' && !rows.length && <p className="text-ink-muted">Tidak ada.</p>}
                {rows.length > 0 && (
                  <table className="w-full">
                    <thead><tr className="text-left text-ink-muted"><th>Potongan</th><th className="text-right">Nominal</th><th className="text-right">Terpotong</th><th className="text-right">Sisa</th></tr></thead>
                    <tbody>{rows.map((r) => (
                      <tr key={r.key}>
                        <td>{r.label}{r.group !== 'a' && r.date !== period.start ? <span className="text-ink-muted"> · {longDate(r.date)}</span> : null}</td>
                        <td className="text-right tabular-nums">{rupiah(r.amount)}</td>
                        <td className="text-right tabular-nums">{rupiah(r.taken)}</td>
                        <td className="text-right tabular-nums">{r.left ? rupiah(r.left) : '—'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                )}
              </div>
            );
          })}
          <div className="flex justify-between border-t border-line pt-2 font-medium"><span>Gaji bersih (belum termasuk bonus)</span><span className="tabular-nums">{rupiah(result.net)}</span></div>
          {result.carried > 0 && <p>Sisa potongan dibawa ke slip berikutnya: <b className="tabular-nums">{rupiah(result.carried)}</b> (disimpan saat slip ditutup).</p>}
        </Card>
      )}
      <Link className="underline text-sm" href="/panduan/aturan-potongan">Lihat aturan urutan potongan</Link>
    </div>
  );
}
