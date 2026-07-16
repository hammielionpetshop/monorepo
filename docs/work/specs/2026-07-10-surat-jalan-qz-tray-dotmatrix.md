# Setup — Cetak Surat Jalan via QZ Tray (dot-matrix, 1 PC)

> Surat Jalan bulk sale dicetak raw **ESC/P** (mode teks) ke printer dot-matrix
> lewat **QZ Tray**, bukan mode grafis browser. Hanya 1 PC yang mencetak SJ.
> Kalau QZ Tray tak terpasang/aktif, aplikasi otomatis **fallback** ke cetak
> browser (`window.print`) dengan layout HTML dot-matrix — jadi cetak tetap jalan.

## Sisi kode (sudah siap di repo)
- `apps/backoffice/public/qz-tray.js` — pustaka QZ Tray (vendored, v2.2.6). Di-load
  sebagai `<script>` global `window.qz` (sengaja bukan lewat bundler karena file
  ini punya cabang Node `require('path')` yang bikin Turbopack error).
- `apps/backoffice/lib/qz-print.ts` — `buildDeliveryNoteEscp()` (generator ESC/P,
  80 kolom; versi + harga pakai condensed ~132 kolom) + `printDeliveryNoteViaQz()`.
- Tombol "Cetak Surat Jalan" di **detail transaksi** & **form bulk sale** memakai
  jalur QZ lebih dulu, fallback browser bila gagal.

## Langkah manual di PC pencetak (sekali saja)
1. **Install QZ Tray** (gratis) dari <https://qz.io/download/> → jalankan (ikon tray).
   Ia listen di `wss://localhost:8181` (aplikasi konek ke situ dari browser).
2. **Pasang printer dot-matrix** (mis. Epson LX-310) di Windows. Set **ukuran form
   = 9.5" × 11" (Continuous 11")** di properti printer/driver, sesuai `@page` layout.
3. **Jadikan printer default** di Windows → aplikasi otomatis pakai default.
   - Kalau bukan default, override sekali via console browser di halaman backoffice:
     `localStorage.setItem('sj_printer_name', 'NAMA PERSIS PRINTER')`
4. **First run:** saat pertama menekan "Cetak Surat Jalan", QZ Tray memunculkan
   prompt izin (mode unsigned). Centang **"Remember this decision"** → Allow.
5. Uji cetak 1 SJ (dengan & tanpa harga). Pastikan kolom lurus & perforasi pas.

## Catatan
- **ESC/P Epson-compatible + encoding CP437.** Printer non-Epson yang mendukung
  emulasi ESC/P umumnya jalan; kalau karakter aneh, cek emulasi/DIP switch printer.
- **Kertas:** continuous 9.5"×11", 80 kolom (10 cpi). Versi **+ harga** otomatis
  aktifkan **condensed (17 cpi)** agar kolom Harga/Subtotal muat.
- **Akhir dokumen** kirim **Form Feed** → maju ke lembar berikutnya. Kalau ingin
  hemat kertas / posisi berbeda, sesuaikan panjang form di driver.
- **Fallback** (QZ mati) tetap mode grafis (lebih lambat) — untuk darurat saja.
- **Hilangkan prompt izin permanen (opsional, hardening):** pasang sertifikat
  penanda QZ (`setCertificatePromise`/`setSignaturePromise`). Belum dikonfigurasi;
  untuk 1 PC, "Remember decision" sudah cukup.
- **Update QZ Tray:** ganti `public/qz-tray.js` dengan rilis baru bila perlu.
