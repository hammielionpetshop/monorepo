### Added

- HRIS: layar **Pengaturan** (Pengaturan › Pengaturan) — angka aturan HRIS bertanggal berlaku. Tiap baris menampilkan nilai sekarang, berlaku sejak, dan nilai berikutnya; ubah lewat langkah baku (nilai baru → tanggal berlaku + alasan → periksa), lihat riwayat, dan batalkan nilai yang belum berlaku. Pengaturan yang menyangkut hitungan paling cepat berlaku besok; tidak ada yang berlaku mundur. Hanya Pemilik/GM yang mengubah, langsung berlaku.
- HRIS: layar **Pengaturan Jabatan** — tabel jabatan × tanda, berisi "Saran role kasir" dan "Tugas lapangan otomatis", bertanggal berlaku dengan riwayat per sel. HR dapat melihat; usulan HR menyusul bersama kotak Persetujuan.
- HRIS: kartu Akses kasir mengisi role dari saran jabatan orang itu (tetap bisa diganti), dan kartu Izin tugas lapangan menandai "Otomatis (jabatan …)" bila jabatannya bertanda tugas lapangan.

### Changed

- HRIS: angka yang sebelumnya tertulis di kode kini dibaca dari pengaturan: panjang alasan paling sedikit (awal 15 huruf, sebelumnya 3), jeda tombol konfirmasi (3 detik), dan masa training sebelum dinilai (3 bulan; perubahan tidak menggeser orang yang sudah genap sebelum tanggal berlakunya).
- HRIS: jejak perubahan bisa mencatat pelaku mesin terjadwal; nilai pengaturan dan jejak tidak bisa diubah atau dihapus siapa pun (migrasi hris `0003`).
