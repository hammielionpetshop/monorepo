# Estafet Shift — Design

Tanggal: 2026-10-11
Scope: `apps/backoffice` (POS web settlement + Back Office Riwayat Shift), `packages/shared`
Status: **Tayang di 1.107.57** (commit e33219c + 1b61040, rilis a8ead84). Tanpa migrasi DB.

## Ringkasan

Toko Pusat & Toko Depan rutin memakai dua shift per hari: shift 1 (±07.00–17.00) ditutup,
uangnya dibawa, lalu shift 2 (±17.00–20.00) dibuka. Sebelumnya struk settlement shift 2 dan
Riwayat Shift hanya menampilkan shift itu sendiri, sehingga total sehari harus dijumlah manual.

Prinsip utama: **penggabungan hanya di tampilan.** Data shift tetap terpisah per baris
`shifts`; setoran, selisih, dan verifikasi finance tetap **per shift**. Tidak ada angka shift 1
yang disimpan ke shift 2, jadi tidak ada yang terhitung dua kali.

## Keputusan owner

| # | Keputusan |
|---|---|
| 1 | Struk shift 2 memuat rekap **ringkas** shift sebelumnya hari itu (per shift + total), bukan per nota. |
| 2 | Daftar transaksi non-tunai di struk shift 2 = **seluruh shift hari itu**, dikelompokkan per shift. |
| 3 | Cetak ulang dari Back Office juga tampil gabungan. |
| 4 | **Tidak ada modal titipan** ("biar tidak ribet"). Alur modal tetap: modal shift sebelumnya otomatis jadi saran modal awal shift berikut (bisa diubah). |
| 5 | Kotak "Shift Ditutup!" tidak boleh tertutup tanpa klik tombolnya. Tombol "Serah Terima" hanya saat menutup **shift 1**; shift ke-2 dst. langsung selesai. |
| 6 | Baris "Pelunasan Piutang Tunai" wajib tampil di rekap (menjelaskan kenapa kas disetor > tunai penjualan). |
| 7 | Riwayat Shift **menggabung** shift estafet: baris induk tertutup bawaannya; verifikasi setoran tetap per shift (induk menampilkan "x/y diverifikasi"); shift yang masih berjalan ikut tergabung. |

## Definisi "satu hari estafet"

Shift **kasir** (`origin = 'POS'`) di cabang yang sama yang dibuka pada **hari WIB** yang sama.
Shift buatan backoffice (`origin = 'BACKOFFICE'`, penjualan grosir Gudang) bukan laci kasir —
tidak pernah ikut digabung atau direkap. Shift ditutup paksa ikut, diberi tanda.

## Rekap hari (`lib/services/shift-day-recap.ts`)

`getShiftDayRecap(runner, shift)` → `ShiftDayRecap | null` (tipe di
`packages/shared/src/types/shift.ts`). Mengambil shift cabang itu sejak awal hari WIB sampai
shift yang dicetak: shift itu sendiri (dicocokkan lewat **id**) + shift lain yang sudah
ditutup. `null` bila hanya satu shift → struk tetap seperti dulu.

Rumus per shift sama dengan settlement (`api/pos/shifts/[id]/settle`):

- Tunai = pembayaran CASH − kembalian (sebelum pengeluaran)
- Non-tunai = semua metode selain CASH & DEBT (QRIS, transfer, e-wallet, dll.)
- Hutang = metode DEBT; Diskon = Σ discount_amount
- Pelunasan piutang tunai = `debt_payments` CASH yang belum di-void
- OMZET = tunai + non-tunai + hutang
- Kas harus ada / disetor / selisih = angka tersimpan di `shifts` (null selama berjalan)

**Jebakan:** `opened_at` di DB presisi mikrodetik, `Date` JS milidetik. Jangan memakai
`lte(openedAt, shift.openedAt)` untuk menyertakan shift itu sendiri — cocokkan lewat id.
(Ketahuan saat uji di DB salinan; rekap sempat kosong.)

Diverifikasi terhadap data produksi (estafet Toko Pusat): tunai − pengeluaran + pelunasan
piutang tunai = persis kas harus ada hasil settlement asli.

## Struk settlement

`lib/escpos-settlement.ts` (printer termal via QZ) dan `components/pos/settlement-print.tsx`
(cadangan `window.print()`) **harus selalu sama**; angka rekap disiapkan bersama oleh
`lib/settlement-day-recap.ts` (`buildDayRecapView`). Bila ada rekap:

- judul `PENJUALAN SHIFT #n`
- bagian `REKAP HARI INI (SEMUA SHIFT)` per shift + `TOTAL HARI INI`
- `TRANSAKSI NON-TUNAI (HARI INI)` dikelompokkan per shift + total per metode hari itu
- `REKONSILIASI KAS (SHIFT #n SAJA)` — tetap hanya shift yang ditutup
- Rincian pengeluaran & pelunasan piutang tetap hanya shift itu

Data rekap dikirim di `ShiftBreakdownSummary.dayRecap` oleh settle route dan oleh
`api/bo/shifts/[id]` (cetak ulang & Detail Hari; dihitung juga untuk shift yang berjalan).

## Kotak "Shift Ditutup!" (`components/pos/settlement-client.tsx`)

Lapisan penuh layar (`fixed inset-0 z-[60]`, menutupi header & tab POS). Esc ditelan,
tombol Kembali browser dibatalkan (pushState + popstate), muat ulang/tutup tab memicu
konfirmasi browser (`beforeunload`). Pengecualian sadar: **logout otomatis 10 menit tetap
berlaku** (keamanan perangkat bersama); struk masih bisa dicetak ulang dari Back Office.
Tombol Serah Terima hanya bila `shiftNumber < 2`.

## Riwayat Shift (`app/(dashboard)/shift-history/_components/`)

- `shift-history-groups.ts` — `groupEstafetShifts` & `groupTotals` (murni, ada tes).
- Satu kelompok = **satu baris DataTable** (rincian #1/#2 dirender di dalam sel saat ▶ dibuka)
  supaya paginasi 10 baris tidak memecah satu hari ke dua halaman.
- Modal tidak dijumlah (uang modal yang sama dioper). Kas expected/real/selisih dijumlah.
- Pengelompokan dimatikan saat filter Status/Setoran aktif (anggota tersaring sebagian akan
  memberi total yang menipu).
- `shift-day-detail.tsx` — jendela **Detail Hari** (angka per shift berdampingan + total,
  cetak struk gabungan = struk shift terakhir yang sudah ditutup).

## Tes

`lib/services/shift-day-recap.test.ts`, `lib/settlement-day-recap.test.ts`,
`lib/escpos-settlement.test.ts` (blok "estafet"),
`app/(dashboard)/shift-history/_components/shift-history-groups.test.ts`.

## Batasan

- Daftar Riwayat Shift dibatasi 200 shift terbaru; hari tertua di ujung daftar bisa tampil
  sebagian.
- Penomoran `shift_number` dihitung dengan `CURRENT_DATE` DB (UTC), bukan hari WIB — rekap
  memakai `shift_id`, jadi tidak terpengaruh.
- Belum diuji di layar sebelum rilis (owner minta langsung push); pantau laporan toko.
