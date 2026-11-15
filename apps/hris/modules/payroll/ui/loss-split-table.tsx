import { rupiah } from '../rules/salary';

export type SplitView = {
  shares: { employeeId?: number; name: string; weight: number; days: number; amount: number }[];
  office: { total: number; percentPart: number; dayRemainder: number; rounding: number };
  officePercent?: number;
  periodDays?: number;
};

/** Kartu pembagian kehilangan barang (GAJ-77): tiap orang, lalu bagian kantor dalam tiga angka. Jumlah = nilai. */
export function LossSplitTable({ split, amount }: { split: SplitView; amount: number }) {
  return (
    <div className="space-y-2 text-sm">
      {split.officePercent != null && <p className="text-ink-muted">Persen kantor {split.officePercent}% · periode {split.periodDays} hari</p>}
      <table className="w-full">
        <thead><tr className="text-left text-ink-muted"><th>Orang</th><th className="text-right">Bobot</th><th className="text-right">Hari</th><th className="text-right">Bagian</th></tr></thead>
        <tbody>
          {split.shares.map((s) => (
            <tr key={`${s.employeeId ?? s.name}`}>
              <td>{s.name}</td><td className="text-right tabular-nums">{s.weight}</td><td className="text-right tabular-nums">{s.days}</td>
              <td className="text-right tabular-nums">{rupiah(s.amount)}</td>
            </tr>
          ))}
          {!split.shares.length && <tr><td colSpan={4} className="text-ink-muted">Tidak ada yang ikut menanggung; seluruhnya ditanggung kantor.</td></tr>}
          <tr className="border-t border-line">
            <td colSpan={3}>Kantor: persen kantor {rupiah(split.office.percentPart)} + sisa sebanding hari {rupiah(split.office.dayRemainder)} + pembulatan {rupiah(split.office.rounding)}</td>
            <td className="text-right tabular-nums">{rupiah(split.office.total)}</td>
          </tr>
          <tr className="font-medium"><td colSpan={3}>Jumlah</td><td className="text-right tabular-nums">{rupiah(amount)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}
