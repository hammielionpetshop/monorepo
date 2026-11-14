import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSql } from '@/lib/db';
import { bulan, rupiah } from '@/lib/format';
import { gate } from '@/lib/gate';
import { todayWib } from '@/modules/money';
import { addMonths, cell, TOTAL_KEY } from '@/modules/profit-loss';
import {
  buildSnapshot, checkClose, closableMonth, confirmLabel, liveProfitLoss, loadClosings, loadOpenItems, monthStates,
  NOTE_MIN, overdueMonths, insertClosing, type Closing, type MonthState, type OpenItem,
} from '@/modules/month-close';

export const dynamic = 'force-dynamic';

const STATE_LABEL: Record<MonthState, string> = {
  CLOSED: 'Ditutup',
  NEXT: 'Bisa ditutup',
  WAITING: 'Menunggu bulan sebelumnya',
  CURRENT: 'Bulan berjalan',
};

function waktu(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Simpan penutupan (spec F2-6f §2). Semua pemeriksaan diulang di server; database menjaga urutan & larangan ubah. */
async function closeMonth(formData: FormData) {
  'use server';
  const g = await gate();
  if (g.denied) redirect('/tutup-bulan');
  const month = String(formData.get('bulan') ?? '');
  const confirmText = String(formData.get('konfirmasi') ?? '');
  const note = String(formData.get('catatan') ?? '').trim();
  const sql = getSql();
  const closings = await loadClosings(sql);
  const closable = closableMonth(closings.map((c) => c.month), todayWib().slice(0, 7));
  const back = (error: string) => redirect(`/tutup-bulan?galat=${encodeURIComponent(error)}&catatan=${encodeURIComponent(note)}`);
  if (!closable || month !== closable) back(checkClose({ month, closable, confirmText, openItems: [], note }) ?? 'Bulan tidak bisa ditutup.');

  const snapshot = await buildSnapshot(sql, month);
  const openItems = await loadOpenItems(sql, month, snapshot.flags);
  const error = checkClose({ month, closable, confirmText, openItems, note });
  if (error) back(error);
  try {
    await insertClosing(sql, {
      month, userId: g.viewer!.userId, withNotes: openItems.length > 0, note: note || null, openItems, snapshot,
    });
  } catch (e) {
    console.error('Tutup bulan gagal:', e);
    back(e instanceof Error && /bulan|ditutup|berurutan/i.test(e.message) ? e.message : 'Gagal menyimpan tutup bulan. Coba lagi.');
  }
  revalidatePath('/tutup-bulan');
  redirect(`/tutup-bulan?bulan=${month}&selesai=1`);
}

function OpenItems({ items }: { items: OpenItem[] }) {
  if (!items.length) return <p className="text-sm text-emerald-700">Tidak ada yang belum beres.</p>;
  return (
    <ul className="space-y-1 text-sm">
      {items.map((i) => (
        <li key={i.key}>
          ⚠️ {i.label}: {i.count}
          {i.amount != null && <> · <span className="tabular-nums">{rupiah(i.amount)}</span></>}
        </li>
      ))}
    </ul>
  );
}

function ClosedDetail({ c }: { c: Closing }) {
  const net = c.snapshot.profitLoss.lines.find((l) => l.key === 'net');
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4 text-sm">
        <div className="font-semibold">
          {confirmLabel(c.month)} — {c.withNotes ? 'Ditutup dengan catatan' : 'Ditutup'}
        </div>
        <div className="mt-1 text-muted-foreground">oleh {c.closedByName}, {waktu(c.closedAt)}</div>
        {c.note && <p className="mt-2">Catatan: {c.note}</p>}
        {net && <p className="mt-2">Laba bersih Gabungan saat ditutup: <strong className="tabular-nums">{rupiah(cell(net, TOTAL_KEY))}</strong></p>}
        <Link href={`/laba-rugi?bulan=${c.month}`} className="mt-2 inline-block font-medium text-primary hover:underline">Lihat Laba Rugi bulan ini →</Link>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">Yang belum beres saat ditutup</h3>
        <OpenItems items={c.openItems} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-3 py-2 font-semibold">Saldo akhir bulan saat ditutup</th>
              <th className="px-3 py-2 font-semibold">Cabang</th>
              <th className="px-3 py-2 text-right font-semibold">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {c.snapshot.balances.map((b) => (
              <tr key={b.placeId} className="border-b border-border">
                <td className="px-3 py-2">{b.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{b.branchName}</td>
                <td className="px-3 py-2 text-right tabular-nums">{rupiah(b.balance)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="px-3 py-2" colSpan={2}>Jumlah</td>
              <td className="px-3 py-2 text-right tabular-nums">{rupiah(c.snapshot.balanceTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function TutupBulanPage({ searchParams }: {
  searchParams: Promise<{ bulan?: string; galat?: string; catatan?: string; selesai?: string }>;
}) {
  const g = await gate();
  if (g.denied) return g.denied;

  const q = await searchParams;
  const today = todayWib();
  const thisMonth = today.slice(0, 7);
  const sql = getSql();
  const closings = await loadClosings(sql);
  const closedMonths = closings.map((c) => c.month);
  const states = monthStates(closedMonths, thisMonth);
  const next = closableMonth(closedMonths, thisMonth);
  const overdue = overdueMonths(closedMonths, today);
  const selected = q.bulan && states.some((s) => s.month === q.bulan) ? q.bulan : (next ?? thisMonth);
  const selectedState = states.find((s) => s.month === selected)!.state;
  const closing = closings.find((c) => c.month === selected);

  // Bulan yang belum ditutup: daftar belum beres sementara + ringkasan angka hidup.
  let preview: { items: OpenItem[]; net: number } | null = null;
  if (!closing) {
    const { profitLoss, flags } = await liveProfitLoss(sql, selected);
    const items = await loadOpenItems(sql, selected, flags);
    const net = profitLoss.lines.find((l) => l.key === 'net');
    preview = { items, net: net ? cell(net, TOTAL_KEY) : 0 };
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold">Tutup Bulan</h1>
        <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">
          Menutup bulan menyimpan salinan Laba Rugi dan saldo akhir bulan, sehingga angkanya tidak berubah diam-diam. Sesudah
          ditutup, Back Office menolak catatan uang bertanggal di bulan itu; biaya/pendapatan yang terlewat dicatat sebagai
          <strong> Koreksi bulan lalu</strong> di Pendapatan &amp; Pengeluaran, dan Laba Rugi bulan itu disajikan kembali. Ditutup berurutan oleh Owner atau GM, dan <strong>tidak bisa dibuka kembali</strong>.
        </p>
      </div>

      {overdue.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          ⚠️ Belum ditutup padahal sudah lewat tanggal 10 bulan berikutnya: {overdue.map((m) => bulan(m)).join(', ')}.
        </div>
      )}
      {q.selesai && closing && (
        <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          ✅ {confirmLabel(closing.month)} sudah ditutup.
        </div>
      )}
      {q.galat && <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{q.galat}</div>}

      <div className="grid gap-5 md:grid-cols-[16rem_1fr]">
        <ul className="space-y-1 text-sm">
          {states.map((s) => {
            const c = closings.find((x) => x.month === s.month);
            return (
              <li key={s.month}>
                <Link
                  href={`/tutup-bulan?bulan=${s.month}`}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 ${s.month === selected ? 'border-primary bg-card' : 'border-border'}`}
                >
                  <span>{bulan(s.month)}</span>
                  <span className={`text-xs ${s.state === 'CLOSED' ? 'text-emerald-700' : s.state === 'NEXT' ? 'font-medium text-amber-700' : 'text-muted-foreground'}`}>
                    {c?.withNotes ? 'Ditutup dgn catatan' : STATE_LABEL[s.state]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <div>
          {closing ? (
            <ClosedDetail c={closing} />
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-card p-4 text-sm">
                <div className="font-semibold">{confirmLabel(selected)} — {STATE_LABEL[selectedState]}</div>
                {selectedState === 'CURRENT' && (
                  <p className="mt-1 text-muted-foreground">Bisa ditutup mulai 1 {bulan(addMonths(selected, 1))}. Daftar di bawah adalah keadaan sementara.</p>
                )}
                {selectedState === 'WAITING' && next && (
                  <p className="mt-1 text-muted-foreground">Tutup dulu {bulan(next)}.</p>
                )}
                <p className="mt-2">Laba bersih Gabungan sekarang: <strong className="tabular-nums">{rupiah(preview!.net)}</strong>{' '}
                  <Link href={`/laba-rugi?bulan=${selected}`} className="font-medium text-primary hover:underline">Laba Rugi →</Link>
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="mb-2 text-sm font-semibold">Yang belum beres</h3>
                <OpenItems items={preview!.items} />
                {preview!.items.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Bereskan di layar asalnya (Laba Rugi, Hitung Kas, Saldo), atau tetap tutup sebagai &quot;ditutup dengan catatan&quot; dengan alasan.
                  </p>
                )}
              </div>
              {selectedState === 'NEXT' && (
                <form action={closeMonth} className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
                  <input type="hidden" name="bulan" value={selected} />
                  <label className="block">
                    <span className="mb-1 block font-medium">Ketik &quot;{confirmLabel(selected)}&quot; untuk memastikan</span>
                    <input name="konfirmasi" required autoComplete="off" className="w-full max-w-xs rounded-md border border-border bg-background px-2 py-1.5" />
                  </label>
                  {preview!.items.length > 0 && (
                    <label className="block">
                      <span className="mb-1 block font-medium">Alasan menutup dengan catatan (wajib, min. {NOTE_MIN} huruf)</span>
                      <textarea name="catatan" required minLength={NOTE_MIN} defaultValue={q.catatan ?? ''} rows={3}
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5" />
                    </label>
                  )}
                  <button className="rounded-md bg-red-600 px-3 py-1.5 font-medium text-white">Tutup {confirmLabel(selected)}</button>
                  <p className="text-xs text-amber-900">Tidak bisa dibuka kembali. Daftar belum beres dihitung ulang saat menyimpan.</p>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
