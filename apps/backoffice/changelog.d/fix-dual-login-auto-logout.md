### Changed

- Satu akun satu perangkat kini juga berlaku untuk GM: login GM di perangkat baru otomatis mengakhiri sesinya di perangkat lain. Hanya OWNER yang masih boleh aktif di beberapa perangkat sekaligus.
- Keluar otomatis saat tidak ada aktivitas: tampilan Web POS setelah 10 menit (semua role, sebelumnya hanya kasir 5 menit), backoffice setelah 30 menit. Peringatan dengan hitung mundur muncul 1 menit sebelumnya, dengan tombol "Tetap masuk".
- Waktu aktivitas terakhir disimpan di browser, jadi PC yang tidur atau browser yang ditutup lalu dibuka lagi setelah lewat batas langsung diminta masuk ulang. Aktivitas di satu tab menjaga tab lain tetap aktif.
- Halaman login menampilkan keterangan "Anda keluar otomatis" setelah logout karena tidak ada aktivitas.

### Removed

- Variabel lingkungan `KASIR_IDLE_TIMEOUT_MINUTES` tidak dipakai lagi; batas waktu kini tetap 10 menit (POS) dan 30 menit (backoffice).
