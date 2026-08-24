### Fixed
- **IBT yang dijual via Bulk Sale: item yang tidak ikut terjual (stok kosong) tidak lagi salah tercatat "terkirim".** Qty kirim untuk transfer internal yang sudah dikonversi jadi Bulk Sale sekarang diambil dari transaksi penjualannya, bukan dari input manual — item yang direquest tapi tidak ikut terjual otomatis tidak dikirim dan ditandai "Tidak diproses" di halaman detail, tidak lagi menyisakan sisa kirim hantu yang membuat transfer nyangkut di status Diterima Sebagian selamanya.
- **Form kirim & terima transfer internal tidak lagi menampilkan item yang qty-nya nol** (tidak ikut terjual di Bulk Sale / belum dikirim), mengurangi kebingungan operator saat konfirmasi.
- **Pencocokan qty terjual di Bulk Sale sekarang lewat base UOM, bukan satuan mentah.** Kasir yang menjual dalam satuan berbeda dari yang direquest di IBT (mis. diminta PCS, dijual per DUS) sebelumnya membuat item itu salah dianggap "tidak terjual" dan gagal dikirim, padahal benar-benar terjual — sekarang dikonversi dulu ke base UOM sebelum dicocokkan.

### Changed
- **Konfirmasi penerimaan transfer internal kini sekali-jalan (final).** Begitu status jadi Diterima Sebagian atau Diterima Penuh, tidak ada lagi tombol untuk menerima susulan — berlaku untuk semua transfer internal, baik lewat Bulk Sale maupun manual. Piutang antar cabang tetap langsung tercatat begitu ada qty yang diterima.
