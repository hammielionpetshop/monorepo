# Setup — Cetak Surat Jalan via QZ Tray (dot-matrix, 1 PC)

> Surat Jalan bulk sale dicetak raw **ESC/P** (mode teks) ke printer dot-matrix
> lewat **QZ Tray**, bukan mode grafis browser. Hanya 1 PC yang mencetak SJ.
> Kalau QZ Tray tak terpasang/aktif, aplikasi otomatis **fallback** ke cetak
> browser (`window.print`) dengan layout HTML dot-matrix — jadi cetak tetap jalan.

## Sisi kode (sudah siap di repo)
- `apps/backoffice/public/qz-tray.js` — pustaka QZ Tray (vendored, v2.2.6). Di-load
  sebagai `<script>` global `window.qz` (sengaja bukan lewat bundler karena file
  ini punya cabang Node `require('path')` yang bikin Turbopack error).
- `apps/backoffice/lib/delivery-note-layout.ts` — **satu-satunya sumber layout**:
  `buildDeliveryNotePages()` menyusun nota jadi halaman berisi baris teks 76 kolom.
  Dipakai jalur ESC/P maupun fallback browser, jadi isi keduanya selalu identik.
- `apps/backoffice/lib/qz-print.ts` — `buildDeliveryNoteEscp()` (membungkus halaman
  di atas dengan perintah ESC/P) + `printDeliveryNoteViaQz()`.
- Tombol "Cetak Surat Jalan" di **detail transaksi** & **form bulk sale** memakai
  jalur QZ lebih dulu, fallback browser bila gagal.

## Langkah manual di PC pencetak (sekali saja)
1. **Install QZ Tray** (gratis) dari <https://qz.io/download/> → jalankan (ikon tray).
   Ia listen di `wss://localhost:8181` (aplikasi konek ke situ dari browser).
2. **Pasang printer dot-matrix** (mis. Epson LX-310) di Windows. Kertas yang dipakai
   **continuous 9.5" × 5.5" (setengah lembar)**. Jalur QZ menyetel panjang lembar
   sendiri lewat ESC/P, tapi untuk fallback browser buat/pilih form **9.5" × 5.5"**
   di properti printer/driver (sesuai `@page`).
   - **Muat kertas dengan perforasi tepat di bawah kepala cetak** — posisi kertas
     saat dokumen mulai dicetak dianggap awal lembar (top-of-form).
3. **Jadikan printer default** di Windows → aplikasi otomatis pakai default.
   - Kalau bukan default, override sekali via console browser di halaman backoffice:
     `localStorage.setItem('sj_printer_name', 'NAMA PERSIS PRINTER')`
4. **First run:** saat pertama menekan "Cetak Surat Jalan", QZ Tray memunculkan
   prompt izin (mode unsigned). Centang **"Remember this decision"** → Allow.
5. Uji cetak 1 SJ (dengan & tanpa harga). Pastikan kolom lurus & perforasi pas.

## Catatan
- **ESC/P Epson-compatible + encoding CP437.** Printer non-Epson yang mendukung
  emulasi ESC/P umumnya jalan; kalau karakter aneh, cek emulasi/DIP switch printer.
- **Kertas:** continuous 9.5"×5.5" (box bertuliskan 9.5"×11" "/2"), 10 cpi, 6 lpi
  → 33 baris per lembar; isi dijaga ≤ 31 baris dan lebar 76 kolom (printer narrow
  80 kolom). Versi **+ harga** memakai kolom ringkas, tanpa condensed.
- **Nota panjang dipecah per lembar:** header diulang + "Hal x/y", lembar tengah
  ditutup "Bersambung ke hal. n", tonase/total/tanda tangan hanya di lembar terakhir.
  Satu lembar muat ±14 item (dengan harga & tonase) / ±15 (tanpa harga); lembar
  tengah 21 item.
- **Panjang lembar** dikirim lewat `ESC 2` (6 lpi) + `ESC C 33`; tiap lembar diakhiri
  **Form Feed**. Tanpa `ESC C`, printer memakai panjang bawaannya (umumnya 11") dan
  setiap FF melompati satu lembar 5.5" kosong.
- **Fallback** (QZ mati) tetap mode grafis (lebih lambat) — untuk darurat saja.
- **Hilangkan prompt izin permanen (opsional, hardening):** pasang sertifikat
  penanda QZ (`setCertificatePromise`/`setSignaturePromise`). Belum dikonfigurasi;
  untuk 1 PC, "Remember decision" sudah cukup.
- **Update QZ Tray:** ganti `public/qz-tray.js` dengan rilis baru bila perlu.
