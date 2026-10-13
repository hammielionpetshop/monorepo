### Added
- **Server menjadi hakim promo saat nota kasir disimpan.** Server menghitung ulang promo dengan mesin promo memakai **jam server (WIB)**, promo di database, saklar darurat, dan golongan pelanggan. Bila promo yang dikirim layar kasir berbeda (promo baru mulai, sudah berakhir, dimatikan, atau jumlah potongannya lain), nota **ditolak sebelum apa pun tersimpan** dengan pesan untuk kasir, supaya layar menghitung ulang. Yang cocok mencatat potongan **PROMO** di catatan potongan per baris beserta salinan aturan promonya saat itu.
  - Barang promo tidak bisa sekaligus diberi diskon manual; nota berpromo tidak bisa memakai diskon total nota.
  - Penjualan Grosir, PO Internal, pesanan portal, nota sinkron offline, dan pelanggan Reseller/Grosir **di luar promo**; ongkos kirim tidak pernah kena promo.
  - Rute baru untuk layar kasir: promo aktif cabang itu + jam server + keadaan saklar darurat.
