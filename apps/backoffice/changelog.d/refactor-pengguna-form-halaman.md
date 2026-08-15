### Changed
- **Tambah & edit pengguna pindah dari modal ke halaman sendiri.** Pengaturan → Pengguna kini
  membuka `/settings/users/new` dan `/settings/users/[id]`, bukan dialog di atas daftar.
  - Formnya dapat ruang penuh, jadi daftar cabang tugas tidak lagi berdesakan di kotak sempit.
  - Alamatnya bisa ditautkan, di-bookmark, dan dibuka di tab baru; tombol Kembali browser
    bekerja sebagaimana mestinya.
  - Sesudah simpan, daftar dimuat ulang dari server dan pesan hasilnya dibawa lewat query
    `?success=` — sebelumnya daftar diperbarui lewat fetch terpisah di klien.
  - "Reset kredensial ke default" sekarang tetap di halaman edit dan menampilkan konfirmasi di
    tempat, supaya OWNER bisa langsung membacakan kredensial barunya tanpa kehilangan konteks.

### Added
- **Guard izin di halaman tambah & edit pengguna.** Keduanya menuntut `user.manage`, sama dengan
  API-nya. Sebelumnya form bisa terbuka untuk orang yang pasti ditolak server saat menekan Simpan.
