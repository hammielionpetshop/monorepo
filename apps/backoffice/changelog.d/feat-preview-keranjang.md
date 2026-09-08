### Added

- **Preview lengkap isi keranjang untuk dikirim ke pelanggan.** Tombol **Preview** di panel keranjang POS (juga di bar keranjang mobile, hotkey `F7`) membuka satu lembar berisi seluruh item keranjang — nama produk, qty, satuan, harga satuan, subtotal, dan total — lengkap dengan kop berisi nama toko (diambil dari field "Nama di Struk" cabang), telepon, tanggal, dan nama pelanggan. Dipakai reseller yang minta rincian sebelum memutuskan.
  - Lembarnya selalu berlatar putih walau POS dipakai dalam mode gelap, supaya hasil screenshot/foto tetap terbaca di ponsel.
  - Tombolnya diletakkan di luar lembar putih supaya gampang dipotong dari hasil screenshot; keranjang di atas 12 item otomatis dibagi dua kolom agar muat dalam satu tangkapan layar.
  - **Simpan Gambar** mengunduh lembar itu sebagai berkas PNG siap kirim — tanpa perlu screenshot manual. Nama berkasnya sudah terisi, mis. `Rincian-Pesanan_HAMMIELION_Budi-Santoso_20260908-1432.png`. Gambarnya digambar langsung ke canvas (lebar 720px, dirender 2× supaya tetap tajam saat di-zoom), bukan lewat pustaka penangkap DOM — tidak menambah dependensi dan tidak tersandung warna `oklch` Tailwind v4.
  - **Salin Teks** menyalin rincian keranjang sebagai teks siap tempel ke WhatsApp — dengan penyalin cadangan untuk stasiun POS yang dibuka lewat http dan tidak punya `navigator.clipboard`.
  - **Sembunyikan Harga** mengirim daftar barang tanpa angka harga sama sekali, ikut berlaku untuk salinan teks dan berkas gambarnya.
