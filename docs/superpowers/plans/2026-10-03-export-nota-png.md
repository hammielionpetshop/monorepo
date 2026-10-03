# Ekspor Nota PNG Implementation Plan

> Execute inline using executing-plans; user approved implementation in this session.

**Goal:** Ekspor dokumen BULK backoffice menjadi PNG sesuai layout cetak.
**Architecture:** Renderer canvas menerima DeliveryNoteData dan membangun halaman lewat buildDeliveryNotePages. Komponen tombol mengelola loading, error, URL blob dan unduhan; kedua layar memasok data dari fungsi penyusun data cetak yang sama.
**Tech Stack:** React, TypeScript, Canvas 2D, Vitest.

- [x] Tambahkan lib/delivery-note-image.test.ts: uji teks VOID, harga, halaman panjang, filename aman dan toBlob gagal dengan DOM canvas stub. Jalankan pnpm --filter backoffice test -- lib/delivery-note-image.test.ts; pastikan gagal sebelum implementasi.
- [x] Tambahkan lib/delivery-note-image.ts: render setiap halaman 64 kolom dengan Courier New 32px pada canvas putih, line-height 40px, margin 48px; lebar mengikuti baris terpanjang; tunggu document.fonts.ready. Kembalikan Blob PNG dan filename surat-jalan/nota dengan nomor transaksi aman serta nomor halaman.
- [x] Tambahkan transactions/bulk-sale/_components/delivery-note-image-export.tsx: siapkan gambar dengan try/catch/finally, loading disabled, revoke URL saat data berubah/unmount; satu halaman langsung diunduh, beberapa halaman ditampilkan sebagai link unduhan.
- [x] Kedua layar: ekstrak getDeliveryNoteData(): DeliveryNoteData | null dari handler cetak, pakai fungsi itu untuk cetak dan komponen ekspor agar data sama. Tombol di sebelah cetak, label mengikuti includePrice.
- [x] Tambahkan changelog.d/feat-export-nota-png.md, jalankan tes renderer dan layout serta pnpm typecheck. Periksa git diff --check dan review perubahan UI/cleanup/errors.
