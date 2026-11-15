# A2 Tugas Jemput Retur (HRIS Logistik)

Butir A2 antrean [`2026-11-08-perbaikan-logistik-hris.md`](../backlog/2026-11-08-perbaikan-logistik-hris.md).
Disetujui owner 2026-11-08 lewat jawaban sesi malam (lihat bagian **Sesi malam** backlog itu). Pengganti
rencana "Tugas Retur" LOG-58/126 v3, dengan keputusan C spec LT1 (nilai retur lewat Retur BO) tetap berlaku.

## Keputusan owner

- Pembuat tugas: Kepala Gudang, Marketing, Finance, Pemilik/GM (hak baru `logistics.return_pickup.manage`).
- Nilai retur **tidak** di HRIS; barang yang dijemput diputuskan Finance di Laporan Toko sebagai **Dicatat
  lewat Retur BO** (atau Tidak dipotong), lalu masuk "Perlu dicatat di kasir" seperti retur biasa.
- Trip boleh mampir ke toko **hanya** untuk jemput retur (tanpa surat jalan). Retur langsung tanpa tugas
  (Lapor masalah › Retur sesudah Terkirim) tetap ada.

## Alur

| Status | Masuk lewat | Oleh |
|---|---|---|
| **Menunggu** | Buat tugas: toko (pelanggan kasir yang terdaftar sebagai toko), alasan (5–300 huruf), perkiraan barang (boleh kosong, ≤ 300), pemilik barang (cabang kasir; bawaan Gudang). Satu tugas terbuka per toko | pemegang `logistics.return_pickup.manage` |
| **Di trip** | Dicentang di form Buat/Ubah trip Draft, atau **Masukkan ke trip** (Draft / Berjalan belum Menuju Garasi) dari halaman Jemput Retur | pemegang `logistics.trip.manage` |
| **Diambil** | Driver/kenek di Trip Saya: foto (kamera langsung) + rincian barang 1–20 baris (nama, jumlah, satuan, sama dengan rincian retur LT2a) + catatan; membuat laporan **Retur (dibawa pulang)** sehingga otomatis masuk **Barang Kembali** dan **Laporan Toko** | awak trip itu, selama Berjalan dan belum Menuju Garasi |
| **Tidak ada barang** | Foto + alasan (toko batal, barang sudah dibuang). Akhir; pembuat tugas diberi tahu | awak trip itu |
| kembali **Menunggu** | **Kirim Besok** (toko tutup / orangnya tidak ada): foto + alasan, tanda "dicoba ×n". Juga otomatis bila trip Selesai lebih awal / ditutup kantor sebelum tugas dikerjakan ("terlewat"), trip Draft dibatalkan, atau **Lepas** dari trip oleh kantor | awak / kantor / server |
| **Dibatalkan** | Hanya saat Menunggu, alasan wajib | pembuat tugas atau pemegang `logistics.trip.manage` |

- Menuju Garasi biasa ditolak selama masih ada tugas jemput Di trip yang belum dikerjakan (sama dengan
  kunjungan); Selesai lebih awal mengembalikannya ke Menunggu.
- Merah bila Menunggu lebih dari `logistics.pending_red_days` (3) hari sejak dibuat.
- Pemberitahuan: tugas baru → pemegang `logistics.trip.manage`; Tidak ada barang → pembuat tugas.
- Rincian trip (kantor) dan Trip Saya menampilkan bagian **Jemput retur** terpisah dari kunjungan.
- Riwayat tiap langkah (dibuat, masuk trip, dilepas, kirim besok, terlewat, diambil, tidak ada barang,
  dibatalkan) disimpan; tidak ada yang dihapus.

## Data

Migrasi `logistics` 0017: tabel `return_pickups` (keadaan sekarang; unik terbuka per toko) dan
`return_pickup_events` (riwayat + foto per langkah), kolom `visit_reports.return_pickup_id` (laporan retur
dari tugas jemput: `trip_id` + `customer_id` tanpa `visit_id`), dan `report_decisions` membolehkan Retur BO
tanpa nota (hanya laporan jemput; laporan lain tetap wajib nota lewat pintu server). Migrasi `hris` 0055:
hak `logistics.return_pickup.manage` untuk Kepala Gudang, Marketing, Finance.

## Di luar

Nilai rupiah per barang (LOG-60), awak mengusulkan "toko mau retur" (LOG-126), retur antar sendiri lewat tugas.
