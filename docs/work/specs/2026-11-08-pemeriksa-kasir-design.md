# B1+B2 Pemeriksa kasir potong nota / Retur BO (HRIS Logistik)

Butir B1+B2 antrean [`2026-11-08-perbaikan-logistik-hris.md`](../backlog/2026-11-08-perbaikan-logistik-hris.md).
Disetujui owner 2026-11-08 lewat jawaban sesi malam (B2: nomor retur wajib ada di kasir, nilainya ditampilkan).

## Isi

1. **B2 Retur BO terhubung ke kasir.** "Sudah dicatat" untuk keputusan **Dicatat lewat Retur BO** wajib nomor retur
   penjualan yang **ada** di kasir (`petshop.returns`, dibaca lewat view baru `logistics.pos_sale_returns`), tidak
   dibatalkan, untuk pelanggan (toko) laporan itu, dan belum dipakai keputusan lain. Salah ketik ditolak dengan pesan.
   Sesudahnya kartu keputusan (Laporan Toko, Perlu dicatat di kasir) menampilkan nomor retur + **nilai retur** dari kasir;
   bila retur itu kemudian dibatalkan di kasir tampil ⚠️ "Retur dibatalkan di kasir".
2. Keputusan Retur BO yang belum dicatat lebih dari 3 hari bertanda merah **"Retur belum dibuat di BO"** (batas yang
   sama dengan Perlu dicatat di kasir).
3. **B1 Potong nota terlihat di kasir.** Untuk potong nota (termasuk Harga beda) yang sudah dicatat: ✅ **Terlihat di
   kasir** bila nominal nota kasir sekarang ≤ nominal saat masuk trip (antar sendiri: saat dibawa) − jumlah potongan
   yang sudah dicatat di nota itu; selain itu ⚠️ **Belum terlihat di kasir** (dengan nominal kasir sekarang). Dibaca
   langsung dari view kasir yang dipakai pemeriksa `logistics-kasir-check`; tidak ada tabel baru.

## Data

Migrasi `logistics` 0019: view `logistics.pos_sale_returns` (nomor retur, nota, pelanggan, nilai retur, potongan piutang,
dibatalkan). Tanpa migrasi `hris`.
