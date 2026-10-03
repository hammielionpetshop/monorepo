# Ekspor struk kasir PNG

Pengguna meminta ekspor nota biasa/struk kasir selain surat jalan dan nota tabel.
Cakupan backoffice: detail semua jenis transaksi serta setelah Bulk Sale tersimpan.
Tombol Simpan Struk PNG memakai sumber data yang sama dengan Cetak Struk, terpisah dari pilihan Sertakan harga pada dokumen surat jalan.
Canvas putih menyajikan kop cabang, tanggal WIB, customer, nama/qty/harga/subtotal item, diskon, total, split payment, kembalian dan penanda COPY/VOID.
Nama panjang dibungkus berdasarkan lebar teks. Struk di atas 120 baris dibagi per PNG untuk menjaga batas ukuran canvas.
Komponen unduh umum menangani loading, kegagalan, pembatalan ketika data berubah, tautan per halaman dan pembersihan URL.
Tidak ada API, dependensi atau migrasi baru. Verifikasi TypeScript, tes renderer struk/dokumen dan proof Chrome; merge lokal ke main mengikuti permintaan pengguna sebelumnya.
