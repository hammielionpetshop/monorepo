### Added

- Verifikasi setoran kas shift oleh finance di Riwayat Shift: finance mencatat kas yang benar-benar diterima, sistem menghitung **selisih serah-terima** (kas diterima − setoran menurut kasir) terpisah dari selisih kasir terhadap sistem. Selisih ≠ 0 wajib disertai catatan. Untuk shift tutup paksa, pembandingnya kas sistem.
- Kolom "Setoran" dan filter "Belum diverifikasi / Sudah diverifikasi / Ada selisih serah-terima" di daftar Riwayat Shift.
- Permission baru `shift.deposit.verify` (OWNER, GM, FINANCE), disisipkan lewat migrasi `0029_shift_deposit_verification` — tidak perlu seed manual. User perlu login ulang agar permission masuk ke token.

### Changed

- Role FINANCE kini bisa membuka Riwayat Shift, terbatas pada cabangnya sendiri.
- Verifikasi setoran yang sudah tersimpan hanya bisa dikoreksi OWNER/GM; nilai lama tercatat di audit log (`SHIFT_DEPOSIT_CORRECT`).
