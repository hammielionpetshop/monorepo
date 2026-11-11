# Batalkan Pembayaran Utang Internal

Tanggal: 2026-11-11 · Status: **draf, menunggu persetujuan owner** · Dasar: Utang Internal
(`/purchase-orders/internal/payables`), [F2-3 Pelunasan Otomatis](2026-11-08-f2-3-pelunasan-otomatis-design.md),
[F2-3b Utang Lama](2026-11-08-f2-3b-utang-lama-design.md), [F2-4 Bayar Supplier & Arus Kas](2026-11-09-f2-4-supplier-arus-kas-design.md)

| Bagian | Branch (dasar) | Migrasi | Isi |
|---|---|---|---|
| Back Office | `feat/ibp-payment-cancel` (`origin/main`) | petshop berikutnya (perkiraan `0063`, dipastikan saat klaim) | Tombol Batalkan pada pembayaran manual di Riwayat Utang Internal |

HRIS tidak disentuh.

## 1. Keadaan sekarang (diperiksa di kode `origin/main` 2026-11-11)

- Utang Internal hanya punya aksi **Bayar** (`POST /api/bo/inter-branch-payables/[id]/pay`, hak
  `payable.pay`) dan **Hapus Hutang** (`PATCH .../[id]/waive`, hak `payable.waive`). Riwayat hanya
  menampilkan pembayaran; **tidak ada cara membatalkan pembayaran** yang salah input.
- Bayar manual (satu transaksi DB): `paid_amount` bertambah, status `PARTIAL`/`PAID`; satu baris
  `inter_branch_payments` (`source_type` kosong); dua catatan Arus Kas sistem — Keluar "Bayar Hutang
  Internal" di cabang penerima barang (debitur) dan Masuk "Terima Piutang Internal" di cabang pengirim
  (kreditur), `occurred_on`/`for_month` = tanggal bayar. Tidak menyentuh Tempat Uang
  (`money_place_id` kosong, tanpa `money_movements`).
- Pembayaran sebelum migrasi 0030 tidak punya metode bayar dan tidak punya catatan kas.
- Baris otomatis yang sudah punya jalur batal sendiri: `RETUR_INTERNAL`/`BATAL_RETUR`,
  `SALDO_INTERNAL`, `SETORAN`/`BATAL_SETORAN`, `SUSULAN`/`BATAL_SUSULAN`.
- F2-4: catatan Arus Kas tidak bisa diubah/dihapus (trigger `cash_flow_entries_guard`); yang salah
  ditandai **Batal** (`cancelled_at`, `cancelled_by`, `cancel_reason`). Catatan otomatis dari bayar
  utang internal tidak bisa dibatalkan dari Arus Kas.
- Belum ada fitur tutup periode di Back Office.

## 2. Keputusan owner (2026-11-11)

1. Yang boleh membatalkan: **Owner dan GM**.
2. **Tanpa batas waktu.** Kesalahan yang baru ketahuan kemudian tetap bisa dibatalkan.
3. Pembayaran lama tanpa metode bayar **boleh** dibatalkan.
4. Tempat Uang: tidak tersentuh (bayar manual memang tidak memakai Tempat Uang). Saldo Internal:
   **ikuti usul agent** — saldo yang masih ada langsung memotong utang yang terbuka lagi (§3 aturan 7).

## 3. Aturan

1. Tombol **Batalkan** hanya pada baris pembayaran **manual** (`source_type` kosong) yang belum
   pernah dibatalkan, di modal Riwayat Utang Internal. Hak baru **`payable.payment_cancel`**
   (Owner, GM), tidak dibatasi cabang.
2. **Alasan wajib** (minimal 5 huruf, maks 500). Konfirmasi menampilkan nominal, tanggal bayar,
   metode, dan akibatnya.
3. Ditolak bila utangnya **Dihapus** (`WAIVED`) — penghapusan tidak bisa dibalik, jadi angka yang
   dihapuskan tidak boleh bergeser.
4. Hasil (satu transaksi DB, baris utang dikunci `FOR UPDATE`):
   - baris baru `inter_branch_payments` jenis **`BATAL_BAYAR`**, nominal **negatif**, `paid_at` =
     waktu pembatalan, `reversal_of_payment_id` = pembayaran asal, catatan = alasan;
   - `paid_amount` dikurangi; status `UNPAID` bila jadi 0, selain itu `PARTIAL`;
   - dua catatan Arus Kas pembayaran itu ditandai **Batal** (pola F2-4) dengan alasan yang sama
     — lihat §4;
   - audit `IBP_PAYMENT_CANCELLED` (pembayaran asal, nominal, alasan, status lama/baru).
5. Pembayaran lama tanpa metode bayar: langkah yang sama tanpa catatan Arus Kas (memang tidak ada).
6. Riwayat menampilkan baris asal bertanda **Dibatalkan** (oleh, kapan, alasan) dan baris
   **BATAL BAYAR** bernilai minus.
7. **Saldo Internal:** setelah utang terbuka lagi, panggil `applyInternalCredit` untuk pasangan
   cabang itu di transaksi yang sama — saldo yang masih tersisa langsung memotong tagihan tertua
   (aturan Saldo Internal yang sudah ada: tidak dibiarkan mengendap).
8. **Pelunasan Otomatis:** utang sejak tanggal mulai F2-3 yang terbuka lagi ikut dilunasi Setoran
   berikutnya (paling lama dulu). Tidak ada pelunasan mundur dari setoran yang sudah diverifikasi.
9. **Utang Lama (F2-3b):** pratinjau mengabaikan pembayaran manual yang sudah dibatalkan. Bila
   pembayaran itu sudah dihitung oleh **pelunasan susulan yang masih berlaku**, pembatalan ditolak
   dengan pesan "batalkan pelunasan susulan dulu" — supaya uang setoran tidak terhitung salah.
10. Uang: integer rupiah, penjumlahan `big.js`.

## 4. Catatan Arus Kas: tandai Batal, bukan baris pembalik

Pada analisis 2026-11-11 agent mengusulkan catatan pembalik bertanggal hari pembatalan. Setelah
memeriksa F2-4 (rilis 1.107.122), Arus Kas sudah punya cara batal sendiri: catatan ditandai
**Batal** dan tidak dihitung lagi, juga tanpa batas waktu untuk Owner/GM. Usul agent: **ikuti pola
itu** supaya semua pembatalan di Arus Kas sama.

Akibatnya: laporan Arus Kas bulan pembayaran asal ikut berubah (sama seperti pembatalan catatan
Arus Kas lain hari ini). Riwayat Utang Internal tetap bertanggal hari pembatalan, jadi jejaknya
jelas. Saat fitur tutup periode dibuat, aturan koreksi periode tertutup berlaku sama untuk semua
pembatalan Arus Kas, termasuk ini.

⚠️ Perlu konfirmasi owner: **tandai Batal (usul)** atau **catatan pembalik bertanggal hari ini**
(laporan bulan lalu tidak berubah, tetapi berbeda dari cara batal Arus Kas lainnya).

## 5. Data

Migrasi petshop (satu berkas):
- `inter_branch_payments.reversal_of_payment_id integer UNIQUE REFERENCES inter_branch_payments(id)`
  — penjaga satu kali batal.
- Hak `payable.payment_cancel` untuk `OWNER`, `GM`.
- Trigger `cash_flow_entries_guard` sudah mengizinkan pengisian kolom pembatalan; tidak diubah.

Catatan kas pembayaran asal dicari lewat nomor IBT + nominal + cabang + `occurred_on` di kategori
sistem; bila tidak ketemu tepat sepasang (data lama), pembatalan ditolak dengan pesan jelas. Bila
rencana kerja menemukan cara yang lebih pasti (mis. menyimpan id pembayaran pada catatan kas untuk
pembayaran baru), itu dipakai.

## 6. Tampilan

- Riwayat Utang Internal: kolom aksi **Batalkan** (hanya pemegang hak, hanya baris manual aktif).
- Modal konfirmasi: rincian pembayaran, alasan, daftar akibat (sisa utang naik, catatan Arus Kas
  kedua cabang ditandai Batal, Saldo Internal bisa langsung memotong).
- Label sumber baru `BATAL_BAYAR` → "BATAL BAYAR".
- Arus Kas: catatan otomatis yang dibatalkan tampil bertanda Batal seperti catatan lain.
- `NewBadge` pada tombol Batalkan; fragment changelog backoffice.

## 7. Uji

Non-UI (tes terarah service): status/sisa sesudah batal (PAID → PARTIAL/UNPAID), tolak batal kedua
kali, tolak baris otomatis, tolak `WAIVED`, pembayaran tanpa metode, Saldo Internal langsung
memotong, catatan kas kedua cabang bertanda Batal.

Uji owner di staging:
1. Bayar manual sebagian → Batalkan → sisa kembali, Riwayat menampilkan BATAL BAYAR, Arus Kas kedua
   cabang bertanda Batal.
2. Bayar sampai lunas → Batalkan → status kembali Sebagian/Belum Dibayar.
3. Coba sebagai Manager/Finance → tombol tidak ada.
4. Baris SETORAN/RETUR → tidak ada tombol Batalkan.
