### Fixed

- **Daftar tunggu (hold) Web POS kini memulihkan pelanggan yang sempat dipilih sebelum ditahan.**
  Sebelumnya `customerId` disimpan di `open_bills` tapi tidak pernah dipakai lagi saat "Lanjutkan"
  ditekan — pelanggan (beserta tier harganya) hilang begitu keranjang dipulihkan, padahal item-nya
  sendiri sudah benar tersimpan apa adanya. Snapshot `items` sekarang membungkus `cartItems` +
  `customer` sekaligus, dan `restoreCart` memulihkan keduanya langsung tanpa lewat
  `setSelectedCustomer` — supaya harga per item yang sudah diedit kasir (mis. lewat "Ubah Tier")
  tidak diam-diam dihitung ulang berdasar tier pelanggan saat daftar tunggu dibuka kembali.
