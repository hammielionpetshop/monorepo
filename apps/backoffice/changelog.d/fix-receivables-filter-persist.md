### Fixed
- **Filter pencarian/status/cabang di halaman Piutang tidak lagi hilang setelah masuk ke detail customer.** Sebelumnya balik dari halaman detail me-reset filter ke default, sehingga posisi halaman yang tersimpan jadi menampilkan data yang tidak sesuai (efeknya terlihat seperti "kembali ke halaman pertama"). Filter kini disimpan di sessionStorage seperti posisi halaman tabel.
