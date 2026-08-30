# Setup — Tanda Tangan QZ Tray (hilangkan dialog izin permanen)

> Sebelumnya tiap request cetak ke QZ Tray dikirim **anonim**. Untuk situs
> "Untrusted" (tanpa sertifikat), QZ Tray **tidak mengizinkan "Remember this
> decision"** — tombol Allow terkunci saat dicentang, jadi operator harus klik
> Allow di tiap sesi. Dengan sertifikat penanda + endpoint signing, request
> ditandatangani sehingga QZ Tray mempercayainya.

## Cara kerja

- `apps/backoffice/lib/qz-security.ts` → `configureQzSecurity()` dipasang saat
  `qz-tray.js` dimuat (di `lib/qz-receipt.ts` & `lib/qz-print.ts`).
  - `setCertificatePromise` → GET `/api/qz/cert` (baca `QZ_CERTIFICATE`).
  - `setSignatureAlgorithm('SHA512')`.
  - `setSignaturePromise` → POST `/api/qz/sign` (server tanda tangan dengan
    `QZ_PRIVATE_KEY`, RSA SHA-512, base64). **Private key tak pernah ke browser.**
- Kedua endpoint butuh sesi login (`accessToken`).
- **Belum dikonfigurasi (env kosong):** endpoint balas `501`, `qz-tray.js`
  otomatis jatuh ke mode anonim — persis perilaku lama. Fitur ini tidak memaksa.

## Langkah setup (sekali)

### 1. Buat sepasang kunci

```bash
node scripts/qz-gen-cert.mjs          # butuh openssl di PATH
```

Menghasilkan di root repo (keduanya sudah di-`.gitignore`):

| Berkas | Dipakai untuk |
|---|---|
| `qz-private-key.pem` | isi env `QZ_PRIVATE_KEY` — **rahasia** |
| `qz-digital-certificate.txt` | isi env `QZ_CERTIFICATE` **dan** dipasang di tiap PC pencetak |

Skrip mencetak dua baris `QZ_PRIVATE_KEY=...` / `QZ_CERTIFICATE=...` siap tempel
(newline PEM sebagai `\n` literal, dalam tanda kutip).

### 2. Set env

- **Lokal:** tempel ke `.env`.
- **Produksi:** tambahkan ke `/srv/hammielion/backoffice.env` di VPS, lalu redeploy
  (atau `docker compose up -d backoffice`). `env_file` sudah menyalurkannya.

Ganti kunci = semua PC pencetak wajib ganti `override.crt` juga.

### 3. Pasang sertifikat di tiap PC pencetak

1. Salin isi `qz-digital-certificate.txt` ke **`C:\Program Files\QZ Tray\override.crt`**.
2. Restart QZ Tray (klik kanan ikon tray → Exit, buka lagi).

Sesudah ini: **tidak ada dialog izin sama sekali**, di PWA maupun browser.

> Kalau `override.crt` tidak dipasang tapi env sudah diisi: dialog izin masih
> muncul, **tapi** sekarang menampilkan `Hammielion POS` dan **"Remember this
> decision" + Allow berfungsi** — cukup sekali klik per PC, tersimpan permanen di
> Site Manager.

## Catatan

- Sertifikat berlaku 20 tahun (`-days 7300`). Perpanjangan = ulangi langkah 1–3.
- Jalur fallback `window.print()` tidak berubah.
- Ini melengkapi `docs/work/specs/2026-07-10-surat-jalan-qz-tray-dotmatrix.md`
  (setup printer & QZ Tray dasar) dan `#18` (cetak struk via QZ).
