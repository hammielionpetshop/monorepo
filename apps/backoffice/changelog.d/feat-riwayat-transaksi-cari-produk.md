### Added

- Riwayat Transaksi bisa dicari berdasarkan nama produk. Mengetik "bolt" menampilkan semua nota yang memuat produk itu, cocok sebagian (tidak perlu nama lengkap) dan tidak peduli huruf besar/kecil. Pencariannya digabung dengan filter lain yang sedang aktif — periode, cabang, status, metode bayar — bukan menggantikannya.
- Endpoint `GET /api/bo/transactions` menerima parameter `productQ` untuk keperluan yang sama.

Nama dicocokkan ke snapshot nama produk pada item nota sekaligus ke master produk, jadi nota tetap ketemu walau produknya sudah dihapus atau berganti nama. Item yang dibuang lewat koreksi nota tidak ikut dicocokkan.
