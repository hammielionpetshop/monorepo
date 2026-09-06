### Added

- Kotak "Customer" di Riwayat Transaksi kini juga menerima ketikan bebas: mengetik "pusat" lalu Terapkan Filter menampilkan semua nota milik customer yang namanya memuat kata itu, cocok sebagian dan tidak peduli huruf besar/kecil. Memilih satu customer dari daftar saran tetap menyaring persis customer itu seperti sebelumnya.
- Endpoint `GET /api/bo/transactions` menerima parameter `customerQ` untuk keperluan yang sama.

### Changed

- Enter di kotak Customer langsung menerapkan filter kalau daftar saran sedang tidak terbuka, jadi tidak perlu memilih dari daftar dulu.

Pencarian customer digabung (AND) dengan filter lain yang sedang aktif — periode, nama produk, cabang, status, metode bayar — jadi hasilnya tetap mengikuti periode dan bisa dipakai bersamaan dengan pencarian produk. Nota tanpa customer (penjualan umum) tidak pernah cocok karena tidak punya nama untuk dicocokkan.
