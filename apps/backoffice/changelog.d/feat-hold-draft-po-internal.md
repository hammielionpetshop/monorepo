### Added
- **Draft otomatis untuk pembuatan PO Internal di halaman kasir.** Form "Buat PO Internal" (`/pos` → PO Internal) kini menyimpan isian ke browser setiap ada perubahan, jadi kasir yang terdistraksi — menutup tab, pindah halaman, atau reload — tidak kehilangan cabang, produk, qty, HPP, maupun catatan yang sudah diketik.
  - Draft dipulihkan otomatis saat form dibuka lagi, dan di-scope per cabang kasir.
  - Tombol **Tahan sebagai draft** untuk kembali ke daftar tanpa mengirim permintaan.
  - Banner di daftar PO Internal: "Ada draft PO Internal yang belum dikirim" dengan aksi **Lanjutkan** dan **Buang**.
  - Draft terhapus sendiri setelah permintaan berhasil dikirim, atau lewat tombol **Buang draft** di form.
