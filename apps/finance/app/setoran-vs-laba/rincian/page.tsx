import { backofficeUrl, hrisUrl } from '@/lib/access';
import { getSql } from '@/lib/db';
import { bulan, rupiah, tanggal } from '@/lib/format';
import { gate } from '@/lib/gate';
import { itemsOf, LINE_DEFS, loadBridge, TOTAL_KEY, type BridgeLineKey } from '@/modules/deposit-bridge';
import { todayWib } from '@/modules/money';
import { FIRST_MONTH, isMonth } from '@/modules/profit-loss';

export const dynamic = 'force-dynamic';

/** Layar asal tiap catatan, dari awalan ref (spec F2-6c-2 §2 "rincian"). */
function origin(ref: string): { href: string; label: string } | null {
  const prefix = ref.split(':')[0];
  const bo = (path: string, label: string) => (backofficeUrl(path) ? { href: backofficeUrl(path)!, label } : null);
  const hris = (path: string, label: string) => (hrisUrl(path) ? { href: hrisUrl(path)!, label } : null);
  switch (prefix) {
    case 'pl': return { href: '/laba-rugi', label: 'Laba Rugi' };
    case 'cf': return bo('/cash-flow', 'Arus Kas');
    case 'rc': return bo('/recurring-costs', 'Biaya Rutin');
    case 'se':
    case 'sh':
    case 'shv': return bo('/shift-history', 'Riwayat Shift');
    case 'ps': return hris('/gaji/slip', 'Slip Gaji (HRIS)');
    case 'ur': return hris('/gaji/bongkaran', 'Bongkaran (HRIS)');
    case 'ff': return hris('/logistik/bensin-mobil', 'Bensin (Logistik)');
    case 'vr': return hris('/logistik/sewa-mobil', 'Sewa Mobil (Logistik)');
    case 'trx':
    case 'ret': return bo('/transactions', 'Transaksi');
    case 'cd': return bo('/reports/receivables', 'Laporan Piutang');
    case 'dp': return bo('/reports/debt-payments', 'Riwayat Pelunasan');
    case 'ds':
    case 'dep':
    case 'cdv':
    case 'ntv':
    case 'nt':
    case 'nc': return bo('/deposits', 'Setoran');
    default: return null;
  }
}

export default async function RincianSetoranPage({ searchParams }: { searchParams: Promise<{ bulan?: string; kolom?: string; baris?: string }> }) {
  const g = await gate();
  if (g.denied) return g.denied;
  const q = await searchParams;
  const thisMonth = todayWib().slice(0, 7);
  const month = q.bulan && isMonth(q.bulan) && q.bulan >= FIRST_MONTH && q.bulan <= thisMonth ? q.bulan : thisMonth;
  const def = LINE_DEFS.find((d) => d.key === q.baris) ?? LINE_DEFS[0];

  const { bridge, items } = await loadBridge(getSql(), month);
  const col = bridge.columns.find((c) => c.key === q.kolom) ?? bridge.columns.find((c) => c.key === TOTAL_KEY)!;
  const list = itemsOf(items, def.key as BridgeLineKey, col.key);
  const total = list.reduce((s, i) => s + i.amount, 0);
  const names = new Map(bridge.columns.map((c) => [c.branchId, c.name]));

  return (
    <div>
      <a href={`/setoran-vs-laba?bulan=${month}`} className="text-sm text-primary hover:underline">← Setoran vs Laba {bulan(`${month}-01`)}</a>
      <h1 className="mt-2 text-xl font-semibold">{def.label} — {col.name}</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        {list.length} catatan · pengaruh pada setoran <span className="tabular-nums font-medium text-foreground">{rupiah(total)}</span>{' '}
        (minus = mengurangi setoran bebas dibanding laba).
      </p>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-3 py-2">Tanggal</th>
              <th className="px-3 py-2">Keterangan</th>
              <th className="px-3 py-2">Cabang</th>
              <th className="px-3 py-2 text-right">Jumlah</th>
              <th className="px-3 py-2">Asal</th>
            </tr>
          </thead>
          <tbody>
            {list.map((i, n) => {
              const link = origin(i.ref);
              return (
                <tr key={`${i.ref}-${n}`} className="border-b border-border">
                  <td className="px-3 py-2 whitespace-nowrap">{tanggal(i.date)}</td>
                  <td className="px-3 py-2">{i.label}</td>
                  <td className="px-3 py-2">{i.branchId == null ? 'Kantor' : names.get(i.branchId) ?? '—'}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${i.amount < 0 ? 'text-red-700' : ''}`}>{rupiah(i.amount)}</td>
                  <td className="px-3 py-2">{link ? <a className="text-primary hover:underline" href={link.href}>{link.label}</a> : '—'}</td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={5} className="px-3 py-3 text-muted-foreground">Tidak ada catatan.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
