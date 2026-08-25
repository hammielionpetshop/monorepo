### Added
- **Dialog detail di halaman Permintaan Persetujuan.** Tombol "Detail" pada tiap baris membuka
  dialog yang menampilkan info transaksi (cabang, kasir, tanggal, alasan pengajuan).
  - Untuk permintaan **koreksi**, dialog menampilkan tabel perbandingan item sebelum vs
    sesudah (ditambah/diubah/dihapus/tetap), pembayaran sebelum vs sesudah, serta perubahan
    pelanggan bila ada.
  - Untuk permintaan **void**, dialog menampilkan daftar item nota apa adanya.
  - Untuk permintaan koreksi yang **sudah disetujui**, perbandingan sebelum/sesudah diambil
    dari riwayat penerapan koreksi (`transaction_edits`), bukan dari isi nota saat ini —
    setelah diterapkan, nota sudah berubah jadi hasil koreksinya sehingga membandingkannya
    dengan muatan yang diajukan akan selalu terlihat sama.
