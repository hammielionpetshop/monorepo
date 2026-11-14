import { CaraMembaca } from '@/components/explain';
import { backofficeUrl } from '@/lib/access';
import { getSql } from '@/lib/db';
import { rupiah, tanggal } from '@/lib/format';
import { gate } from '@/lib/gate';
import { todayWib } from '@/modules/money';
import { AWAITING_FUNDS_DAYS, loadPendingFunds, NONCASH_START, pendingByPlace, type PendingGroup } from '@/modules/pending-funds';

export const dynamic = 'force-dynamic';

const NOTES = [
  `Non-tunai baru dihitung sejak tanggal mulai Setoran (${tanggal(NONCASH_START)}); penjualan sebelum itu tidak diantrekan.`,
  `Merah = lebih dari ${AWAITING_FUNDS_DAYS} hari sejak tanggal shift/hari penjualan — biasanya dana tertahan di bank/penyedia QRIS atau lupa diverifikasi.`,
  'Angka ini belum masuk saldo rekening; saldo baru bertambah saat Finance memverifikasi di Back Office › Setoran › Non-tunai.',
];

function explain(g: PendingGroup, link: { href: string; label: string } | null) {
  return {
    meaning:
      g.placeId == null
        ? 'penjualan non-tunai yang metode bayarnya belum ditautkan ke rekening di cabangnya, jadi belum jelas masuk rekening mana.'
        : `penjualan non-tunai yang semestinya masuk ke ${g.placeName} tetapi belum dipastikan masuk.`,
    origin:
      'nota kasir Selesai dan pelunasan piutang non-tunai (QRIS, transfer, debit) per shift dan metode, dikurangi yang sudah diverifikasi Finance di Back Office › Setoran › Non-tunai.',
    calc: `belum cair ${rupiah(g.awaiting.amount)} (${g.awaiting.count} baris) + belum diverifikasi ${rupiah(g.unverified.amount)} (${g.unverified.count} baris) = ${rupiah(g.total)}`,
    notes: [...(g.placeId == null ? ['Tautkan metode bayar di Back Office › Pengaturan › Tempat Uang supaya bisa diverifikasi.'] : []), ...NOTES],
    detail: link,
  };
}

export default async function PendingFundsPage() {
  const g = await gate();
  if (g.denied) return g.denied;

  const today = todayWib();
  const rows = await loadPendingFunds(getSql(), today);
  const board = pendingByPlace(rows, today);
  const link = (() => {
    const href = backofficeUrl('/deposits?tab=noncash');
    return href ? { href, label: 'Setoran › Non-tunai (Back Office)' } : null;
  })();

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold">Dana Belum Cair</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Penjualan non-tunai per <strong>{tanggal(today)}</strong> yang uangnya belum dipastikan masuk rekening, per rekening tujuan.
          <strong> Belum cair</strong> = Finance sudah menandai dana belum masuk; <strong>belum diverifikasi</strong> = belum diperiksa Finance.
        </p>
      </div>

      <div className="mb-6 rounded-lg border border-border bg-card p-4">
        <div className="text-xs text-muted-foreground">Total dana non-tunai belum masuk saldo</div>
        <div className="text-2xl font-semibold tabular-nums">{rupiah(board.total)}</div>
        <CaraMembaca
          title="Total dana belum cair & belum diverifikasi"
          e={{
            meaning: 'semua penjualan non-tunai yang belum diverifikasi masuk rekening.',
            origin: 'jumlah tiap rekening di bawah.',
            calc: `${board.groups.map((x) => `${x.placeName} ${rupiah(x.total)}`).join(' + ') || '0'} = ${rupiah(board.total)}`,
            notes: NOTES,
            detail: link,
          }}
        />
      </div>

      <div className="space-y-6">
        {board.groups.map((grp) => (
          <section key={grp.placeId ?? 'none'} id={`tempat-${grp.placeId ?? 'none'}`} className="overflow-x-auto rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-2">
              <div>
                <h2 className={`text-sm font-semibold ${grp.placeId == null ? 'text-amber-800' : ''}`}>{grp.placeName}</h2>
                <div className={`text-xs ${grp.overdue ? 'font-semibold text-red-600' : 'text-muted-foreground'}`}>
                  Belum cair {rupiah(grp.awaiting.amount)} ({grp.awaiting.count}) · Belum diverifikasi {rupiah(grp.unverified.amount)} ({grp.unverified.count}) ·
                  tertua {tanggal(grp.oldestDate)} ({grp.oldestDays} hari)
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold tabular-nums">{rupiah(grp.total)}</div>
                <CaraMembaca title={`Dana belum masuk — ${grp.placeName}`} e={explain(grp, link)} />
              </div>
            </div>
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-left font-medium">Tanggal</th>
                  <th className="px-4 py-2 text-left font-medium">Cabang / shift</th>
                  <th className="px-4 py-2 text-left font-medium">Metode</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Angka sistem</th>
                </tr>
              </thead>
              <tbody>
                {grp.items.map((i) => (
                  <tr key={i.key} className="border-b border-border last:border-0">
                    <td className={`px-4 py-2 ${i.overdue ? 'font-semibold text-red-600' : ''}`}>
                      {tanggal(i.businessDate)} <span className="text-xs">({i.ageDays} hari)</span>
                    </td>
                    <td className="px-4 py-2">{i.branchName} <span className="text-xs text-muted-foreground">{i.shiftNumber != null ? `shift ${i.shiftNumber}` : 'pelunasan piutang BO'}</span></td>
                    <td className="px-4 py-2">{i.paymentMethodName}</td>
                    <td className="px-4 py-2">
                      {i.status === 'AWAITING'
                        ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">Belum cair</span>
                        : <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">Belum diverifikasi</span>}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{rupiah(i.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
        {board.groups.length === 0 && <p className="text-sm text-muted-foreground">Semua penjualan non-tunai sudah diverifikasi.</p>}
      </div>
    </div>
  );
}
