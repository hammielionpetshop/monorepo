# Ekspor Struk PNG Implementation Plan

**Goal:** Menambah ekspor nota kasir di backoffice untuk semua jenis transaksi.
**Architecture:** ReceiptSource dan toReceiptPrintData menyediakan data yang identik dengan jalur cetak; renderer canvas menghasilkan satu atau beberapa PNG. Komponen DocumentImageExport memusatkan lifecycle URL dan download untuk struk maupun surat jalan.
**Tech Stack:** React, TypeScript, Canvas, Big.js, Vitest.

- [x] Tulis receipt-image.test.ts dan pastikan gagal sebelum implementasi.
- [x] Implementasikan receipt-image.ts: render nama panjang, kop cabang, nominal, split payment, penanda COPY/VOID dan pecah struk panjang.
- [x] Ekstrak DocumentImageExport dari tombol surat jalan; gunakan wrapper ReceiptImageExport dan DeliveryNoteImageExport untuk menjaga behavior unduh yang sama.
- [x] Gunakan getReceiptSource di kedua layar untuk cetak dan ekspor agar data konsisten.
- [x] Jalankan tes renderer struk dan surat jalan, pnpm typecheck, changelog:check serta proof Chrome. Review perubahan, lalu merge ke main dan verifikasi hasil merge.
