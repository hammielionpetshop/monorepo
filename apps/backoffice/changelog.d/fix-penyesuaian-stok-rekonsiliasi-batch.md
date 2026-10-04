### Fixed

- Penyesuaian Stok kini ikut menyamakan batch FIFO ke qty baru yang diinput, sama seperti Stock Opname. Sebelumnya hanya selisihnya yang diterapkan ke batch, sehingga selisih lama antara stok dan batch terbawa terus — contohnya stok Gudang sudah disesuaikan ke 0 tetapi Laporan Nilai Stok masih menampilkan nilai dari batch yang tersisa. Penyesuaian pengurangan juga tidak lagi gagal "Stok tidak cukup untuk dikurangi" hanya karena batch lebih sedikit dari stok tercatat.
