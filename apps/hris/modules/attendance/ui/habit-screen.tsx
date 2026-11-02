import { buttonClass } from '@/components/ui/button';
import { Alert, EmptyState } from '@/components/ui/surface';

type Period = { start: string; end: string };
type Props = {
  period: Period; periods: Period[]; min: number;
  rows: { employeeId: number; name: string; branch: string; in: number; out: number; return: number; total: number; rejected: number; days: string[] }[];
};

/** KEH-L39 Laporan Kebiasaan Lupa Absen (Pemilik dan GM). Tanpa nominal; nominal milik Gaji. */
export function HabitScreen({ period, periods, min, rows }: Props) {
  return (
    <div className="space-y-4">
      <form method="get" className="flex flex-wrap items-end gap-2">
        <label className="text-sm">Periode{' '}
          <select name="period" defaultValue={period.start} className="rounded border border-line bg-surface px-2 py-1">
            {periods.map((p) => <option key={p.start} value={p.start}>{p.start} s.d. {p.end}</option>)}
          </select>
        </label>
        <button type="submit" className={buttonClass({ variant: 'secondary', size: 'sm' })}>Tampilkan</button>
      </form>
      <Alert>Orang yang lupa absen lebih dari {min} kali dalam periode ini (yang penjelasannya disetujui). Lupa masuk, lupa pulang, dan lupa Masuk Kembali dihitung terpisah.</Alert>
      {!rows.length ? <EmptyState title="Tidak ada" /> : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-left text-ink-muted">
              <tr>
                <th className="px-3 py-2">Nama</th><th className="px-3 py-2">Cabang</th><th className="px-3 py-2 text-right">Lupa masuk</th>
                <th className="px-3 py-2 text-right">Lupa pulang</th><th className="px-3 py-2 text-right">Lupa Masuk Kembali</th>
                <th className="px-3 py-2 text-right">Penjelasan ditolak</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.employeeId} className="border-t border-line align-top">
                  <td className="px-3 py-2">
                    <details>
                      <summary className="cursor-pointer font-medium">{row.name}</summary>
                      <ul className="mt-1 list-disc pl-4 text-xs text-ink-muted">{row.days.map((day) => <li key={day}>{day}</li>)}</ul>
                    </details>
                  </td>
                  <td className="px-3 py-2">{row.branch}</td>
                  {[row.in, row.out, row.return].map((n, index) => (
                    <td key={index} className={`px-3 py-2 text-right ${n > min ? 'font-semibold text-danger-fg' : ''}`}>{n}</td>
                  ))}
                  <td className="px-3 py-2 text-right">{row.rejected}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
