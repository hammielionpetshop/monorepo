import { CaraMembaca, COMMON_NOTES } from '@/components/explain';
import { getSql } from '@/lib/db';
import { bulan, rupiah } from '@/lib/format';
import { gate } from '@/lib/gate';
import { originLink } from '@/lib/links';
import {
  flowReport, KIND_LABELS, lastDayOfMonth, loadLines, loadPlaces, START_DATE, todayWib, type FlowItem, type Place,
} from '@/modules/money';

export const dynamic = 'force-dynamic';

const ITEM_ORIGIN: Partial<Record<string, string>> = {
  CASH_DEPOSIT: 'Setoran tunai yang diterima/diverifikasi Finance di Back Office › Setoran.',
  NONCASH: 'Verifikasi non-tunai (QRIS/transfer/e-wallet) yang cair ke rekening, Back Office › Setoran.',
  CASHFLOW_IN: 'Arus Kas jenis Uang masuk di Back Office, menurut kategorinya.',
  CASHFLOW_OUT: 'Arus Kas jenis Uang keluar di Back Office (termasuk pembayaran Biaya Rutin), menurut kategorinya.',
  SUPPLIER: 'Bayar Hutang Supplier di Back Office yang mengisi "Dibayar dari".',
  PAYROLL: 'Bayar Gaji & tagihan luar slip di HRIS.',
  ADVANCE: 'Kasbon yang diserahkan di HRIS.',
  ADVANCE_REPAY: 'Pelunasan kasbon tunai di HRIS.',
  UNLOADING: 'Bayar bongkaran di HRIS.',
  UNLOADING_REFUND: 'Uang kembali lebih bayar bongkaran di HRIS.',
  VEHICLE_RENTAL: 'Bayar sewa mobil di Logistik › Sewa Mobil.',
};

function itemName(i: FlowItem) {
  return i.group && (i.kind === 'CASHFLOW_IN' || i.kind === 'CASHFLOW_OUT') ? `${KIND_LABELS[i.kind]} — ${i.group}` : KIND_LABELS[i.kind];
}

function FlowTable({ title, items, total, monthLabel }: { title: string; items: FlowItem[]; total: number; monthLabel: string }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex items-baseline justify-between border-b border-border px-4 py-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-sm font-semibold tabular-nums">{rupiah(total)}</span>
      </div>
      <ul className="divide-y divide-border text-sm">
        {items.map((i) => {
          const link = originLink(i.kind);
          return (
            <li key={`${i.kind}|${i.group ?? ''}`} className="px-4 py-2">
              <div className="flex items-baseline justify-between gap-3">
                <span>
                  {itemName(i)} <span className="text-xs text-muted-foreground">({i.count} catatan)</span>
                </span>
                <span className="tabular-nums">{rupiah(i.amount)}</span>
              </div>
              <CaraMembaca
                title={`${itemName(i)} — ${monthLabel}`}
                e={{
                  meaning: `jumlah ${title.toLowerCase()} jenis ini selama ${monthLabel}, menurut tanggal uang.`,
                  origin: ITEM_ORIGIN[i.kind] ?? '—',
                  calc: `${i.count} catatan berjumlah ${rupiah(i.amount)} (pembatalan tidak dihitung; koreksi setoran mengurangi).`,
                  notes: COMMON_NOTES,
                  detail: link,
                }}
              />
            </li>
          );
        })}
        {items.length === 0 && <li className="px-4 py-3 text-muted-foreground">Tidak ada.</li>}
      </ul>
    </section>
  );
}

export default async function ArusUangPage({ searchParams }: { searchParams: Promise<{ bulan?: string; lingkup?: string }> }) {
  const g = await gate();
  if (g.denied) return g.denied;

  const q = await searchParams;
  const today = todayWib();
  const thisMonth = `${today.slice(0, 7)}-01`;
  let month = q.bulan && /^\d{4}-(0[1-9]|1[0-2])$/.test(q.bulan) ? `${q.bulan}-01` : thisMonth;
  if (month < START_DATE) month = START_DATE;
  if (month > thisMonth) month = thisMonth;
  const end = lastDayOfMonth(month) < today ? lastDayOfMonth(month) : today;

  const sql = getSql();
  const [places, lines] = await Promise.all([loadPlaces(sql), loadLines(sql, end)]);
  const scope = q.lingkup ?? 'semua';
  let chosen: Place[] = places;
  let scopeLabel = 'Gabungan semua Tempat Uang';
  const branches = [...new Map(places.map((p) => [p.branchId, p.branchName])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'id'));
  if (scope.startsWith('c')) {
    const branchId = Number(scope.slice(1));
    chosen = places.filter((p) => p.branchId === branchId);
    scopeLabel = `Tempat Uang milik ${chosen[0]?.branchName ?? 'cabang'}`;
  } else if (scope.startsWith('t')) {
    const placeId = Number(scope.slice(1));
    chosen = places.filter((p) => p.id === placeId);
    scopeLabel = chosen[0]?.name ?? 'Tempat Uang';
  }
  const report = flowReport(chosen, lines, month);
  const monthLabel = bulan(month);
  const months: string[] = [];
  for (let m = thisMonth; m >= START_DATE; m = `${new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 2, 1)).toISOString().slice(0, 10)}`) {
    months.push(m);
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Arus Uang</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            Uang masuk dan keluar {monthLabel} menurut <strong>Tempat Uang</strong>: {scopeLabel}. Ini bukan laba rugi — biaya
            per cabang yang menanggung (termasuk &quot;Kantor&quot;) ada di halaman Laba Rugi.
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-2 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Bulan</span>
            <select name="bulan" defaultValue={month.slice(0, 7)} className="rounded-md border border-border bg-background px-2 py-1.5">
              {months.map((m) => <option key={m} value={m.slice(0, 7)}>{bulan(m)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Lingkup</span>
            <select name="lingkup" defaultValue={scope} className="rounded-md border border-border bg-background px-2 py-1.5">
              <option value="semua">Gabungan</option>
              {branches.map(([id, name]) => <option key={`c${id}`} value={`c${id}`}>Cabang: {name}</option>)}
              {places.map((p) => <option key={`t${p.id}`} value={`t${p.id}`}>Tempat: {p.name}</option>)}
            </select>
          </label>
          <button className="rounded-md bg-primary px-3 py-1.5 font-medium text-white">Tampilkan</button>
        </form>
      </div>

      <section className="mb-6 grid gap-3 rounded-lg border border-border bg-card p-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <div className="text-xs text-muted-foreground">Saldo awal bulan</div>
          <div className="text-lg font-semibold tabular-nums">{rupiah(report.opening)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Uang masuk</div>
          <div className="text-lg font-semibold tabular-nums text-emerald-600">{rupiah(report.inTotal)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Uang keluar</div>
          <div className="text-lg font-semibold tabular-nums text-red-600">{rupiah(report.outTotal)}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Selisih masuk − keluar: <span className="tabular-nums">{rupiah(report.inTotal - report.outTotal)}</span>
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Pindahan masuk / keluar</div>
          <div className="text-lg font-semibold tabular-nums">{rupiah(report.transferIn)} / {rupiah(report.transferOut)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Saldo akhir {end === lastDayOfMonth(month) ? 'bulan' : 'hari ini'}</div>
          <div className={`text-lg font-semibold tabular-nums ${report.closing < 0 ? 'text-red-600' : ''}`}>{rupiah(report.closing)}</div>
          <CaraMembaca
            title={`Saldo akhir — ${scopeLabel}, ${monthLabel}`}
            e={{
              meaning: 'uang di Tempat Uang lingkup ini pada akhir bulan (atau hari ini untuk bulan berjalan); sama dengan halaman Saldo pada tanggal itu.',
              origin: 'saldo awal bulan (saldo awal 1 Nov atau saldo akhir bulan sebelumnya) ditambah uang masuk, dikurangi uang keluar, ditambah/dikurangi pindahan dari/ke tempat di luar lingkup.',
              calc: `${rupiah(report.opening)} + ${rupiah(report.inTotal)} − ${rupiah(report.outTotal)} + ${rupiah(report.transferIn)} − ${rupiah(report.transferOut)} = ${rupiah(report.closing)}`,
              notes: [
                'Pindah dana antar tempat di dalam lingkup yang sama saling meniadakan (uangnya tidak keluar dari lingkup).',
                ...COMMON_NOTES,
              ],
              detail: { href: `/?tanggal=${end}`, label: 'Lihat Saldo per tanggal itu' },
            }}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <FlowTable title="Uang masuk" items={report.inItems} total={report.inTotal} monthLabel={monthLabel} />
        <FlowTable title="Uang keluar" items={report.outItems} total={report.outTotal} monthLabel={monthLabel} />
      </div>
    </div>
  );
}
