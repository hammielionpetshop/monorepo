### Changed
- **Cetak laporan settlement shift kini lewat QZ Tray (raw ESC/POS) tanpa dialog cetak browser.** Tombol "Cetak Settlement" di POS (layar sukses tutup shift) dan di Riwayat Shift backoffice mengirim laporan langsung ke printer termal 80mm — printer yang sama dengan struk kasir (`struk_printer_name`). Bila QZ Tray tidak terpasang/aktif, otomatis jatuh ke cetak browser lama seperti sebelumnya, jadi tidak ada stasiun yang kehilangan kemampuan cetak.
  - Penyusun perintah baru `lib/escpos-settlement.ts` (56 kolom / Font B, CP437) dengan angka omzet & rekonsiliasi yang identik dengan tampilan `settlement-print.tsx`.
  - Jalur pengirim `lib/qz-settlement.ts` + satu pintu `lib/print-settlement.ts` mengikuti pola struk & surat jalan yang sudah ada.
- **Cetak Bukti Penerimaan Barang (BPB) transfer masuk di POS kini lewat QZ Tray (raw ESC/POS) tanpa dialog cetak.** Setelah konfirmasi "Barang Diterima" dan lewat tombol "Cetak BPB", BPB dikirim langsung ke printer termal 80mm; fallback ke cetak browser bila QZ Tray tidak ada.
  - Penyusun baru `lib/escpos-goods-receipt.ts` setara tampilan `receiving-note-print.tsx`.
  - Plumbing koneksi QZ untuk dokumen termal non-struk dipusatkan di `lib/qz-thermal.ts`; primitif ESC/POS bersama di `lib/escpos-common.ts`.
