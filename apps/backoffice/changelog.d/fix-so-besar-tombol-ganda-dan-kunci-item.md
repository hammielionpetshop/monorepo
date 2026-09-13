### Fixed
- **Modal review SO Besar tidak lagi menampilkan dua tombol "Simpan Koreksi".** Tombol footer modal
  yang dulu selalu ikut tampil di sebelah tombol "Simpan Koreksi" milik tabel input SO Besar kini
  disembunyikan untuk SO Besar — tombol itu memang tidak pernah aktif untuk SO Besar (state dirty-nya
  dikelola tabel input sendiri), jadi keberadaannya cuma membingungkan.

### Added
- **Tombol "Kunci" per baris di tabel input SO Besar.** Setelah qty fisik sebuah produk diisi, admin
  bisa klik "Kunci" di baris itu untuk langsung menyimpan & mengunci baris tersebut tanpa menunggu
  semua baris lain selesai dihitung. Untuk item yang belum pernah tersimpan, stok sistem pembanding
  dibaca server pada saat baris itu disimpan — sebelumnya, kalau penghitungan satu SO Besar
  berlangsung lama (draft-nya di-autosave ke localStorage, baru disimpan sekaligus lewat "Simpan
  Koreksi" di akhir), transaksi jual/beli yang terjadi selama penghitungan ikut menggeser stok
  sistem yang dibandingkan, sehingga selisih yang tercatat bukan lagi selisih hitung fisik yang
  sebenarnya. "Kunci" menutup jendela itu per item begitu qty fisiknya selesai dihitung.
