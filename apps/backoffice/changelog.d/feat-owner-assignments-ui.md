### Added

- Halaman **Pengaturan › Penugasan Owner** (OWNER only) untuk mengatur owner per cabang. Dipakai POS saat verifikasi PIN void — tidak perlu lagi INSERT manual ke `owner_assignments`. API baru: `GET/PUT /api/bo/settings/owner-assignments` dengan audit log per perubahan.
