### Fixed
- **Cetak ulang struk di web POS tidak lagi langsung jatuh ke dialog cetak browser** meski QZ
  Tray terpasang dan aktif. Dua penyebab diperbaiki:
  - Status `unavailable` dari probe saat halaman dimuat (mis. QZ Tray belum sempat menyala)
    dulu mengunci tombol cetak untuk seluruh sesi. Kini aksi cetak yang dipicu user (Cetak
    Ulang Struk di Riwayat Transaksi POS dan di detail transaksi backoffice) selalu mencoba
    menyambung ulang, mengabaikan status basi itu. Cetak otomatis pasca-transaksi tetap di
    jalur cepat supaya kasir tak menunggu timeout tiap penjualan.
  - Batas tunggu koneksi untuk cetak yang dipicu user dinaikkan dari 2,5 dtk menjadi 8 dtk —
    cold start QZ Tray plus negosiasi sertifikat anonim sering lewat dari 2,5 dtk lalu langsung
    dicap gagal.
- **Halaman Riwayat Transaksi POS kini menyambungkan QZ Tray sejak dibuka** (seperti layar
  kasir), jadi tombol Cetak Ulang tak menanggung ongkos cold start.

### Added
- **Tanda tangan request QZ Tray (opsional).** Dengan mengisi env `QZ_PRIVATE_KEY` +
  `QZ_CERTIFICATE`, tiap request cetak ke QZ Tray ditandatangani server (RSA SHA-512), jadi
  QZ Tray mempercayainya. Kalau sertifikatnya juga dipasang di PC pencetak
  (`override.crt`), dialog izin "Action Required" hilang total; kalau belum, dialognya kini
  bisa di-"Remember + Allow" permanen (dulu tombol Allow terkunci untuk situs untrusted).
  Endpoint baru `/api/qz/cert` & `/api/qz/sign`, helper `lib/qz-security.ts`, skrip
  `scripts/qz-gen-cert.mjs`. Env kosong = perilaku lama (mode anonim, cetak tetap jalan).
  Panduan: `docs/work/specs/2026-08-30-qz-tray-signing.md`.
