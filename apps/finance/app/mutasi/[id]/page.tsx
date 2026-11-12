import Link from 'next/link';
import { CaraMembaca, COMMON_NOTES } from '@/components/explain';
import { getSql } from '@/lib/db';
import { rupiah, tanggal } from '@/lib/format';
import { gate } from '@/lib/gate';
import { originLink } from '@/lib/links';
import { countCheck, isDate, ledger, loadCashCounts, loadLines, loadPlaces, START_DATE, todayWib, type LedgerRow } from '@/modules/money';

export const dynamic = 'force-dynamic';

const SOURCE_LABEL = { BO: 'Back Office', HRIS: 'HRIS', LOGISTIK: 'Logistik' } as const;

export default async function MutasiPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ dari?: string; sampai?: string }> }) {
  const g = await gate();
  if (g.denied) return g.denied;

  const { id } = await params;
  const q = await searchParams;
  const today = todayWib();
  let to = isDate(q.sampai) ? q.sampai : today;
  if (to > today) to = today;
  if (to < START_DATE) to = START_DATE;
  let from = isDate(q.dari) ? q.dari : `${to.slice(0, 7)}-01`;
  if (from < START_DATE) from = START_DATE;
  if (from > to) from = to;

  const sql = getSql();
  const [places, lines, counts] = await Promise.all([loadPlaces(sql), loadLines(sql, to), loadCashCounts(sql, to)]);
  const place = places.find((p) => p.id === Number(id));
  if (!place) {
    return <p className="text-sm text-muted-foreground">Tempat Uang tidak ditemukan. <Link href="/" className="text-primary">Kembali ke Saldo</Link></p>;
  }
  const result = ledger(place, lines, from, to);
  const inSum = result.rows.filter((r) => r.amount > 0).reduce((a, r) => a + r.amount, 0);
  const outSum = result.rows.filter((r) => r.amount < 0).reduce((a, r) => a - r.amount, 0);
  // Penanda Hitung Kas (F2-6e-2) di akhir hari hitungnya; bukan baris uang, saldo berjalan tidak berubah.
  const checks = counts
    .filter((c) => c.placeId === place.id && c.countedOn >= from && c.countedOn <= to)
    .map((c) => countCheck(place, lines, c))
    .sort((a, b) => a.count.countedOn.localeCompare(b.count.countedOn));
  type Item = { type: 'line'; row: LedgerRow } | { type: 'count'; check: (typeof checks)[number] };
  const items: Item[] = [];
  let next = 0;
  for (const row of result.rows) {
    while (next < checks.length && checks[next].count.countedOn < row.date) items.push({ type: 'count', check: checks[next++] });
    items.push({ type: 'line', row });
  }
  while (next < checks.length) items.push({ type: 'count', check: checks[next++] });

  return (
    <div>
      <Link href={`/?tanggal=${to}`} className="text-sm text-primary hover:underline">← Saldo</Link>
      <div className="mb-5 mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Mutasi — {place.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {place.branchName} · {place.kind === 'BANK' ? 'Rekening' : 'Tunai'} · {tanggal(from)} s.d. {tanggal(to)}, menurut tanggal uang.
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-2 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Dari</span>
            <input type="date" name="dari" defaultValue={from} min={START_DATE} max={today} className="rounded-md border border-border bg-background px-2 py-1.5" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Sampai</span>
            <input type="date" name="sampai" defaultValue={to} min={START_DATE} max={today} className="rounded-md border border-border bg-background px-2 py-1.5" />
          </label>
          <button className="rounded-md bg-primary px-3 py-1.5 font-medium text-white">Tampilkan</button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-2 text-left font-medium">Tanggal</th>
              <th className="px-4 py-2 text-left font-medium">Keterangan</th>
              <th className="px-4 py-2 text-left font-medium">Sumber</th>
              <th className="px-4 py-2 text-right font-medium">Masuk</th>
              <th className="px-4 py-2 text-right font-medium">Keluar</th>
              <th className="px-4 py-2 text-right font-medium">Saldo</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border bg-muted/50">
              <td className="px-4 py-2">{tanggal(from)}</td>
              <td className="px-4 py-2 font-medium" colSpan={4}>
                {from === START_DATE
                  ? place.opening == null ? 'Saldo awal 1 Nov 2026 (belum diisi, dihitung 0)' : 'Saldo awal 1 Nov 2026'
                  : 'Saldo awal periode (akhir hari sebelumnya)'}
              </td>
              <td className="px-4 py-2 text-right font-semibold tabular-nums">{rupiah(result.startBalance)}</td>
            </tr>
            {items.map((item) => {
              if (item.type === 'count') {
                const { count, systemBalance, variance } = item.check;
                return (
                  <tr key={`hk:${count.id}`} className="border-b border-border bg-sky-50 text-xs last:border-0">
                    <td className="whitespace-nowrap px-4 py-2">{tanggal(count.countedOn)}</td>
                    <td className="px-4 py-2" colSpan={4}>
                      <Link href={`/hitung-kas?bulan=${count.countedOn.slice(0, 7)}&tempat=${place.id}`} className="font-medium hover:underline">
                        Dihitung nyata (Hitung Kas #{count.id}): {rupiah(count.amount)}
                      </Link>
                      {' · '}saldo menurut catatan akhir hari itu {rupiah(systemBalance)} ·{' '}
                      <span className={variance < 0 ? 'text-red-600' : variance > 0 ? 'text-blue-700' : ''}>
                        {variance === 0 ? 'cocok' : `${variance < 0 ? 'kurang' : 'lebih'} ${rupiah(Math.abs(variance))}`}
                      </span>
                      <span className="text-muted-foreground"> — penanda saja, tidak mengubah saldo</span>
                    </td>
                    <td />
                  </tr>
                );
              }
              const r = item.row;
              const link = originLink(r.kind);
              return (
                <tr key={`${r.ref}:${r.kind}`} className="border-b border-border last:border-0">
                  <td className="whitespace-nowrap px-4 py-2">{tanggal(r.date)}</td>
                  <td className="px-4 py-2">{r.label}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {link ? <a href={link.href} className="hover:text-primary hover:underline">{SOURCE_LABEL[r.source]}</a> : SOURCE_LABEL[r.source]}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.amount > 0 ? rupiah(r.amount) : ''}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.amount < 0 ? rupiah(-r.amount) : ''}</td>
                  <td className={`px-4 py-2 text-right tabular-nums ${r.running < 0 ? 'text-red-600' : ''}`}>{rupiah(r.running)}</td>
                </tr>
              );
            })}
            {result.rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-4 text-center text-muted-foreground">Tidak ada uang masuk/keluar di periode ini.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-lg border border-border bg-card p-4 text-sm">
        Saldo akhir {tanggal(to)}: <span className={`font-semibold tabular-nums ${result.endBalance < 0 ? 'text-red-600' : ''}`}>{rupiah(result.endBalance)}</span>
        <CaraMembaca
          title={`Saldo akhir ${place.name}`}
          e={{
            meaning: 'uang di tempat ini pada akhir tanggal "Sampai".',
            origin: 'saldo awal periode ditambah semua baris masuk dan dikurangi semua baris keluar di tabel di atas (urut tanggal uang).',
            calc: `${rupiah(result.startBalance)} + ${rupiah(inSum)} − ${rupiah(outSum)} = ${rupiah(result.endBalance)}`,
            notes: [
              'Baris "(koreksi)" / "(batal)" adalah pembalikan dari Back Office; ia meniadakan baris asalnya.',
              'Catatan yang dibatalkan di layar asal tidak tampil di sini.',
              ...COMMON_NOTES,
            ],
          }}
        />
      </div>
    </div>
  );
}
