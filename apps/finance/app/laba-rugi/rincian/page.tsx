import { backofficeUrl, hrisUrl } from '@/lib/access';
import { getSql } from '@/lib/db';
import { bulan, rupiah, tanggal } from '@/lib/format';
import { gate } from '@/lib/gate';
import { todayWib } from '@/modules/money';
import {
  columnKey, FIRST_MONTH, groupLabel, isMonth, loadBranches, loadCosts, OFFICE_KEY, TOTAL_KEY, type CostItem,
} from '@/modules/profit-loss';

export const dynamic = 'force-dynamic';

/** Layar asal tiap catatan (spec F2-6b §2.2), dari awalan ref. */
function origin(ref: string): { href: string; label: string } | null {
  const prefix = ref.split(':')[0];
  const bo = (path: string, label: string) => (backofficeUrl(path) ? { href: backofficeUrl(path)!, label } : null);
  const hris = (path: string, label: string) => (hrisUrl(path) ? { href: hrisUrl(path)!, label } : null);
  switch (prefix) {
    case 'cf': return bo('/cash-flow', 'Arus Kas');
    case 'se': return bo('/shift-history', 'Riwayat Shift');
    case 'rc': return bo('/recurring-costs', 'Biaya Rutin');
    case 'ps': return hris('/gaji/slip', 'Slip Gaji (HRIS)');
    case 'ur': return hris('/gaji/bongkaran', 'Bongkaran (HRIS)');
    case 'ff': return hris('/logistik/bensin-mobil', 'Bensin (Logistik)');
    case 'vr': return hris('/logistik/sewa-mobil', 'Sewa Mobil (Logistik)');
    case 'fa': return bo('/assets', 'Aset');
    default: return null;
  }
}

function lineKeyOf(c: CostItem): string {
  const id = c.group === 'CATEGORY' ? `cat:${c.category ?? ''}` : c.group;
  return `${c.kind === 'COST' ? 'cost' : 'income'}:${id}`;
}

export default async function RincianPage({ searchParams }: { searchParams: Promise<{ bulan?: string; kolom?: string; baris?: string; tanda?: string }> }) {
  const g = await gate();
  if (g.denied) return g.denied;
  const q = await searchParams;
  const thisMonth = todayWib().slice(0, 7);
  const month = q.bulan && isMonth(q.bulan) && q.bulan >= FIRST_MONTH && q.bulan <= thisMonth ? q.bulan : thisMonth;

  const sql = getSql();
  const [branches, costs] = await Promise.all([loadBranches(sql), loadCosts(sql, month)]);
  const branchName = new Map(branches.map((b) => [columnKey(b.id), b.name]));
  const colName = (k: string) => (k === OFFICE_KEY ? 'Kantor' : k === TOTAL_KEY ? 'Gabungan' : branchName.get(k) ?? k);

  let items = costs;
  let title = '';
  if (q.tanda === 'unpaid-bills') {
    items = costs.filter((c) => c.unpaidBill);
    title = 'Biaya Rutin belum dibayar';
  } else if (q.tanda === 'fuel-no-branch') {
    items = costs.filter((c) => c.group === 'FUEL' && c.branchId == null);
    title = 'Bensin tanpa cabang yang dibebani';
  } else if (q.tanda === 'unknown-kind') {
    const link = backofficeUrl('/cash-flow/categories');
    return (
      <div className="max-w-2xl text-sm">
        <h1 className="text-xl font-semibold">Belum jelas jenisnya — {bulan(`${month}-01`)}</h1>
        <p className="mt-2 text-muted-foreground">
          Catatan Arus Kas dengan kategori yang jenis laporannya belum dipilih, dan Pengeluaran Kasir yang kategorinya belum
          dipasangkan ke kategori Arus Kas, tidak dihitung di Laba Rugi sampai jenisnya jelas. Pilih jenis laporan / pasangkan
          kategorinya di Back Office, lalu buka Laba Rugi lagi.
        </p>
        {link && <a className="mt-3 inline-block font-medium text-primary hover:underline" href={link}>Kategori Arus Kas (Back Office) →</a>}
      </div>
    );
  } else {
    const kolom = q.kolom ?? TOTAL_KEY;
    if (kolom !== TOTAL_KEY) items = items.filter((c) => columnKey(c.branchId) === kolom);
    if (q.baris && q.baris !== 'all') items = items.filter((c) => lineKeyOf(c) === q.baris);
    const first = items[0];
    const lineLabel = q.baris === 'all' || !first ? 'Semua biaya & pendapatan lain' : first.group === 'CATEGORY' ? first.category ?? '' : groupLabel(first.group, first.kind);
    title = `${lineLabel} — ${colName(kolom)}`;
  }
  items = [...items].sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label, 'id'));
  const total = items.reduce((s, c) => s + (c.kind === 'COST' ? c.amount : -c.amount), 0);

  return (
    <div>
      <a href={`/laba-rugi?bulan=${month}`} className="text-sm text-primary hover:underline">← Laba Rugi {bulan(`${month}-01`)}</a>
      <h1 className="mt-2 text-xl font-semibold">{title}</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        {items.length} catatan · jumlah biaya{items.some((c) => c.kind === 'INCOME') ? ' − pendapatan lain' : ''}{' '}
        <span className="tabular-nums font-medium text-foreground">{rupiah(total)}</span>
      </p>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-3 py-2">Tanggal</th>
              <th className="px-3 py-2">Keterangan</th>
              <th className="px-3 py-2">Ditanggung</th>
              <th className="px-3 py-2 text-right">Jumlah</th>
              <th className="px-3 py-2">Asal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => {
              const link = origin(c.ref);
              return (
                <tr key={c.ref} className="border-b border-border">
                  <td className="px-3 py-2 whitespace-nowrap">{tanggal(c.date)}</td>
                  <td className="px-3 py-2">
                    {c.label}
                    {c.kind === 'INCOME' && <span className="ml-1 text-xs text-emerald-700">pendapatan lain</span>}
                    {c.unpaidBill && <span className="ml-1 text-xs text-amber-700">tagihan</span>}
                  </td>
                  <td className="px-3 py-2">{colName(columnKey(c.branchId))}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{rupiah(c.amount)}</td>
                  <td className="px-3 py-2">{link ? <a className="text-primary hover:underline" href={link.href}>{link.label}</a> : c.source}</td>
                </tr>
              );
            })}
            {items.length === 0 && <tr><td colSpan={5} className="px-3 py-3 text-muted-foreground">Tidak ada catatan.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
