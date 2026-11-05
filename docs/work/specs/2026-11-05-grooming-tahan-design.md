<!-- markdownlint-disable MD013 -->

# Grooming Ditahan — karcis dulu, nota menyusul

**Status:** rancangan, menunggu persetujuan owner (arah disetujui owner 2026-11-05: "ok sudah sesuai").
**Domain:** Jasa & grooming (tab Grooming kasir) + POS & transaksi (pembuatan nota).
**Migrasi:** petshop `0053` (tabel baru; tidak mengubah tabel lama).

## 1. Masalah

Di tab Grooming, menerima kucing **selalu langsung membuat nota** (Lunas sekarang / Tambah
belanja / Bayar saat ambil = nota piutang). Owner butuh kucing bisa diterima dan **karcisnya
dicetak lebih dulu**, sedangkan notanya dibuat kemudian — "ditahan seperti F8".

## 2. Keputusan owner (2026-11-05)

1. Ada tombol **Tahan** di Terima Kucing. Grooming yang ditahan **belum punya nota**.
2. **Karcis paling penting, dicetak lebih dulu**: begitu ditahan, karcis 2 lembar (konsumen +
   groomer) langsung tercetak dan bisa dicetak ulang kapan saja.
3. Statusnya langsung **Sedang Dikerjakan**, bertanda **BELUM ADA NOTA**.
4. Nota dibuat menyusul dengan pilihan yang sama seperti sekarang (Lunas / Tambah belanja / Bayar
   saat ambil).

## 3. Keputusan teknis (diusulkan, dilaporkan ke owner)

- **Tidak memakai daftar Tahan F8 (`open_bills`).** Daftar itu menghapus tahanan begitu dibuka
  ke keranjang; bila keranjang lalu dikosongkan, catatan kucing yang sudah berkarcis hilang tanpa
  jejak. Grooming ditahan disimpan di **tabel tersendiri** `grooming_holds` yang tidak pernah
  dihapus. Bagi kasir perilakunya tetap seperti "Tahan".
- **`grooming_orders` tidak diubah.** Baris `grooming_orders` tetap hanya lahir bersama nota.
  Akibatnya Laporan Riwayat Grooming & Bonus, Laporan Piutang, dan Buku Bonus HRIS
  (`hris.pos_grooming_services`) **tidak tersentuh** — grooming ditahan belum dihitung di sana.
- Larangan lama tetap: nota berisi grooming **tetap tidak bisa** ditahan lewat F8 di tab Kasir
  (server `api/pos/open-bills` tetap menolak). Jalur tahan grooming hanya dari tab Grooming.

## 4. Alur

### 4.1 Tahan (tab Grooming › Terima Kucing)

- Tombol keempat **"Tahan — karcis dulu, nota menyusul"** di samping tiga tombol lama.
- Isian wajib **sama dengan sekarang**: pemilik, minimal satu kucing, jasa, groomer, kondisi.
  Antar-jemput (pengantar, alamat, ongkir / gratis) dan diskon per kucing **boleh** diisi dan
  ikut tersimpan.
- **Tidak perlu shift terbuka** (tidak ada uang). Pesan gerbang shift di Terima Kucing diubah:
  tanpa shift, hanya tombol Tahan yang aktif; tiga tombol lain tetap butuh shift.
- Server menyimpan satu baris `grooming_holds` (status `DITAHAN`), lalu karcis langsung dicetak.
- **Nomor karcis: `TAHAN-<id>/<urutan kucing>`**, mis. `TAHAN-57/1`, `TAHAN-57/2`.

### 4.2 Sedang Dikerjakan

- Tahanan tampil di daftar yang sama, bertanda kuning **BELUM ADA NOTA**, ikut dicari dengan
  nama pemilik / kucing / HP / nomor karcis TAHAN. Angka di tab ikut menghitungnya.
- Tombol per tahanan:
  - **Cetak Karcis** — cetakan kedua dan seterusnya bertanda CETAK ULANG (sama seperti sekarang).
  - **Buat Nota** — butuh shift terbuka. Membuka layar bayar dari isi tahanan: Lunas / Bayar saat
    ambil (piutang), atau **Tambah belanja** (pindah ke keranjang tab Kasir).
  - **Buat Nota & Ambil** — sama dengan Buat Nota, lalu kucing langsung ditandai diambil.
  - **Batalkan** — alasan wajib (konsumen batal, salah input, …). Tercatat siapa & kapan.
- Tombol **Diambil** tidak ada untuk tahanan: **kucing tidak bisa diserahkan sebelum notanya
  dibuat**.

### 4.3 Buat Nota

- Harga dihitung **saat nota dibuat** dari harga jasa & golongan pelanggan hari itu (bukan harga
  saat ditahan). Diskon per kucing yang tersimpan dihitung ulang dengan aturan diskon yang sama;
  bila tidak sah lagi, kasir diberi tahu dan diminta mengulang.
- Baris nota membawa `groomingHoldId`. Server, **di dalam transaksi DB nota yang sama**: mengunci
  tahanan, memastikan statusnya masih `DITAHAN`, membuat nota + `grooming_orders` seperti biasa,
  lalu mengubah tahanan menjadi `DIBUATKAN_NOTA` dengan `transaction_id`. Dua kasir yang menekan
  Buat Nota bersamaan → yang kedua ditolak ("Tahanan ini sudah dibuatkan nota").
- Isi kucing / jasa / groomer **tidak bisa diubah** di Buat Nota (sama dengan karcis yang sudah
  tercetak). Salah input → Batalkan tahanan, lalu terima ulang (karcis baru).
- **Karcis tidak perlu dicetak ulang** sesudah nota dibuat. Grooming yang lahir dari tahanan
  menampilkan nomor karcis TAHAN-nya di Sedang Dikerjakan / Sudah Selesai (dibaca lewat
  `grooming_holds.transaction_id`), jadi karcis TAHAN tetap bisa dicocokkan saat kucing diambil.
- Lewat **Tambah belanja**: keranjang tab Kasir membawa `groomingHoldId`; tahanan **tetap
  `DITAHAN`** sampai nota benar-benar tersimpan. Keranjang dikosongkan / ditinggal → tahanan
  aman, masih di Sedang Dikerjakan.

### 4.4 Batalkan

- Status `DIBATALKAN` + alasan + pembatal + waktu. Tidak ada uang/stok yang perlu dibalik.
- Tampil di **Sudah Selesai** bertanda **DIBATALKAN — TANPA NOTA** beserta alasannya.

## 5. Data

Migrasi petshop `0053_grooming_holds` (tabel baru saja):

```text
grooming_holds
  id               serial PK
  branch_id        → branches, wajib
  customer_id      → customers, wajib (pemilik)
  lines            jsonb, wajib  — [{ petId, productId, groomerId, condition, discount? }]
  delivery         jsonb, null   — { courierId, address, qty, free } bila antar-jemput
  status           varchar(20)   — DITAHAN | DIBUATKAN_NOTA | DIBATALKAN (default DITAHAN)
  ticket_print_count integer default 0
  transaction_id   → transactions, null (terisi saat nota dibuat; unik bila terisi)
  held_by_id       → users        held_at timestamp default now()
  cancelled_by_id  → users        cancelled_at timestamp   cancel_reason text
  index (branch_id, status, held_at)
```

Saat menyimpan tahanan, server memeriksa hal yang sama dengan nota grooming (kucing milik
pemilik & aktif, groomer aktif & berperan groomer, jasa berjenis grooming, kondisi terisi,
pengantar sah) — memakai pemeriksaan yang sudah ada di `grooming-order-service`.

## 6. API (POS, izin `grooming.order.manage` yang sudah ada)

| Rute | Guna |
|---|---|
| `POST /api/pos/grooming/holds` | Simpan tahanan (tanpa shift) |
| `GET /api/pos/grooming/orders?view=aktif` | Ikut mengembalikan tahanan `DITAHAN` (bertanda) |
| `GET /api/pos/grooming/orders?view=selesai` | Ikut mengembalikan tahanan `DIBATALKAN` |
| `POST /api/pos/grooming/holds/[id]/ticket-printed` | Catat cetakan karcis tahanan |
| `POST /api/pos/grooming/holds/[id]/cancel` | Batalkan dengan alasan |
| `POST /api/pos/transactions` | Baris boleh membawa `groomingHoldId` (lihat 4.3) |

## 7. Di luar lingkup

- Pesan dulu / booking (kucing belum datang) — tidak diminta.
- Mengubah isi tahanan, Ganti Groomer pada tahanan (Ganti Groomer Back Office tetap untuk
  grooming bernota).
- Tahanan di Laporan Riwayat Grooming Back Office (belum ada uang/bonus).
- Batas umur tahanan / pengingat tahanan lama.

## 8. Pemeriksaan

- Tes DB terarah: simpan tahanan sah/tidak sah; Buat Nota mengubah status + membuat
  `grooming_orders`; Buat Nota ganda ditolak; tahanan batal tidak bisa dibuatkan nota; nota
  dibatalkan sesudahnya tidak menghidupkan tahanan.
- `pnpm typecheck`, `pnpm migrations:check`, `pnpm changelog:check`.
- Uji layar oleh owner di staging: Tahan → karcis keluar → tampil BELUM ADA NOTA → cetak ulang →
  Buat Nota (Lunas, Piutang, Tambah belanja) → Buat Nota & Ambil → Batalkan.
