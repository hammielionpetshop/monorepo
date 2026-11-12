import { CaraMembaca, type Explanation } from '@/components/explain';
import { backofficeUrl } from '@/lib/access';
import { getSql } from '@/lib/db';
import { bulan, rupiah } from '@/lib/format';
import { gate } from '@/lib/gate';
import {
  GROUP_LABEL, loadBridge, RED_RATIO, TOTAL_KEY, value, YELLOW_MIN, YELLOW_RATIO,
  type Bridge, type BridgeGroup, type BridgeLineKey, type Column, type Level,
} from '@/modules/deposit-bridge';
import { todayWib } from '@/modules/money';
import { NONCASH_START } from '@/modules/pending-funds';
import { addMonths, FIRST_MONTH, isMonth } from '@/modules/profit-loss';

export const dynamic = 'force-dynamic';

const NOTES = [
  'Laba dihitung menurut tanggal nota dan bulan biaya; Setoran bebas menurut tanggal uang setoran. Jembatan ini menjelaskan jalan uang yang berbeda di antara keduanya.',
  'Hanya uang yang sampai di Tempat Uang dipegang Finance yang menjadi setoran bebas atau melunasi utang internal.',
  'Belum ada tutup bulan: angka bulan lalu bisa berubah bila ada pembatalan atau koreksi.',
];

/** Asal angka & penjelasan tiap baris (spec F2-6c-2 §3). */
const ORIGIN: Record<BridgeLineKey, { meaning: string; origin: string }> = {
  goods: {
    meaning: 'harga pokok barang terjual, barang rusak, dan penyesuaian modal mengurangi laba, tetapi tidak mengambil uang dari setoran bulan ini. Belanja barangnya dibayar Finance dari tempat lain (bayar supplier) atau lewat utang internal di baris berikutnya.',
    origin: 'Laba Rugi bulan ini (baris Harga pokok, Barang rusak, Penyesuaian Modal) — angka yang sama, tidak dihitung ulang.',
  },
  settled: {
    meaning: 'sebagian setoran cabang ini otomatis dipakai melunasi utang belanja ke cabang lain (Gudang/Toko Pusat), jadi tidak menjadi setoran bebas.',
    origin: 'Back Office › Setoran: rincian Pelunasan setoran terverifikasi bulan ini (pelunasan otomatis F2-3), termasuk pelunasan dari uang yang diteruskan rantai.',
  },
  'costs-elsewhere': {
    meaning: 'biaya yang mengurangi laba cabang ini tetapi uangnya keluar dari tempat lain, bukan dari laci kasir: gaji, bongkaran, bensin, sewa mobil, Arus Kas, Biaya Rutin. Untuk Gabungan termasuk biaya Kantor.',
    origin: 'Laba Rugi bulan ini: semua baris biaya kecuali Pengeluaran Kasir.',
  },
  'cashier-costs': {
    meaning: 'Pengeluaran Kasir yang sudah dihitung sebagai biaya di Laba Rugi dikembalikan dulu di sini, lalu seluruh Pengeluaran Kasir dikurangkan sekali di baris C, supaya tidak terhitung dua kali.',
    origin: 'Laba Rugi bulan ini: Pengeluaran Kasir yang kategorinya dipasangkan ke kategori Arus Kas jenis Biaya.',
  },
  'other-income': {
    meaning: 'pendapatan lain menambah laba, tetapi uangnya dicatat lewat Arus Kas, bukan lewat setoran kasir.',
    origin: 'Laba Rugi bulan ini: Arus Kas jenis Pendapatan lain. Untuk Gabungan termasuk pendapatan Kantor.',
  },
  assets: {
    meaning: 'penyusutan aset dan kerugian aset rusak/hilang/dijual mengurangi laba, tetapi tidak mengeluarkan uang bulan ini (uangnya keluar saat aset dibeli, dicatat "Beli aset" yang bukan biaya). Untung jual aset mengurangi baris ini.',
    origin: 'Laba Rugi bulan ini: baris Penyusutan aset, Kerugian aset, dan Untung jual aset (Back Office › Keuangan › Aset).',
  },
  'internal-sales': {
    meaning: 'penjualan ke cabang lain (Bulk Sale / PO Internal) masuk laba penjual, tetapi dibayar lewat utang internal, bukan uang ke laci. Uangnya baru datang lewat baris "diteruskan" saat cabang pembeli menyetor.',
    origin: 'nota Selesai bulan ini ke pelanggan "cabang internal", dikurangi returnya dan koreksi Revisi Harga Beli.',
  },
  receivables: {
    meaning: 'nota kredit menambah laba tanpa uang masuk; pelunasan piutang (termasuk nota bulan lalu) membawa uang tanpa menambah laba. Minus = piutang bertambah, plus = piutang turun.',
    origin: 'piutang pelanggan non-internal: nota kredit Selesai bulan ini (−) dan pelunasan piutang yang tidak dibatalkan bulan ini (+), Back Office › Laporan Piutang & Riwayat Pelunasan.',
  },
  'cashier-expenses': {
    meaning: 'uang yang diambil dari laci untuk Pengeluaran Kasir tidak ikut disetor. Termasuk yang kategorinya belum dipasangkan (tidak dihitung di Laba Rugi).',
    origin: 'semua Pengeluaran Kasir bulan ini (Back Office › Riwayat Shift).',
  },
  variances: {
    meaning: 'kas laci yang lebih/kurang dari seharusnya saat tutup shift, dan uang setoran yang diterima Finance lebih/kurang dari kas shift atau dari angka non-tunai (biaya setor bank, salah input, dll.). Minus = kurang.',
    origin: 'tutup shift (kas nyata − kas seharusnya), Setoran tunai terverifikasi bulan ini (diterima − kas shift), verifikasi non-tunai bulan ini (diterima − angka sistem).',
  },
  'cash-undeposited': {
    meaning: 'tunai shift yang ditutup bulan ini tetapi belum menjadi setoran terverifikasi bulan ini: belum disetor, setorannya menunggu verifikasi, disetor bulan depan, atau diverifikasi cara lama.',
    origin: 'shift Tutup/Tutup Paksa bulan ini (kas sama dengan Back Office › Setoran) yang tidak masuk setoran tunai terverifikasi bertanggal bulan ini.',
  },
  'cash-prior': {
    meaning: 'tunai shift bulan lalu yang baru disetor bulan ini: masuk setoran bulan ini, padahal penjualannya ada di laba bulan lalu.',
    origin: 'shift yang ditutup sebelum bulan ini di dalam setoran tunai terverifikasi bertanggal bulan ini.',
  },
  'noncash-pending': {
    meaning: 'non-tunai (QRIS, transfer, debit) bulan ini yang belum diverifikasi Finance atau ditandai dana belum cair, jadi belum menjadi setoran.',
    origin: 'rumus Dana Belum Cair (angka sistem per shift × metode), dibatasi tanggal shift bulan ini.',
  },
  'noncash-before-start': {
    meaning: `non-tunai sebelum Setoran non-tunai berlaku (${NONCASH_START}) tidak pernah diverifikasi lewat Setoran, jadi tidak menjadi setoran bebas kecuali lewat pelunasan susulan.`,
    origin: `angka sistem non-tunai per shift × metode dengan tanggal shift bulan ini sebelum ${NONCASH_START}.`,
  },
  'non-finance': {
    meaning: 'setoran yang diterima di Tempat Uang yang tidak dipegang Finance (mis. dipegang toko) tidak melunasi utang dan tidak menjadi setoran bebas.',
    origin: 'Setoran tunai & verifikasi non-tunai terverifikasi bulan ini dengan tujuan dipegang bukan Finance.',
  },
  received: {
    meaning: 'uang setoran cabang lain yang melunasi utangnya ke cabang ini, lalu diteruskan untuk cabang ini (rantai Toko → Toko Pusat → Gudang). Menambah setoran bebas tanpa penjualan cabang ini.',
    origin: 'Back Office › Setoran: rincian Pelunasan tingkat 2 ke atas bulan ini.',
  },
  legacy: {
    meaning: 'pelunasan susulan utang lama memakai setoran bulan-bulan lalu, tetapi dicatat di bulan pelunasan itu dijalankan.',
    origin: 'Back Office › Utang Internal › Pelunasan susulan: potongan tingkat 1 bulan ini.',
  },
};

const LEVEL_CLASS: Record<Level, string> = { ok: '', yellow: 'bg-amber-100 text-amber-900', red: 'bg-red-100 text-red-800' };

function scopeOf(c: Column) {
  return c.key === TOTAL_KEY ? 'semua cabang (biaya & pendapatan Kantor ikut di baris B)' : c.name;
}

function rincian(month: string, col: string, line: string) {
  return { href: `/setoran-vs-laba/rincian?bulan=${month}&kolom=${col}&baris=${line}`, label: 'Lihat rincian' };
}

function lineExplain(b: Bridge, key: BridgeLineKey, c: Column, monthLabel: string, month: string): Explanation {
  const l = b.lines.find((x) => x.key === key)!;
  return {
    meaning: `${scopeOf(c)}, ${monthLabel}: ${ORIGIN[key].meaning}`,
    origin: ORIGIN[key].origin,
    calc: `jumlah catatannya = ${rupiah(value(l.values, c.key))}${c.key === TOTAL_KEY ? ' (semua cabang)' : ''}.`,
    notes: NOTES,
    detail: rincian(month, c.key, key),
  };
}

function unexplainedExplain(b: Bridge, c: Column, monthLabel: string): Explanation {
  const parts = b.lines.map((l) => rupiah(value(l.values, c.key))).join(' + ');
  return {
    meaning: `bagian Setoran bebas ${scopeOf(c)}, ${monthLabel}, yang belum dijelaskan baris mana pun. Ditampilkan apa adanya, tidak disembunyikan.`,
    origin: 'Setoran bebas − (Laba bersih + jumlah semua baris A–D).',
    calc: `${rupiah(value(b.free, c.key))} − (${rupiah(value(b.net, c.key))} + ${parts || '0'}) = ${rupiah(value(b.unexplained, c.key))}`,
    notes: [
      `Kuning bila lebih dari ${rupiah(YELLOW_MIN)} dan lebih dari ${YELLOW_RATIO * 100}% penjualan bersih; merah bila lebih dari ${RED_RATIO * 100}%.`,
      'Kemungkinan sebab: shift dibuka di bulan lalu dan ditutup bulan ini (nota dan kas beda bulan), nota dibatalkan/diubah sesudah shift ditutup atau setoran diverifikasi, retur yang uangnya tidak keluar dari laci, setoran dikoreksi bulan berikutnya, pembulatan, data lama sebelum alur Setoran.',
      'Bila besar, buka rincian baris C dan bandingkan dengan Back Office › Setoran sebelum mengambil kesimpulan.',
    ],
  };
}

export default async function SetoranVsLabaPage({ searchParams }: { searchParams: Promise<{ bulan?: string; kolom?: string }> }) {
  const g = await gate();
  if (g.denied) return g.denied;

  const q = await searchParams;
  const thisMonth = todayWib().slice(0, 7);
  let month = q.bulan && isMonth(q.bulan) ? q.bulan : thisMonth;
  if (month < FIRST_MONTH) month = FIRST_MONTH;
  if (month > thisMonth) month = thisMonth;

  const { bridge: b, flags } = await loadBridge(getSql(), month);
  const monthLabel = bulan(`${month}-01`);
  const months: string[] = [];
  for (let m = thisMonth; m >= FIRST_MONTH; m = addMonths(m, -1)) months.push(m);
  const onlyKey = q.kolom && b.columns.some((c) => c.key === q.kolom) ? q.kolom : '';
  const shown = onlyKey ? b.columns.filter((c) => c.key === onlyKey) : b.columns;
  const groups = (['A', 'B', 'C', 'D'] as BridgeGroup[]).filter((gk) => b.lines.some((l) => l.group === gk));
  const depositsUrl = backofficeUrl('/deposits');
  const cellCls = (c: Column) => `px-3 py-2 text-right ${c.key === TOTAL_KEY ? 'bg-muted' : ''}`;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Setoran vs Laba</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            Kenapa Setoran bebas {monthLabel} tidak sama dengan Laba bersih: baris paling atas = Laba bersih di Laba Rugi,
            baris paling bawah = Setoran bebas di Utang Antar Cabang. Di antaranya setiap jalan uang yang berbeda; sisanya
            tampil terbuka sebagai <strong>Selisih belum terjelaskan</strong>.
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
              {b.columns.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
            </select>
          </label>
          <button className="rounded-md bg-primary px-3 py-1.5 font-medium text-white">Tampilkan</button>
        </form>
      </div>

      {flags.length > 0 && (
        <ul className="mb-5 space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {flags.map((f) => (
            <li key={f.key}>
              ⚠️ {f.label}: {f.count} {f.key === 'open-slips' ? 'orang' : f.key === 'rental-unpaid' ? 'mobil' : 'catatan'}
              {f.amount != null && <> · <span className="tabular-nums">{rupiah(f.amount)}</span></>}
            </li>
          ))}
        </ul>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="sticky left-0 bg-card px-3 py-2 font-semibold">{monthLabel}</th>
              {shown.map((c) => <th key={c.key} className={`${cellCls(c)} font-semibold`}>{c.name}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border align-top font-semibold">
              <td className="sticky left-0 bg-card px-3 py-2">Laba bersih (Laba Rugi)</td>
              {shown.map((c) => (
                <td key={c.key} className={cellCls(c)}>
                  <div className="tabular-nums">{rupiah(value(b.net, c.key))}</div>
                  <a className="text-xs font-normal text-primary hover:underline" href={`/laba-rugi?bulan=${month}`}>Laba Rugi</a>
                </td>
              ))}
            </tr>
            {groups.map((gk) => (
              <GroupRows key={gk} gk={gk} b={b} shown={shown} month={month} monthLabel={monthLabel} cellCls={cellCls} />
            ))}
            <tr className="border-b border-border align-top">
              <td className="sticky left-0 bg-card px-3 py-2 font-medium">± Selisih belum terjelaskan</td>
              {shown.map((c) => (
                <td key={c.key} className={cellCls(c)}>
                  <span className={`rounded px-1.5 py-0.5 tabular-nums ${LEVEL_CLASS[b.levels[c.key]]}`}>{rupiah(value(b.unexplained, c.key))}</span>
                  <CaraMembaca title={`Selisih belum terjelaskan — ${c.name}, ${monthLabel}`} e={unexplainedExplain(b, c, monthLabel)} />
                </td>
              ))}
            </tr>
            <tr className="align-top font-semibold">
              <td className="sticky left-0 bg-card px-3 py-2">= Setoran bebas (Utang Antar Cabang)</td>
              {shown.map((c) => (
                <td key={c.key} className={cellCls(c)}>
                  <div className="tabular-nums">{rupiah(value(b.free, c.key))}</div>
                  <a className="text-xs font-normal text-primary hover:underline" href={`/utang-antar-cabang?bulan=${month}`}>Utang Antar Cabang</a>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {depositsUrl && (
        <p className="mt-3 text-xs text-muted-foreground">
          Sumber setoran: <a className="text-primary hover:underline" href={depositsUrl}>Back Office › Setoran</a>.
        </p>
      )}
    </div>
  );
}

function GroupRows({ gk, b, shown, month, monthLabel, cellCls }: {
  gk: BridgeGroup; b: Bridge; shown: Column[]; month: string; monthLabel: string; cellCls: (c: Column) => string;
}) {
  const lines = b.lines.filter((l) => l.group === gk);
  return (
    <>
      <tr className="border-b border-border bg-muted/40">
        <td colSpan={shown.length + 1} className="sticky left-0 px-3 py-1.5 text-xs font-semibold text-muted-foreground">{GROUP_LABEL[gk]}</td>
      </tr>
      {lines.map((l) => (
        <tr key={l.key} className="border-b border-border align-top">
          <td className="sticky left-0 max-w-sm bg-card px-3 py-2 pl-6">{l.label}</td>
          {shown.map((c) => (
            <td key={c.key} className={cellCls(c)}>
              <div className="tabular-nums">{rupiah(value(l.values, c.key))}</div>
              <CaraMembaca title={`${l.label} — ${c.name}, ${monthLabel}`} e={lineExplain(b, l.key, c, monthLabel, month)} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
