### Fixed

- POS PWA: saat akun dipakai login di perangkat lain, perangkat lama tidak lagi terlempar ke `http://0.0.0.0:3000` lalu blank. Route `/api/auth/session-ended` sekarang memakai header `Location` relatif, jadi browser tetap di domain yang benar dan mendarat di halaman login dengan pesan "Akun Anda dipakai di perangkat lain". Sisi backoffice ikut sembuh karena memakai route yang sama.
