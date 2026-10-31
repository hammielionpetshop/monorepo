### Added
- Halaman login, ganti password awal, dan keluar untuk HRIS dengan akun pusat yang sama. Akun yang belum bertaut ke HRIS ditolak dengan pesan jelas. Belum aktif di produksi; HRIS produksi tetap nonaktif.
- Pintu provisioning internal backoffice untuk membuat akun pusat dan tautan, aman diulang (kunci idempotensi), hanya dapat dipanggil antarlayanan oleh Owner atau GM, dan diblokir dari domain publik.

### Changed
- Pada mode `central`, menambah pengguna di Pengaturan > Pengguna ikut membuat akun pusatnya. Bila gagal di tengah, pengguna tersimpan dan menyimpan ulang pengguna itu melengkapi akunnya tanpa duplikasi. Mode `legacy` tidak berubah.
