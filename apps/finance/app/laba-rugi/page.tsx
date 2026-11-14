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
import {
  correctionEffect, liveProfitLoss, loadClosings, loadCorrections, netChange, profitLossChanges, restatement, type Change,
} from '@/modules/month-close';

export const dynamic = 'force-dynamic';

/** Catatan baku Laba Rugi (spec F2-6b §2.1). */
const PL_NOTES = [
  'Gaji, bongkaran, bensin dan sewa mobil berasal dari HRIS/Logistik yang baru ada di staging; di produksi belum berisi data nyata.',
  'Biaya dihitung untuk bulannya, bukan tanggal bayar (sewa Oktober dibayar 1 November masuk Oktober).',
  'Bulan yang sudah ditutup (Finance › Tutup Bulan) menampilkan salinan angka saat ditutup. Kesalahan bulan itu (lupa/salah catat) dicatat di Back Office sebagai Koreksi bulan lalu dan menyajikan kembali bulan asalnya — laba bulan berjalan tidak ikut berubah (PSAK 25). Retur dan kejadian baru masuk bulan terjadinya. Bulan yang belum ditutup bisa berubah bila ada pembatalan atau catatan susulan. Beli aset tidak masuk biaya; harganya dibagi rata per bulan selama umur pakai (Penyusutan aset).',
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
  DEPRECIATION: 'aset di Back Office › Keuangan › Aset: harga ÷ umur pakai (bulan), mulai bulan beli, sampai umur habis atau bulan sebelum aset rusak/hilang/dijual. Bukan uang keluar bulan ini.',
  ASSET_LOSS: 'aset yang rusak, hilang, atau dijual bulan ini sebelum umurnya habis: sisa nilainya dikurangi uang hasil jual (Back Office › Keuangan › Aset).',
  ASSET_GAIN: 'aset yang dijual bulan ini dengan uang hasil jual lebih besar dari sisa nilainya (Back Office › Keuangan › Aset).',
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
        origin: l.group === 'ASSET_LOSS' && l.kind === 'INCOME' ? ORIGIN.ASSET_GAIN : l.kind === 'INCOME' ? ORIGIN.INCOME : ORIGIN[l.group ?? 'CATEGORY'],
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
  const closings = await loadClosings(sql);
  const closing = closings.find((c) => c.month === month) ?? null;
  const [branches, sales, costs] = await Promise.all([loadBranches(sql), loadSales(sql, month), loadCosts(sql, month)]);
  const [internalSales, liveFlags] = await Promise.all([loadInternalSales(sql, month, sales), loadFlags(sql, month, costs)]);
  const live = buildProfitLoss({ branches, sales, costs, internalSales });
  // Bulan tertutup: tabel = salinan saat ditutup (spec F2-6f §0 butir 6); angka hidup hanya untuk kotak perubahan.
  const pl = closing ? closing.snapshot.profitLoss : live;
  const flags = closing ? closing.snapshot.flags : liveFlags;
  const changes: Change[] = closing ? profitLossChanges(closing.snapshot.profitLoss, live) : [];
  const corrections = closing ? await loadCorrections(sql, month) : [];
  const restated = closing ? restatement(closing.snapshot.profitLoss, live, corrections) : null;
  // Bulan berjalan: peringatan bila bulan tertutup berubah sesudah ditutup.
  const changedClosed = month === thisMonth
    ? (await Promise.all(closings.map(async (c) => ({ month: c.month, delta: netChange(profitLossChanges(c.snapshot.profitLoss, (await liveProfitLoss(sql, c.month)).profitLoss)) }))))
      .filter((x) => x.delta !== 0)
    : [];
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

      {closing && (
        <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          🔒 {monthLabel} sudah ditutup{closing.withNotes ? ' dengan catatan' : ''} oleh {closing.closedByName}. Angka di tabel adalah salinan saat ditutup.{' '}
          <a className="font-medium text-primary hover:underline" href={`/tutup-bulan?bulan=${month}`}>Rincian tutup bulan</a>
        </div>
      )}
      {closing && restated && (restated.corrections !== 0 || restated.other !== 0 || corrections.length > 0) && (
        <div className="mb-4 rounded-lg border border-blue-300 bg-card text-sm">
          <div className="border-b border-blue-300 bg-blue-50 px-3 py-2 text-blue-900">
            <strong>Disajikan kembali</strong> — laba bersih Gabungan {monthLabel} sesudah koreksi. Tabel di bawah tetap angka saat ditutup.
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 px-3 py-2 sm:grid-cols-4">
            {([
              ['Saat ditutup', restated.closed],
              ['Koreksi bulan lalu', restated.corrections],
              ['Perubahan lain', restated.other],
              ['Disajikan kembali', restated.restated],
            ] as const).map(([label, v], i) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className={`tabular-nums ${i === 3 ? 'font-semibold' : ''} ${(i === 1 || i === 2) && v !== 0 ? (v < 0 ? 'text-red-600' : 'text-blue-700') : ''}`}>
                  {(i === 1 || i === 2) && v > 0 ? '+' : ''}{v < 0 ? '−' : ''}{rupiah(Math.abs(v))}
                </dd>
              </div>
            ))}
          </dl>
          {corrections.length > 0 && (
            <div className="overflow-x-auto border-t border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-3 py-2 font-semibold">Dicatat</th>
                    <th className="px-3 py-2 font-semibold">Cabang</th>
                    <th className="px-3 py-2 font-semibold">Kategori</th>
                    <th className="px-3 py-2 font-semibold">Alasan</th>
                    <th className="px-3 py-2 font-semibold">Oleh</th>
                    <th className="px-3 py-2 text-right font-semibold">Pengaruh ke laba</th>
                  </tr>
                </thead>
                <tbody>
                  {corrections.map((c) => {
                    const effect = correctionEffect(c);
                    return (
                      <tr key={c.id} className="border-b border-border">
                        <td className="px-3 py-2 whitespace-nowrap">{c.occurredOn}</td>
                        <td className="px-3 py-2">{c.branchName}</td>
                        <td className="px-3 py-2">{c.category}</td>
                        <td className="px-3 py-2">{c.reason}</td>
                        <td className="px-3 py-2">{c.createdByName}</td>
                        <td className={`px-3 py-2 text-right tabular-nums ${effect < 0 ? 'text-red-600' : effect > 0 ? 'text-blue-700' : 'text-muted-foreground'}`}>
                          {effect === 0 ? 'tidak masuk laba' : `${effect > 0 ? '+' : '−'}${rupiah(Math.abs(effect))}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="px-3 py-2 text-xs text-muted-foreground">
            Koreksi bulan lalu dicatat di Back Office › Pendapatan &amp; Pengeluaran; uangnya tercatat di bulan dicatat, biayanya di bulan asal.
            Perubahan lain = perubahan sesudah ditutup yang bukan koreksi (mis. nota bulan ini dibatalkan, slip gaji ditutup terlambat).
          </p>
        </div>
      )}
      {changedClosed.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          ⚠️ Bulan yang sudah ditutup berubah sesudah ditutup (laba bersih Gabungan):{' '}
          {changedClosed.map((x, i) => (
            <span key={x.month}>
              {i > 0 && ', '}
              <a className="font-medium text-primary hover:underline" href={`/laba-rugi?bulan=${x.month}`}>{bulan(`${x.month}-01`)}</a>{' '}
              <span className="tabular-nums">{x.delta > 0 ? '+' : '−'}{rupiah(Math.abs(x.delta))}</span>
            </span>
          ))}. Bulan itu disajikan kembali; laba bulan berjalan tidak ikut berubah.
        </div>
      )}

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
                      {l.key === 'net' && c.key !== OFFICE_KEY && (
                        <a className="mt-1 block text-xs font-normal text-primary hover:underline" href={`/setoran-vs-laba?bulan=${month}${c.key === TOTAL_KEY ? '' : `&kolom=${c.key}`}`}>Kenapa setoran beda? →</a>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {closing && changes.length > 0 && (
        <div className="mt-5 overflow-x-auto rounded-lg border border-amber-300 bg-card">
          <div className="border-b border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <strong>Perubahan sesudah ditutup</strong> — rincian per baris: angka disajikan kembali dibanding salinan saat ditutup
            (koreksi bulan lalu, nota dibatalkan, slip gaji ditutup terlambat). Tabel di atas tidak ikut berubah.
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-3 py-2 font-semibold">Baris</th>
                <th className="px-3 py-2 font-semibold">Kolom</th>
                <th className="px-3 py-2 text-right font-semibold">Saat ditutup</th>
                <th className="px-3 py-2 text-right font-semibold">Sekarang</th>
                <th className="px-3 py-2 text-right font-semibold">Perubahan</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c) => (
                <tr key={`${c.lineKey}-${c.columnKey}`} className="border-b border-border">
                  <td className="px-3 py-2">{c.label}</td>
                  <td className="px-3 py-2">{c.columnName}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{rupiah(c.closed)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{rupiah(c.live)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${c.delta < 0 ? 'text-red-600' : 'text-blue-700'}`}>{c.delta > 0 ? '+' : '−'}{rupiah(Math.abs(c.delta))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
