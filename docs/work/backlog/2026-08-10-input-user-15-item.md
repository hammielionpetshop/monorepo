<!-- markdownlint-disable MD013 -->

# Triase Input User — 2026-08-10

Daftar masukan user, dicocokkan dengan keadaan kode, **sesudah klarifikasi putaran pertama**.
Kolom **Migrasi** menentukan penjadwalan: hanya satu branch boleh menambah migrasi DB pada satu
waktu (kunci migrasi di `docs/agents/claims.md`).

## Ditutup

| # | Item | Alasan |
|---|---|---|
| 1 | Ubah PIN void | Owner/admin tinggal ubah PIN sendiri — halaman ganti PIN sudah ada (`9ab71f3`) |
| 5 | Bulk sale PO | Sudah |
| 8 | Pelunasan piutang tidak masuk omset | Sudah, v1.92.0 |
| 10 | Riwayat pelunasan piutang | Sudah, `reports/debt-payments` |
| 13 | Edit nota piutang | Tercakup pembatalan pembayaran hutang (`ec492db`) |
| 14 | Edit harga produk tidak permanen | Ditunda atas permintaan user — lihat catatan di bawah |
| 9 | Kasir tidak lihat selisih kas | Selesai, `5eb4ad3` |
| 3 | List hutang internal: No Transfer → tanggal | Selesai, `5223e6a` (satu paket dengan #11) |
| 11 | Filter cabang di piutang antar cabang | Selesai, `5223e6a` |
| 15 | Laporan per produk: satuan & harga per satuan | Selesai, `e00af49` |

## Aktif

| # | Item | Domain | Migrasi | Ukuran | Status |
|---|---|---|---|---|---|
| 4 | List transfer internal: **tambah** kolom nominal | PO internal | tidak | S | dikerjakan |
| 12 | Harga reseller otomatis | POS + harga | tidak | M | siap, keputusan sudah lengkap |
| 6 | Ajukan void / koreksi dari POS | Transaksi + Audit | **ya** | L | — |
| 7 | 1 akun 1 device + notif | Pengguna & akses | **ya** | L | — |
| 16 | Staf bertugas di banyak cabang | Pengguna & akses | **ya** | L | — |
| 2 | Pemasukan stok dari supplier luar | PO | ? | **?** | **ditahan** — belum jelas apa yang gagal |

---

## Catatan per item

### 2. Pemasukan stok dari supplier luar — pertanyaannya berubah

Dugaan user "CRUD supplier belum ada" tidak terbukti. Yang sudah ada:

- Halaman & API supplier lengkap: `app/(dashboard)/master-data/suppliers`,
  `app/api/bo/master-data/suppliers/route.ts` + `[id]/route.ts`
- PO sudah punya dua tipe: `po_type` default `EXTERNAL` dengan `supplier_id`, dan `INTERNAL`
  dengan `source_branch_id` (`schema/purchase_orders.ts:11-14`)

Jadi jalur PO eksternal → supplier → penerimaan barang secara struktur sudah lengkap.
**Perlu tahu apa yang sebenarnya gagal:** tombolnya tidak ada di layar tertentu, rolenya tidak
boleh, atau penerimaannya yang bermasalah. Belum bisa diukur sebelum itu jelas.

**Ditahan atas permintaan user (2026-08-11)** sampai jelas apa yang sebenarnya gagal. Tidak
dijadwalkan, tidak diklaim.

### 3 & 4. Kolom di list internal

Keduanya di area yang sama (`app/(dashboard)/purchase-orders/internal` dan
`internal/payables`), jadi **satu branch saja**, bukan dua yang paralel.

- #3 list hutang internal: No Transfer **diganti** tanggal
- #4 list transfer internal: nominal **ditambahkan** (No Transfer tetap)

### 6. Ajukan void / koreksi dari POS

Keadaan sekarang:

- Edit nota: hanya **PIN inline** (`app/api/pos/transactions/[id]/edit/route.ts:69-113`,
  izin `transaction.edit`)
- Void: sudah punya `void_requests` (PENDING/APPROVED/REJECTED) **dan** PIN inline
- Web POS belum punya tombol "ajukan" untuk keduanya

Keputusan user: sediakan **dua pilihan** di POS — input PIN (langsung) atau ajukan persetujuan.
Yang diajukan masuk ke satu daftar, dan menunya diganti dari "Persetujuan Void" jadi
**"Permintaan Persetujuan"**.

Konsekuensi teknis: `void_requests` harus menampung dua jenis permintaan (VOID dan KOREKSI).
Butuh migrasi — kolom jenis + muatan data koreksi.

### 7 & 16. Sesi dan cabang

Tidak ada tabel sesi/device sama sekali; auth memakai JWT stateless di cookie, jadi tidak ada
yang bisa dicabut. Berlaku di POS **dan** backoffice; user sendiri yang berhak merebut sesinya.

Di tengah pembahasan ini muncul kebutuhan terpisah: **staf bisa bertugas di lebih dari satu
cabang** (hari ini cabang A, besok cabang B). Sekarang `users.branch_id` tunggal dan JWT
membawa satu `branchId` yang dipakai untuk seluruh pembatasan data. Ini bukan bagian dari
"1 akun 1 device" — ia menyentuh RBAC, `branchScope`, dan hampir setiap query yang menyaring
per cabang. Dicatat sebagai item sendiri (#16) supaya tidak menyelinap masuk ke #7.

### 9. Kasir tidak lihat selisih kas — lebih kecil dari dugaan

Yang bocor sekarang di `components/pos/settlement-client.tsx`, **sebelum** kasir submit:

| Baris | Isi |
|---|---|
| 62, 65 | `expectedCash` dan `variance` dihitung langsung di layar |
| 357, 426 | label "Expected: Rp …" |
| 450 | peringatan "Terdapat selisih kurang pada kas" |
| 253, 258 | rincian per sesi kasir: `expectedCash`, total cash/non-cash |

Kabar baiknya: **penguncian sudah ada.** `app/api/pos/shifts/[id]/settle/route.ts:37` menolak
shift yang statusnya bukan `OPEN` dan menutupnya jadi `CLOSED` — settlement sekali jalan, tidak
bisa diulang atau ditawar.

Jadi pekerjaannya tinggal menyembunyikan kelima titik itu sebelum submit, lalu menampilkan &
mencetak seperti sekarang setelah shift tertutup. Tidak perlu mekanisme kunci baru. Ukurannya
turun dari M ke S.

### 11. Filter cabang piutang antar cabang

`app/api/bo/inter-branch-payables/route.ts:15` bertanda tangan `GET(_req: NextRequest)` —
request-nya tidak dipakai sama sekali, jadi memang belum ada parameter apa pun, termasuk cabang.

### 12. Harga reseller otomatis

Kedua bahannya sudah ada, tinggal disambungkan:

- Tier harga: `RETAIL, GROSIR, MEMBER, RESELLER, DISTRIBUTOR, PROMO`
  (`components/pos/price-tier.ts`, konstanta `TIER_PRIORITY`)
- Customer punya `default_tier_type`, default `RETAIL` (`schema/master.ts:45`)

Tapi seluruh `app/pos/**` **tidak menyentuh `tierType` sama sekali** — jadi memang belum ada
yang memilih harga berdasarkan tier customer. Sekarang POS memakai `pickDisplayPrice()` yang
mengurut tier menurut prioritas tetap, bukan menurut siapa pelanggannya.

**Diputuskan user (2026-08-11): jatuh ke harga RETAIL.** Customer bertier RESELLER yang produknya
tidak punya harga RESELLER tetap bisa dijual, memakai harga RETAIL — produknya tidak ditolak.

Yang perlu diperhatikan saat mengerjakannya: fallback ini menyamarkan harga tier yang belum diisi.
Kasir tidak akan pernah tahu bedanya antara "produk ini memang harga RETAIL untuk reseller" dan
"harga RESELLER-nya lupa diisi", karena dua-duanya keluar sebagai angka yang sama. Tandai di layar
tier mana yang sedang dipakai, supaya harga yang belum diisi masih bisa ketahuan.

### 14. Edit harga produk tidak permanen — ditunda

Ditunda atas permintaan user karena "beberapa produk aman-aman saja".

**Catatan untuk nanti:** justru itu yang membuatnya layak dikejar. Bug yang menimpa sebagian
produk saja berarti ada kondisi pemicu yang belum diketahui — bukan berarti dampaknya kecil.
Repo ini sudah dua kali kena pola serupa bulan ini (LOQY KLG TUNA v1.94.1, Jagung TT v1.94.2),
dan dua-duanya baru ketahuan setelah angkanya salah di laporan.

### 15. Laporan per produk: satuan & harga per satuan

`(dashboard)/reports/sales-by-product` sudah ada; yang diminta menambah kolom satuan dan harga
jual per 1 satuan.

**Hati-hati dengan aturan UOM repo ini:** `base_uom_id` selalu satuan **terkecil**, dan ratio
dibaca `1 uom = ratio × base`. Salah arah di sini bukan kesalahan kosmetik — pola yang sama
pernah menghasilkan HPP 24× lipat dan laba produk −33,8 juta (LOQY KLG TUNA, v1.94.1).

Perlu diputuskan: satu produk bisa terjual dalam beberapa satuan pada rentang yang sama
(mis. PCS dan DUS). Barisnya dipecah per satuan, atau disatukan dan dinormalkan ke base?

---

## Urutan yang disarankan

1. ~~**Empat menang cepat, bisa paralel** — #9, (#3+#11 satu paket), #4, dan #15.~~
   Tiga sudah mendarat di `main`; **#4** tinggal diselesaikan.
2. **#12** harga reseller otomatis — berikutnya. Tanpa migrasi, dan pertanyaan tier-nya
   sudah dijawab (jatuh ke RETAIL), jadi bisa langsung dikerjakan.
3. **#6, #7, #16** terakhir. Ketiganya butuh migrasi → **harus bergantian** memegang kunci
   migrasi, dan ketiganya menyentuh otorisasi. #16 sebaiknya sebelum #7, karena kalau cabang
   staf jadi jamak, isi sesi yang disimpan #7 ikut berubah.
4. **#2** ditahan, tidak dijadwalkan sampai jelas apa yang sebenarnya gagal.
