import { CaraMembaca, type Explanation } from '@/components/explain';
import { backofficeUrl } from '@/lib/access';
import { getSql } from '@/lib/db';
import { bulan, rupiah } from '@/lib/format';
import { gate } from '@/lib/gate';
import { todayWib } from '@/modules/money';
import {
  addMonths, buildProfitLoss, cell, FIRST_MONTH, isMonth, loadBranches, loadCosts, loadFlags, loadInternalSales, loadSales,
  monthRange, OFFICE_KEY, TOTAL_KEY, type Column, type Line, type ProfitLoss,
} from '@/modules/profit-loss';

export const dynamic = 'force-dynamic';

/** Catatan baku Laba Rugi (spec F2-6b §2.1). */
const PL_NOTES = [
  'Gaji, bongkaran, bensin dan sewa mobil berasal dari HRIS/Logistik yang baru ada di staging; di produksi belum berisi data nyata.',
  'Biaya dihitung untuk bulannya, bukan tanggal bayar (sewa Oktober dibayar 1 November masuk Oktober).',
  'Belum ada tutup bulan: angka bulan lalu bisa berubah bila ada pembatalan atau koreksi. Beli aset tidak masuk biaya (penyusutan belum ada).',
];

const ORIGIN: Record<string, string> = {
  sales: 'nota kasir Selesai bulan ini (Back Office › Laporan Laba Rugi), dikurangi retur penjualan bulan ini dan koreksi omzet Revisi Harga Beli kiriman internal.',
  cogs: 'modal (HPP) tiap baris nota yang terjual bulan ini, dikurangi modal barang yang diretur — sama dengan Laporan Laba Rugi Back Office.',
  damaged: 'laporan Barang Rusak/Expired/Hilang yang disetujui bulan ini (Back Office).',
  adjustment: 'Revisi Harga Beli kiriman internal: modal barang yang sudah terpakai sebelum harganya dibetulkan (Back Office › Retur Internal).',
  CATEGORY: 'Arus Kas (Back Office) dengan Untuk bulan ini dan kategori jenis Biaya, termasuk pembayaran Biaya Rutin, ditambah Pengeluaran Kasir dari laci yang kategorinya dipasangkan ke kategori ini.',
  INCOME: 'Arus Kas (Back Office) jenis Pendapatan lain dengan Untuk bulan ini.',
  PAYROLL: 'slip gaji yang sudah ditutup di HRIS: pendapatan slip (gaji kotor, termasuk ritase & bonus) — slip bulanan periode 26 bulan lalu s.d. 25, slip mingguan yang hari terakhirnya di bulan ini.',
  UNLOADING: 'laporan bongkaran aktif/dibayar di HRIS dengan tanggal kerja bulan ini, sebesar upahnya.',
  FUEL: 'pengisian bensin yang berlaku di Logistik, dibebankan ke cabang garasi saat dicatat.',
  VEHICLE_RENTAL: 'pembayaran sewa mobil (termasuk susulan) untuk bulan ini di Logistik › Sewa Mobil, dibebankan ke cabang garasi.',
};

function explain(pl: ProfitLoss, l: Line, c: Column, monthLabel: string, month: string): Explanation {
  const v = cell(l, c.key);
  const at = (key: string) => cell(pl.lines.find((x) => x.key === key)!, c.key);
  const scope = c.key === TOTAL_KEY ? 'semua cabang dan Kantor' : c.key === OFFICE_KEY ? 'Kantor (biaya Bersama / tanpa cabang)' : c.name;
  const detail = { href: `/laba-rugi/rincian?bulan=${month}&kolom=${c.key}&baris=${encodeURIComponent(l.key)}`, label: 'Lihat rincian' };
  const notes = [...PL_NOTES];
  if (c.key === TOTAL_KEY) notes.unshift(`Gabungan = jumlah semua cabang − Kantor. Penjualan ke cabang sendiri ${rupiah(pl.internalSales)} dikeluarkan dari Penjualan dan Harga pokok dengan jumlah sama, jadi laba kotor tidak berubah; laba dari barang yang dikirim Gudang tetapi belum terjual toko sudah terhitung di Gudang.`);
  const bo = backofficeUrl(`/reports/profit-loss?startDate=${monthRange(month).from}&endDate=${monthRange(month).to}`);

  switch (l.key) {
    case 'gross':
      return { meaning: `selisih penjualan bersih dan harga pokok ${scope}, ${monthLabel}.`, origin: 'Penjualan bersih − Harga pokok.', calc: `${rupiah(at('sales'))} − ${rupiah(at('cogs'))} = ${rupiah(v)}`, notes, detail: bo ? { href: bo, label: 'Laporan Laba Rugi Back Office' } : null };
    case 'cost-total':
      return { meaning: `semua biaya yang ditanggung ${scope}, ${monthLabel}.`, origin: 'jumlah baris biaya di atas.', calc: pl.lines.filter((x) => x.kind === 'COST').map((x) => rupiah(cell(x, c.key))).join(' + ') + ` = ${rupiah(v)}`, notes };
    case 'net': {
      const incomes = pl.lines.filter((x) => x.kind === 'INCOME').reduce((s, x) => s + cell(x, c.key), 0);
      return {
        meaning: `laba bersih ${scope}, ${monthLabel}: yang tersisa sesudah harga pokok, barang rusak, dan semua biaya. Minus = rugi.`,
        origin: 'Laba kotor − Barang rusak ± Penyesuaian Modal − Jumlah biaya + Pendapatan lain.',
        calc: `${rupiah(at('gross'))} − ${rupiah(at('damaged'))} + ${rupiah(at('adjustment'))} − ${rupiah(at('cost-total'))} + ${rupiah(incomes)} = ${rupiah(v)}`,
        notes,
        detail: { href: `/laba-rugi/rincian?bulan=${month}&kolom=${c.key}&baris=all`, label: 'Lihat semua biaya & pendapatan' },
      };
    }
    case 'sales':
    case 'cogs':
    case 'damaged':
    case 'adjustment':
      return {
        meaning: `${l.label.toLowerCase()} ${scope}, ${monthLabel}.`,
        origin: ORIGIN[l.key],
        calc: c.key === TOTAL_KEY && (l.key === 'sales' || l.key === 'cogs')
          ? `jumlah semua cabang − penjualan ke cabang sendiri ${rupiah(pl.internalSales)} = ${rupiah(v)}`
          : `${rupiah(v)} (angka yang sama dengan Laporan Laba Rugi Back Office untuk bulan dan cabang ini).`,
        notes,
        detail: bo ? { href: bo, label: 'Laporan Laba Rugi Back Office' } : null,
      };
    default:
      return {
        meaning: `${l.kind === 'INCOME' ? 'pendapatan lain' : 'biaya'} "${l.label}" yang ditanggung ${scope}, ${monthLabel}.`,
        origin: l.kind === 'INCOME' ? ORIGIN.INCOME : ORIGIN[l.group ?? 'CATEGORY'],
        calc: `jumlah catatannya = ${rupiah(v)}${c.key === TOTAL_KEY ? ' (semua cabang + Kantor)' : ''}.`,
        notes,
        detail,
      };
  }
}

export default async function LabaRugiPage({ searchParams }: { searchParams: Promise<{ bulan?: string; kolom?: string }> }) {
  const g = await gate();
  if (g.denied) return g.denied;

  const q = await searchParams;
  const thisMonth = todayWib().slice(0, 7);
  let month = q.bulan && isMonth(q.bulan) ? q.bulan : thisMonth;
  if (month < FIRST_MONTH) month = FIRST_MONTH;
  if (month > thisMonth) month = thisMonth;

  const sql = getSql();
  const [branches, sales, costs] = await Promise.all([loadBranches(sql), loadSales(sql, month), loadCosts(sql, month)]);
  const [internalSales, flags] = await Promise.all([loadInternalSales(sql, month, sales), loadFlags(sql, month, costs)]);
  const pl = buildProfitLoss({ branches, sales, costs, internalSales });
  const monthLabel = bulan(`${month}-01`);
  const months: string[] = [];
  for (let m = thisMonth; m >= FIRST_MONTH; m = addMonths(m, -1)) months.push(m);
  const onlyKey = q.kolom && pl.columns.some((c) => c.key === q.kolom) ? q.kolom : '';
  const shown = onlyKey ? pl.columns.filter((c) => c.key === onlyKey) : pl.columns;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Laba Rugi</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            Laba bersih {monthLabel} per cabang yang menanggung. <strong>Kantor</strong> = biaya Bersama / tanpa cabang;{' '}
            <strong>Gabungan</strong> = jumlah cabang − Kantor. Ini bukan uang di tangan — untuk itu lihat Saldo dan Arus Uang.
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-2 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Bulan</span>
            <select name="bulan" defaultValue={month} className="rounded-md border border-border bg-background px-2 py-1.5">
              {months.map((m) => <option key={m} value={m}>{bulan(`${m}-01`)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Kolom</span>
            <select name="kolom" defaultValue={onlyKey} className="rounded-md border border-border bg-background px-2 py-1.5">
              <option value="">Semua</option>
              {pl.columns.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
            </select>
          </label>
          <button className="rounded-md bg-primary px-3 py-1.5 font-medium text-white">Tampilkan</button>
        </form>
      </div>

      {flags.length > 0 && (
        <ul className="mb-5 space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {flags.map((f) => (
            <li key={f.key}>
              ⚠️ {f.label}: {f.count} {f.key === 'open-slips' ? 'orang' : f.key === 'rental-unpaid' ? 'mobil' : 'catatan'}
              {f.amount != null && <> · <span className="tabular-nums">{rupiah(f.amount)}</span></>}
              {f.key !== 'open-slips' && f.key !== 'rental-unpaid' && (
                <a className="ml-2 font-medium text-primary hover:underline" href={`/laba-rugi/rincian?bulan=${month}&tanda=${f.key}`}>lihat</a>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="sticky left-0 bg-card px-3 py-2 font-semibold">{monthLabel}</th>
              {shown.map((c) => (
                <th key={c.key} className={`px-3 py-2 text-right font-semibold ${c.key === TOTAL_KEY ? 'bg-muted' : ''}`}>{c.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pl.lines.map((l) => (
              <tr key={l.key} className={`border-b border-border align-top ${l.total ? 'font-semibold' : ''}`}>
                <td className={`sticky left-0 bg-card px-3 py-2 ${l.group && !l.total ? 'pl-6' : ''}`}>
                  {l.sign && <span className="mr-1 text-muted-foreground">{l.sign}</span>}
                  {l.label}
                  {l.kind === 'INCOME' && <span className="ml-1 text-xs text-muted-foreground">(pendapatan lain)</span>}
                </td>
                {shown.map((c) => {
                  const v = cell(l, c.key);
                  return (
                    <td key={c.key} className={`px-3 py-2 text-right ${c.key === TOTAL_KEY ? 'bg-muted' : ''}`}>
                      <div className={`tabular-nums ${v < 0 && (l.key === 'net' || l.key === 'gross') ? 'text-red-600' : ''}`}>{rupiah(v)}</div>
                      <CaraMembaca title={`${l.label} — ${c.name}, ${monthLabel}`} e={explain(pl, l, c, monthLabel, month)} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
