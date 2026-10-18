### Changed

- Layar kasir kini menghitung promo berkuota memakai sisa jatah per cabang & stok barang hadiah dari server: promo berhenti sendiri di keranjang saat jatah pcs/nota atau stok habis (jatah pcs mepet memotong sebagian). Sisa jatah dimuat ulang tiap selesai bayar agar nota berikutnya tidak ditolak karena jatah berubah. Keputusan akhir tetap di server (nota ditolak `PROMO_CHANGED` → layar muat ulang & hitung ulang).
