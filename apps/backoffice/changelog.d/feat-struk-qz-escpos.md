### Added

- **Struk kasir bisa dicetak langsung ke printer termal via QZ Tray, tanpa dialog cetak browser.**
  Kasir menekan "Cetak Struk" dan kertas langsung keluar — tidak ada dialog, tidak ada setelan
  skala yang harus diubah manual.
  - Dicetak sebagai **teks ESC/POS**, bukan gambar halaman web. Printer termal adalah perangkat
    grid karakter: hasilnya tajam dan jauh lebih cepat daripada mode grafis.
  - Memakai **Font B (56 kolom)** pada kertas 80mm. Terhadap Font A (42 kolom) rasionya 0,75 —
    praktis sama dengan permintaan "perkecil jadi 70%", tapi berupa huruf yang memang dirancang
    sekecil itu, bukan raster yang dikecilkan.
  - Berlaku di empat jalur cetak struk: **kasir POS**, **cetak ulang dari riwayat POS**,
    **cetak ulang dari riwayat transaksi backoffice**, dan **bulk sale**.
  - **Selalu ada jalan mundur.** Bila QZ Tray tidak terpasang atau tidak jalan, struk otomatis
    dicetak lewat dialog browser seperti sebelumnya — sama sekali tidak ada stasiun yang kehilangan
    kemampuan mencetak.
  - Printer struk bisa ditentukan per stasiun lewat
    `localStorage.setItem('struk_printer_name', 'NAMA PERSIS PRINTER')`; bila kosong dipakai printer
    default QZ Tray. Polanya sama dengan surat jalan.

### Changed

- **Ketersediaan QZ Tray diperiksa sekali saat halaman POS dimuat, bukan tiap kali mencetak.**
  Koneksi QZ yang tidak ada baru gagal setelah jeda; tanpa pemeriksaan awal, kasir di stasiun tanpa
  QZ Tray menunggu jeda itu **di setiap penjualan**. Sekarang hasilnya diingat, sehingga cetak
  berikutnya langsung tahu harus lewat jalur mana.
