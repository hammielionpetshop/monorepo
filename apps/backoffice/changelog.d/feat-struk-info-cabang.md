### Fixed

- **Struk yang dicetak dari backoffice kini memakai identitas cabang transaksinya — nama, alamat, dan telepon.**
  Sebelumnya dua jalur cetak sisi backoffice tidak mengoper informasi toko sama sekali, sehingga
  strukya selalu berkop `HAMMIELION` tanpa alamat dan tanpa telepon, cabang mana pun itu.
  - Cetak ulang nota dari **Riwayat Transaksi** (detail transaksi).
  - Cetak struk setelah membuat **Bulk Sale**.
  - Akibatnya satu penjualan bisa keluar dengan dua kop berbeda tergantung dicetak dari POS atau
    dari backoffice. Untuk cabang yang nama strukya bukan `HAMMIELION` (mis. `RAJA`,
    `MARKAS PETSHOP`), namanya pun ikut salah — bukan hanya alamatnya yang hilang.
  - Tiga jalur cetak POS (checkout, riwayat POS, settlement) sudah benar sejak awal dan tidak berubah.

### Changed

- **Struk kini tercetak pada skala 70% secara otomatis.** Sebelumnya kasir harus mengubah sendiri
  kotak "Scale" di dialog cetak browser setiap kali mencetak — halaman web tidak bisa menyetel
  kotak itu, jadi struknya sendiri yang dikecilkan. Hasilnya sama seperti memilih 70% di dialog:
  isi tetap memenuhi lebar kertas, hurufnya yang mengecil, sehingga lebih banyak muat per baris.
  - Berlaku untuk semua cetak struk — kasir POS, riwayat POS, riwayat transaksi backoffice,
    dan bulk sale.
  - Bisa ditimpa per pemanggil lewat prop `printScale` (mis. `printScale={1}` untuk ukuran penuh);
    nilai di luar 0,3–1 dijepit agar struk tidak jadi mustahil dibaca.
  - Tidak berlaku untuk cetak setoran (settlement) dan surat jalan — keduanya komponen terpisah.

- **Kop struk mengikuti cabang notanya, bukan cabang yang sedang membuka halaman.** OWNER dan GM
  bisa melihat serta mencetak ulang nota lintas cabang, jadi identitas toko diambil per transaksi:
  detail transaksi membawanya dari cabang nota itu sendiri, dan bulk sale menyalin identitas cabang
  yang dipilih pada saat nota terbit — mengganti pilihan cabang sesudahnya tidak lagi mengubah kop
  struk yang sudah dicetak.

  Kolom `branches.address` dan `branches.phone` sudah ada sejak lama dan bisa diisi lewat
  Pengaturan → Cabang. Baris alamat/telepon hanya muncul di struk bila kolomnya terisi, jadi cabang
  yang datanya masih kosong perlu dilengkapi dulu agar perubahan ini terlihat.
