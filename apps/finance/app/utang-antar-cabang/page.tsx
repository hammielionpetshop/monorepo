import { CaraMembaca } from '@/components/explain';
import { backofficeUrl } from '@/lib/access';
import { getSql } from '@/lib/db';
import { bulan, rupiah, tanggal } from '@/lib/format';
import { gate } from '@/lib/gate';
import {
  AGE_LABELS, AUTO_SETTLEMENT_START, debtorSummaries, freeDeposits, loadPayables, loadPayments, loadSettlementPieces,
  openDebts, RED_AGE_DAYS, trend, weekEnds, type AgeBucket,
} from '@/modules/inter-branch-debts';
import { todayWib } from '@/modules/money';
import { addMonths, FIRST_MONTH, isMonth } from '@/modules/profit-loss';

export const dynamic = 'force-dynamic';

/** Catatan baku Utang Antar Cabang (spec F2-6c §2). */
const DEBT_NOTES = [
  'Utang lama (lahir sebelum 1 November 2026) tidak dilunasi otomatis oleh Setoran; berkurang lewat bayar manual atau pelunasan susulan di Back Office.',
  'Setoran ke Tempat Uang yang tidak dipegang Finance belum melunasi utang sampai uangnya dipindah ke Finance.',
  `Merah = umur lebih dari ${RED_AGE_DAYS} hari (sama dengan Back Office › Utang Internal). Umur dihitung dari tanggal kiriman diterima (utang lahir).`,
];

const BUCKETS: AgeBucket[] = ['D0_7', 'D8_30', 'D31'];

type Query = { cabang?: string; pemasok?: string; umur?: string; lama?: string; bulan?: string };

export default async function DebtsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const g = await gate();
  if (g.denied) return g.denied;

  const q = await searchParams;
  const today = todayWib();
  const thisMonth = today.slice(0, 7);
  let month = q.bulan && isMonth(q.bulan) ? q.bulan : thisMonth;
  if (month < FIRST_MONTH) month = FIRST_MONTH;
  if (month > thisMonth) month = thisMonth;
  const months: string[] = [];
  for (let m = thisMonth; m >= FIRST_MONTH; m = addMonths(m, -1)) months.push(m);

  const sql = getSql();
  const [payables, payments, pieces] = await Promise.all([loadPayables(sql), loadPayments(sql), loadSettlementPieces(sql)]);
  const debts = openDebts(payables, payments, today);
  const summary = debtorSummaries(debts);
  const points = weekEnds(AUTO_SETTLEMENT_START, today);
  const tr = trend(payables, payments, points);
  const free = freeDeposits(pieces, month);
  const payablesUrl = backofficeUrl('/purchase-orders/internal/payables');
  const depositsUrl = backofficeUrl('/deposits?tab=history');

  const branchId = Number(q.cabang) || null;
  const creditorId = Number(q.pemasok) || null;
  const bucket = BUCKETS.includes(q.umur as AgeBucket) ? (q.umur as AgeBucket) : null;
  const legacyOnly = q.lama === '1';
  const filtered = debts.filter(
    (d) => (!branchId || d.debtorId === branchId) && (!creditorId || d.creditorId === creditorId) && (!bucket || d.bucket === bucket) && (!legacyOnly || d.legacy),
  );
  const branches = [...new Map(payables.flatMap((p) => [[p.debtorId, p.debtorName], [p.creditorId, p.creditorName]] as const)).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'id'));

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold">Utang Antar Cabang</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Sisa utang kiriman PO Internal per <strong>{tanggal(today)}</strong>: siapa berutang ke siapa, berapa lama, dan bagaimana
          trennya. Sama dengan Back Office › Utang Internal, untuk semua cabang.
        </p>
      </div>

      <div className="mb-6 rounded-lg border border-border bg-card p-4">
        <div className="text-xs text-muted-foreground">Total sisa utang semua cabang</div>
        <div className="text-2xl font-semibold tabular-nums">{rupiah(summary.total)}</div>
        <CaraMembaca
          title="Total sisa utang antar cabang"
          e={{
            meaning: 'jumlah utang kiriman PO Internal yang belum lunas, semua cabang.',
            origin: 'Back Office › Utang Internal: total tagihan − yang sudah dibayar, untuk tagihan Belum/Sebagian dibayar. Yang dihapuskan tidak dihitung.',
            calc: `${summary.rows.map((r) => `${r.debtorName} ${rupiah(r.remaining)}`).join(' + ') || '0'} = ${rupiah(summary.total)}`,
            notes: DEBT_NOTES,
            detail: payablesUrl ? { href: payablesUrl, label: 'Utang Internal (Back Office)' } : null,
          }}
        />
      </div>

      <section className="mb-8 overflow-x-auto rounded-lg border border-border bg-card">
        <h2 className="border-b border-border px-4 py-2 text-sm font-semibold">Per cabang yang berutang</h2>
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-2 text-left font-medium">Cabang</th>
              <th className="px-4 py-2 text-left font-medium">Ke pemasok</th>
              {BUCKETS.map((b) => <th key={b} className="px-4 py-2 text-right font-medium">{AGE_LABELS[b]}</th>)}
              <th className="px-4 py-2 text-left font-medium">Paling lama</th>
              <th className="px-4 py-2 text-right font-medium">Sisa utang</th>
            </tr>
          </thead>
          <tbody>
            {summary.rows.map((r) => (
              <tr key={r.debtorId} className="border-b border-border align-top last:border-0">
                <td className="px-4 py-2">
                  <a href={`?cabang=${r.debtorId}#tagihan`} className="font-medium hover:text-primary hover:underline">{r.debtorName}</a>
                  <div className="text-xs text-muted-foreground">{r.count} tagihan</div>
                  {r.legacyRemaining > 0 && (
                    <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">utang lama {rupiah(r.legacyRemaining)}</span>
                  )}
                </td>
                <td className="px-4 py-2 text-xs">
                  {r.creditors.map((c) => <div key={c.creditorId}>{c.creditorName}: <span className="tabular-nums">{rupiah(c.remaining)}</span></div>)}
                </td>
                {BUCKETS.map((b) => (
                  <td key={b} className={`px-4 py-2 text-right tabular-nums ${b === 'D31' && r.buckets[b] > 0 ? 'text-red-600' : ''}`}>
                    {r.buckets[b] ? rupiah(r.buckets[b]) : '–'}
                  </td>
                ))}
                <td className={`px-4 py-2 text-xs ${r.red ? 'font-semibold text-red-600' : 'text-muted-foreground'}`}>
                  {tanggal(r.oldestBornOn)}<div>{r.oldestDays} hari</div>
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="font-semibold tabular-nums">{rupiah(r.remaining)}</div>
                  <div className="flex justify-end">
                    <CaraMembaca
                      title={`Sisa utang ${r.debtorName}`}
                      e={{
                        meaning: `utang ${r.debtorName} ke cabang pemasoknya atas kiriman PO Internal yang belum lunas.`,
                        origin: 'Back Office › Utang Internal, tagihan Belum/Sebagian dibayar dengan cabang ini sebagai penerima barang.',
                        calc: `${r.creditors.map((c) => `ke ${c.creditorName} ${rupiah(c.remaining)}`).join(' + ')} = ${rupiah(r.remaining)}; menurut umur ${BUCKETS.map((b) => `${AGE_LABELS[b]} ${rupiah(r.buckets[b])}`).join(', ')}.`,
                        notes: DEBT_NOTES,
                        detail: { href: `?cabang=${r.debtorId}#tagihan`, label: 'Lihat tagihannya' },
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {summary.rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-4 text-center text-muted-foreground">Tidak ada utang antar cabang yang terbuka.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="mb-8 overflow-x-auto rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-2">
          <h2 className="text-sm font-semibold">Tren sisa utang per akhir minggu</h2>
          <p className="text-xs text-muted-foreground">Sisa pada akhir hari Minggu tiap minggu sejak 1 November; kolom terakhir = hari ini.</p>
        </div>
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-2 text-left font-medium">Cabang</th>
              {points.map((p, i) => (
                <th key={p} className="px-4 py-2 text-right font-medium">{i === points.length - 1 ? 'Hari ini' : tanggal(p).replace(/ \d{4}$/, '')}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tr.rows.map((r) => (
              <tr key={r.debtorId} className="border-b border-border last:border-0">
                <td className="px-4 py-2">{r.debtorName}</td>
                {r.points.map((v, i) => {
                  const prev = i > 0 ? r.points[i - 1] : null;
                  const arrow = prev == null || v === prev ? '' : v > prev ? ' ↑' : ' ↓';
                  return (
                    <td key={points[i]} className="px-4 py-2 text-right tabular-nums">
                      {rupiah(v)}<span className={v > (prev ?? v) ? 'text-red-600' : 'text-emerald-700'}>{arrow}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-t border-border font-semibold">
              <td className="px-4 py-2">Total</td>
              {tr.totals.map((v, i) => <td key={points[i]} className="px-4 py-2 text-right tabular-nums">{rupiah(v)}</td>)}
            </tr>
          </tbody>
        </table>
        <div className="px-4 pb-3">
          <CaraMembaca
            title="Tren sisa utang"
            e={{
              meaning: 'berapa sisa utang tiap cabang pada akhir tiap minggu. Naik = belanja lebih cepat dari setorannya.',
              origin: 'dihitung ulang dari tanggal utang lahir dan tanggal setiap pembayaran (otomatis, manual, retur & saldo internal, termasuk pembatalannya).',
              calc: `sisa pada tanggal T = total tagihan yang lahir s.d. T − pembayaran s.d. T. Total hari ini ${rupiah(tr.totals[tr.totals.length - 1] ?? 0)}.`,
              notes: [
                'Utang yang dihapuskan dianggap nol mulai tanggal terakhir diubah (Back Office tidak menyimpan tanggal penghapusan sendiri).',
                'Bila nilai tagihan dibetulkan lewat Revisi Harga Beli, titik minggu lalu memakai nilai tagihan yang sekarang.',
                ...DEBT_NOTES,
              ],
            }}
          />
        </div>
      </section>

      <section id="tagihan" className="mb-8 rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-2">
          <h2 className="text-sm font-semibold">Tagihan terbuka ({filtered.length})</h2>
          <form className="flex flex-wrap items-end gap-2 text-xs">
            <select name="cabang" defaultValue={branchId ?? ''} className="rounded-md border border-border bg-background px-2 py-1">
              <option value="">Semua yang berutang</option>
              {branches.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <select name="pemasok" defaultValue={creditorId ?? ''} className="rounded-md border border-border bg-background px-2 py-1">
              <option value="">Semua pemasok</option>
              {branches.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <select name="umur" defaultValue={bucket ?? ''} className="rounded-md border border-border bg-background px-2 py-1">
              <option value="">Semua umur</option>
              {BUCKETS.map((b) => <option key={b} value={b}>{AGE_LABELS[b]}</option>)}
            </select>
            <label className="flex items-center gap-1"><input type="checkbox" name="lama" value="1" defaultChecked={legacyOnly} /> utang lama saja</label>
            <input type="hidden" name="bulan" value={month} />
            <button className="rounded-md bg-primary px-3 py-1 font-medium text-white">Saring</button>
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left font-medium">Nomor / lahir</th>
                <th className="px-4 py-2 text-left font-medium">Cabang → pemasok</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 text-right font-medium">Dibayar otomatis</th>
                <th className="px-4 py-2 text-right font-medium">Manual</th>
                <th className="px-4 py-2 text-right font-medium">Retur & saldo</th>
                <th className="px-4 py-2 text-right font-medium">Sisa</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-b border-border align-top last:border-0">
                  <td className="px-4 py-2">
                    {payablesUrl ? <a href={payablesUrl} className="font-medium hover:text-primary hover:underline">{d.ibtNumber}</a> : d.ibtNumber}
                    <div className={`text-xs ${d.red ? 'font-semibold text-red-600' : 'text-muted-foreground'}`}>
                      {tanggal(d.bornOn)} · {d.ageDays} hari
                    </div>
                    {d.legacy && <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">utang lama</span>}
                  </td>
                  <td className="px-4 py-2">{d.debtorName} → {d.creditorName}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{rupiah(d.total)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{rupiah(d.paidBy.AUTO)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{rupiah(d.paidBy.MANUAL)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{rupiah(d.paidBy.RETURN)}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="font-semibold tabular-nums">{rupiah(d.remaining)}</div>
                    <div className="flex justify-end">
                      <CaraMembaca
                        title={`Sisa ${d.ibtNumber}`}
                        e={{
                          meaning: `bagian kiriman ${d.ibtNumber} yang belum dibayar ${d.debtorName} ke ${d.creditorName}.`,
                          origin: 'Back Office › Utang Internal (total tagihan & yang sudah dibayar); rincian bayar dari riwayat bayarnya: SETORAN/susulan = otomatis, tanpa label = manual, Retur Internal & Saldo Internal.',
                          calc: `${rupiah(d.total)} − (otomatis ${rupiah(d.paidBy.AUTO)} + manual ${rupiah(d.paidBy.MANUAL)} + retur & saldo ${rupiah(d.paidBy.RETURN)}) = ${rupiah(d.remaining)}`,
                          notes: DEBT_NOTES,
                          detail: payablesUrl ? { href: payablesUrl, label: 'Utang Internal (Back Office)' } : null,
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-4 text-center text-muted-foreground">Tidak ada tagihan yang cocok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-2">
          <div>
            <h2 className="text-sm font-semibold">Setoran bebas — {bulan(`${month}-01`)}</h2>
            <p className="text-xs text-muted-foreground">Sisa setoran terverifikasi sesudah melunasi utang antar cabang, per cabang. Total {rupiah(free.totalFree)}.</p>
          </div>
          <form className="flex items-end gap-2 text-xs">
            <select name="bulan" defaultValue={month} className="rounded-md border border-border bg-background px-2 py-1">
              {months.map((m) => <option key={m} value={m}>{bulan(`${m}-01`)}</option>)}
            </select>
            <button className="rounded-md bg-primary px-3 py-1 font-medium text-white">Tampilkan</button>
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left font-medium">Cabang</th>
                <th className="px-4 py-2 text-right font-medium">Setoran sendiri</th>
                <th className="px-4 py-2 text-right font-medium">Diterima dari rantai</th>
                <th className="px-4 py-2 text-left font-medium">Melunasi utang ke</th>
                <th className="px-4 py-2 text-right font-medium">Setoran bebas</th>
              </tr>
            </thead>
            <tbody>
              {free.rows.map((r) => (
                <tr key={r.branchId} className="border-b border-border align-top last:border-0">
                  <td className="px-4 py-2 font-medium">{r.branchName}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{rupiah(r.ownDeposits)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{rupiah(r.received)}</td>
                  <td className="px-4 py-2 text-xs">
                    {r.settledByCreditor.length === 0 ? '–' : r.settledByCreditor.map((c) => <div key={c.creditorId}>{c.creditorName}: <span className="tabular-nums">{rupiah(c.amount)}</span></div>)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="font-semibold tabular-nums">{rupiah(r.free)}</div>
                    <div className="flex justify-end">
                      <CaraMembaca
                        title={`Setoran bebas ${r.branchName} — ${bulan(`${month}-01`)}`}
                        e={{
                          meaning: `uang setoran yang tersisa untuk ${r.branchName} sesudah melunasi utang belanjanya ke cabang lain.`,
                          origin: 'Back Office › Setoran: rincian Pelunasan tiap setoran tunai & non-tunai terverifikasi (dan pelunasan susulan), menurut tanggal uang setorannya.',
                          calc: `setoran sendiri ${rupiah(r.ownDeposits)} + diterima dari rantai ${rupiah(r.received)} − melunasi utang ${rupiah(r.settled)} = ${rupiah(r.free)}`,
                          notes: [
                            'Setoran bebas bukan laba: di dalamnya bercampur modal dan laba, dan belum memperhitungkan stok, piutang pelanggan, serta biaya yang dibayar dari tempat lain. Penjelasannya menyusul di layar "Setoran bebas vs laba" (F2-6c-2).',
                            '"Diterima dari rantai" = uang setoran cabang lain yang dipakai melunasi utang ke cabang ini, lalu diteruskan melunasi utang cabang ini sendiri (mis. Toko Pusat ke Gudang).',
                            'Hanya setoran yang sampai di Tempat Uang dipegang Finance yang melunasi. Koreksi verifikasi ikut bulan setoran asalnya.',
                          ],
                          detail: depositsUrl ? { href: depositsUrl, label: 'Riwayat Setoran (Back Office)' } : null,
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {free.rows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-4 text-center text-muted-foreground">Belum ada setoran terverifikasi bulan ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
