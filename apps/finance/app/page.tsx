import Link from 'next/link';
import { CaraMembaca, COMMON_NOTES } from '@/components/explain';
import { backofficeUrl, hrisUrl } from '@/lib/access';
import { getSql } from '@/lib/db';
import { bulan, rupiah, tanggal } from '@/lib/format';
import { gate } from '@/lib/gate';
import {
  balanceBoard, countCheck, countFreshness, COUNT_STALE_DAYS, isDate, latestCount, loadCashCounts, loadLines, loadPlaces, loadUnplaced,
  START_DATE, todayWib, type CashCount, type MoneyLine, type PlaceBalance,
} from '@/modules/money';
import { loadPendingFunds, pendingByPlace } from '@/modules/pending-funds';
import { loadClosings, overdueMonths } from '@/modules/month-close';


export const dynamic = 'force-dynamic';

const HELD_BY: Record<string, string> = { FINANCE: 'Finance', STORE: 'Toko', OTHER: 'Lainnya' };

function calc(r: PlaceBalance) {
  const parts = [`saldo awal ${rupiah(r.opening)}`, `+ masuk ${rupiah(r.inTotal)}`, `− keluar ${rupiah(r.outTotal)}`];
  if (r.transferNet !== 0) parts.push(`${r.transferNet > 0 ? '+' : '−'} pindahan ${rupiah(Math.abs(r.transferNet))}`);
  return `${parts.join(' ')} = ${rupiah(r.balance)}`;
}

/** Kolom Hitung terakhir (spec F2-6e §2): uang nyata, selisih pada hari hitung, tanda 7 hari. */
function LastCount({ r, counts, lines, to }: { r: PlaceBalance; counts: CashCount[]; lines: MoneyLine[]; to: string }) {
  const last = latestCount(counts, r.place.id, to);
  const fresh = countFreshness(last?.countedOn ?? null, to);
  const badge = fresh === 'FRESH' ? null : (
    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
      {fresh === 'NEVER' ? 'belum pernah dihitung' : `belum dihitung ${COUNT_STALE_DAYS} hari`}
    </span>
  );
  if (!last) return badge;
  const check = countCheck(r.place, lines, last);
  return (
    <div className="text-xs">
      <Link href={`/hitung-kas?bulan=${last.countedOn.slice(0, 7)}&tempat=${r.place.id}`} className="hover:text-primary hover:underline">
        {tanggal(last.countedOn)}: {rupiah(last.amount)}
      </Link>
      <div className={check.variance < 0 ? 'text-red-600' : check.variance > 0 ? 'text-blue-700' : 'text-muted-foreground'}>
        {check.variance === 0 ? 'cocok' : `${check.variance < 0 ? 'kurang' : 'lebih'} ${rupiah(Math.abs(check.variance))}`}
      </div>
      {badge}
    </div>
  );
}

export default async function SaldoPage({ searchParams }: { searchParams: Promise<{ tanggal?: string }> }) {
  const g = await gate();
  if (g.denied) return g.denied;

  const today = todayWib();
  const params = await searchParams;
  let to = isDate(params.tanggal) ? params.tanggal : today;
  if (to < START_DATE) to = START_DATE;
  if (to > today) to = today;

  const sql = getSql();
  const [places, lines, unplaced, pendingRows, counts] = await Promise.all([
    loadPlaces(sql), loadLines(sql, to), loadUnplaced(sql, to), loadPendingFunds(sql, today), loadCashCounts(sql, to),
  ]);
  const overdue = overdueMonths((await loadClosings(sql)).map((c) => c.month), today);
  // Dana belum cair selalu per hari ini (bukan per tanggal pilihan): keterangan saja, saldo tidak berubah (spec F2-6c §0.7).
  const pending = new Map(pendingByPlace(pendingRows, today).groups.filter((x) => x.placeId != null).map((x) => [x.placeId as number, x]));
  const board = balanceBoard(places, lines, to);
  const missingOpening = places.filter((p) => p.isActive && p.opening == null).length;
  const unplacedTotal = unplaced.reduce((a, u) => a + u.amount, 0);
  const unplacedLinks: Record<string, string | null> = {
    CASHFLOW: backofficeUrl('/cash-flow'),
    SUPPLIER: backofficeUrl('/purchase-orders/supplier-payables'),
    FUEL: hrisUrl('/logistik/bensin-mobil'),
  };

  return (
    <div>
      {overdue.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          ⚠️ Belum ditutup padahal sudah lewat tanggal 10: {overdue.map((m) => bulan(m)).join(', ')}.{' '}
          <Link href="/tutup-bulan" className="font-medium text-primary hover:underline">Tutup Bulan →</Link>
        </div>
      )}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Saldo Tempat Uang</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Uang di setiap kas tunai dan rekening per <strong>{tanggal(to)}</strong> (akhir hari), dihitung sejak saldo awal
            1 November 2026. Laci kasir tidak di sini — uang laci dihitung per shift.
          </p>
        </div>
        <form className="flex items-end gap-2 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Per tanggal</span>
            <input type="date" name="tanggal" defaultValue={to} min={START_DATE} max={today} className="rounded-md border border-border bg-background px-2 py-1.5" />
          </label>
          <button className="rounded-md bg-primary px-3 py-1.5 font-medium text-white">Tampilkan</button>
        </form>
      </div>

      {missingOpening > 0 && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {missingOpening} Tempat Uang belum diisi saldo awalnya — saldonya dihitung dari 0. Isi di Back Office › Pengaturan ›
          Tempat Uang (Owner/GM).
        </div>
      )}

      <div className="mb-6 rounded-lg border border-border bg-card p-4">
        <div className="text-xs text-muted-foreground">Total semua Tunai & Rekening</div>
        <div className={`text-2xl font-semibold tabular-nums ${board.total < 0 ? 'text-red-600' : ''}`}>{rupiah(board.total)}</div>
        <CaraMembaca
          title={`Total semua per ${tanggal(to)}`}
          e={{
            meaning: 'jumlah uang di semua kas tunai dan rekening (bukan laci kasir) pada akhir hari itu.',
            origin: 'jumlah saldo tiap cabang di bawah. Pindah dana antar tempat tidak mengubah total ini.',
            calc: `${board.groups.map((gr) => `${gr.branchName} ${rupiah(gr.total)}`).join(' + ') || '0'} = ${rupiah(board.total)}`,
            notes: COMMON_NOTES,
          }}
        />
      </div>

      <div className="space-y-6">
        {board.groups.map((group) => (
          <section key={group.branchId} className="overflow-x-auto rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-2">
              <h2 className="text-sm font-semibold">{group.branchName}</h2>
              <div className="text-sm">
                Jumlah: <span className="font-semibold tabular-nums">{rupiah(group.total)}</span>
              </div>
            </div>
            <table className="w-full min-w-[780px] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-left font-medium">Tempat Uang</th>
                  <th className="px-4 py-2 text-left font-medium">Dipegang</th>
                  <th className="px-4 py-2 text-right font-medium">Masuk</th>
                  <th className="px-4 py-2 text-right font-medium">Keluar</th>
                  <th className="px-4 py-2 text-left font-medium">Hitung terakhir</th>
                  <th className="px-4 py-2 text-right font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((r) => (
                  <tr key={r.place.id} className="border-b border-border align-top last:border-0">
                    <td className="px-4 py-2">
                      <Link href={`/mutasi/${r.place.id}?sampai=${to}`} className="font-medium hover:text-primary hover:underline">
                        {r.place.name}
                      </Link>
                      <span className="ml-2 text-xs text-muted-foreground">{r.place.kind === 'BANK' ? 'Rekening' : 'Tunai'}</span>
                      {!r.place.isActive && <span className="ml-2 text-xs text-muted-foreground">(nonaktif)</span>}
                      {r.place.opening == null && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">saldo awal belum diisi</span>
                      )}
                      {pending.get(r.place.id) && (
                        <Link
                          href={`/dana-belum-cair#tempat-${r.place.id}`}
                          className={`block text-xs hover:underline ${pending.get(r.place.id)!.overdue ? 'text-red-600' : 'text-muted-foreground'}`}
                        >
                          + {rupiah(pending.get(r.place.id)!.total)} dana belum cair/belum diverifikasi (hari ini) →
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{HELD_BY[r.place.heldBy] ?? r.place.heldBy}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{rupiah(r.inTotal)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{rupiah(r.outTotal)}</td>
                    <td className="px-4 py-2"><LastCount r={r} counts={counts} lines={lines} to={to} /></td>
                    <td className="px-4 py-2 text-right">
                      <div className={`font-semibold tabular-nums ${r.balance < 0 ? 'text-red-600' : ''}`}>{rupiah(r.balance)}</div>
                      <div className="flex justify-end">
                        <CaraMembaca
                          title={`Saldo ${r.place.name}`}
                          e={{
                            meaning: `uang yang semestinya ada di ${r.place.name} pada akhir ${tanggal(to)}.`,
                            origin:
                              'saldo awal (Back Office › Tempat Uang) ditambah setoran & non-tunai terverifikasi, Arus Kas masuk, uang kembali HRIS; dikurangi bayar supplier, Arus Kas keluar (termasuk Biaya Rutin), gaji, kasbon, bongkaran, sewa mobil; ditambah/dikurangi Pindah Dana. Masuk/Keluar di kolom ini sejak 1 Nov.',
                            calc: calc(r),
                            notes: [
                              ...(r.place.opening == null ? ['Saldo awal belum diisi, jadi dihitung dari 0.'] : []),
                              ...(r.balance < 0 ? ['Saldo minus biasanya berarti ada catatan yang salah Tempat Uang atau belum dicatat.'] : []),
                              ...COMMON_NOTES,
                            ],
                            detail: { href: `/mutasi/${r.place.id}?sampai=${to}`, label: 'Lihat mutasi' },
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
        {board.groups.length === 0 && <p className="text-sm text-muted-foreground">Belum ada Tempat Uang Tunai/Rekening.</p>}
      </div>

      <section className="mt-8 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Belum masuk saldo</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Catatan uang sejak 1 November yang belum menyebut Tempat Uang, jadi tidak ikut saldo di atas. Total {rupiah(unplacedTotal)}.
        </p>
        <ul className="mt-3 divide-y divide-border text-sm">
          {unplaced.map((u) => (
            <li key={u.key} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
              <span>
                {u.label} <span className="text-xs text-muted-foreground">({u.count} catatan)</span>
                {unplacedLinks[u.key] && (
                  <a href={unplacedLinks[u.key] as string} className="ml-2 text-xs font-medium text-primary hover:underline">lihat →</a>
                )}
              </span>
              <span className="tabular-nums">{rupiah(u.amount)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
