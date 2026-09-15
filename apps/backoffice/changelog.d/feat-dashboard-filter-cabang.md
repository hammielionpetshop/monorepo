### Added
- **Dashboard sekarang bisa difilter per cabang.** Dropdown "Semua Cabang" di kanan atas dashboard membatasi Total Pendapatan, Jumlah Transaksi, Estimasi Laba Kotor, Total Pengeluaran, dan Status Shift ke satu cabang saja. Defaultnya tetap gabungan semua cabang seperti sebelumnya.
- **4 metrik baru di Ringkasan Hari Ini:** Rata-rata Nilai Transaksi, Kas di Tangan (kas yang seharusnya ada di laci shift yang masih OPEN), Pelunasan Piutang Tunai hari ini, dan jumlah Shift Aktif.

### Changed
- **Status Shift per Cabang dibuat lebih compact** — dari daftar baris penuh lebar jadi chip yang wrap berdampingan.

### Removed
- **Card "Status Operasional Cabang" (cabang offline) dihapus dari dashboard.** Servicenya (`getOfflineBranches`) dan API route-nya tetap ada, tidak dipakai halaman ini lagi.
