import Link from 'next/link';
import { CaraMembaca, COMMON_NOTES } from '@/components/explain';
import { backofficeUrl } from '@/lib/access';
import { getSql } from '@/lib/db';
import { bulan, rupiah, tanggal } from '@/lib/format';
import { gate } from '@/lib/gate';
import { countCheck, lastDayOfMonth, loadCashCounts, loadLines, loadPlaces, START_DATE, todayWib } from '@/modules/money';

export const dynamic = 'force-dynamic';

/** Hitung Kas (spec F2-6e §2): uang nyata dari Back Office dibanding saldo menurut catatan akhir hari hitung. */
export default async function HitungKasPage({ searchParams }: { searchParams: Promise<{ bulan?: string; tempat?: string }> }) {
  const g = await gate();
  if (g.denied) return g.denied;

  const today = todayWib();
  const q = await searchParams;
  let month = /^\d{4}-(0[1-9]|1[0-2])$/.test(q.bulan ?? '') ? (q.bulan as string) : today.slice(0, 7);
  if (month < START_DATE.slice(0, 7)) month = START_DATE.slice(0, 7);
  if (month > today.slice(0, 7)) month = today.slice(0, 7);
  const placeFilter = Number(q.tempat) || null;
  const monthEnd = lastDayOfMonth(`${month}-01`);
  const to = monthEnd < today ? monthEnd : today;

  const sql = getSql();
  const [places, lines, counts] = await Promise.all([loadPlaces(sql), loadLines(sql, to), loadCashCounts(sql, to)]);
  const byId = new Map(places.map((p) => [p.id, p]));
  const rows = counts
    .filter((c) => c.countedOn.startsWith(month) && (!placeFilter || c.placeId === placeFilter) && byId.has(c.placeId))
    .map((c) => countCheck(byId.get(c.placeId)!, lines, c));
  const shortTotal = rows.filter((r) => r.variance < 0).reduce((a, r) => a - r.variance, 0);
  const overTotal = rows.filter((r) => r.variance > 0).reduce((a, r) => a + r.variance, 0);
  const boCounts = backofficeUrl('/cash-counts');

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Hitung Kas — {bulan(month)}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Uang nyata yang dicatat di Back Office › Keuangan › Hitung Kas, dibanding saldo menurut catatan pada akhir hari hitung.
            {boCounts && <> <a href={boCounts} className="font-medium text-primary hover:underline">Catat hitungan di Back Office →</a></>}
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-2 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Bulan</span>
            <input type="month" name="bulan" defaultValue={month} min={START_DATE.slice(0, 7)} max={today.slice(0, 7)} className="rounded-md border border-border bg-background px-2 py-1.5" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Tempat Uang</span>
            <select name="tempat" defaultValue={placeFilter ?? ''} className="rounded-md border border-border bg-background px-2 py-1.5">
              <option value="">Semua</option>
              {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <button className="rounded-md bg-primary px-3 py-1.5 font-medium text-white">Tampilkan</button>
        </form>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Hitungan bulan ini</div>
          <div className="text-2xl font-semibold tabular-nums">{rows.length}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Jumlah kurang</div>
          <div className={`text-2xl font-semibold tabular-nums ${shortTotal > 0 ? 'text-red-600' : ''}`}>{rupiah(shortTotal)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Jumlah lebih</div>
          <div className={`text-2xl font-semibold tabular-nums ${overTotal > 0 ? 'text-blue-700' : ''}`}>{rupiah(overTotal)}</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-2 text-left font-medium">Tanggal</th>
              <th className="px-4 py-2 text-left font-medium">Tempat Uang</th>
              <th className="px-4 py-2 text-right font-medium">Saldo menurut catatan</th>
              <th className="px-4 py-2 text-right font-medium">Uang nyata</th>
              <th className="px-4 py-2 text-right font-medium">Selisih</th>
              <th className="px-4 py-2 text-left font-medium">Penyesuaian</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ count, systemBalance, variance }) => {
              const place = byId.get(count.placeId)!;
              const adjustHref = variance !== 0 && !count.adjustment
                ? backofficeUrl(`/cash-counts?adjust=${count.id}&direction=${variance < 0 ? 'SHORT' : 'OVER'}&amount=${Math.abs(variance)}&month=${month}`)
                : null;
              return (
                <tr key={count.id} className="border-b border-border align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-2">
                    {tanggal(count.countedOn)}
                    <div className="text-xs text-muted-foreground">#{count.id} · {count.createdByName ?? '-'}</div>
                  </td>
                  <td className="px-4 py-2">
                    <Link href={`/mutasi/${place.id}?dari=${month}-01&sampai=${to}`} className="font-medium hover:text-primary hover:underline">{place.name}</Link>
                    <div className="text-xs text-muted-foreground">{place.kind === 'BANK' ? 'Rekening' : 'Tunai'} · {place.branchName}</div>
                    {count.note && <div className="text-xs text-muted-foreground">{count.note}</div>}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{rupiah(systemBalance)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{rupiah(count.amount)}</td>
                  <td className="px-4 py-2 text-right">
                    <div className={`font-semibold tabular-nums ${variance < 0 ? 'text-red-600' : variance > 0 ? 'text-blue-700' : ''}`}>
                      {variance === 0 ? 'cocok' : `${variance < 0 ? 'kurang' : 'lebih'} ${rupiah(Math.abs(variance))}`}
                    </div>
                    <div className="flex justify-end">
                      <CaraMembaca
                        title={`Selisih ${place.name} ${tanggal(count.countedOn)}`}
                        e={{
                          meaning: 'beda antara uang yang benar-benar dihitung dan uang yang semestinya ada menurut catatan, pada akhir hari hitung.',
                          origin: 'uang nyata dari Back Office › Hitung Kas; saldo menurut catatan dengan rumus yang sama seperti halaman Saldo (termasuk penyesuaian yang sudah dicatat).',
                          calc: `${rupiah(count.amount)} − ${rupiah(systemBalance)} = ${rupiah(variance)}`,
                          notes: [
                            'Selisih ikut berubah bila ada catatan uang yang diketik belakangan dengan tanggal uang sampai hari hitung — telusuri dulu catatan yang terlupa.',
                            'Bila sebabnya tidak ketemu, Owner/GM mencatat penyesuaian di Back Office; sesudahnya selisih menjadi cocok.',
                            ...COMMON_NOTES,
                          ],
                          detail: { href: `/mutasi/${place.id}?dari=${month}-01&sampai=${to}`, label: 'Lihat mutasi' },
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {count.adjustment && (
                      <span className={count.adjustment.direction === 'SHORT' ? 'text-red-600' : 'text-blue-700'}>
                        {count.adjustment.direction === 'SHORT' ? 'Selisih kas kurang' : 'Selisih kas lebih'} {rupiah(count.adjustment.amount)}
                      </span>
                    )}
                    {adjustHref && <a href={adjustHref} className="font-medium text-primary hover:underline">Catat penyesuaian di Back Office →</a>}
                    {!count.adjustment && variance === 0 && <span className="text-muted-foreground">-</span>}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-4 text-center text-muted-foreground">Belum ada hitungan di bulan ini.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
