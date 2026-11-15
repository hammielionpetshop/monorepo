# Ekspor surat jalan dan nota PNG

Disetujui: backoffice, setelah Bulk Sale tersimpan dan detail semua jenis transaksi, termasuk retail.
Tombol mengikuti Sertakan harga: Surat Jalan tanpa harga, Nota Penjualan dengan harga.
Canvas memakai buildDeliveryNotePages; satu halaman satu PNG putih dengan teks monospace tajam.
Semua data cetak termasuk customer, tonase, total, VOID dan waktu cetak mengikuti layout bersama.
Tidak menambah API, migrasi atau dependensi. Loading mencegah klik ganda; kegagalan tampil dalam Bahasa Indonesia.
Untuk banyak halaman tampilkan tautan unduh tiap halaman agar browser tidak memblokir unduhan otomatis beruntun.
Verifikasi: pnpm typecheck serta tes terarah canvas, penamaan berkas dan kegagalan pembuatan gambar.
