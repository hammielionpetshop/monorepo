### Added

- Pintu internal akses kasir untuk HRIS (`/api/internal/hris/backoffice-access`): Owner/GM di HRIS bisa memberi, mengubah, dan mencabut akses kasir (role, cabang utama, cabang tugas) untuk karyawan yang punya akun. Pengguna kasir baru memakai kode karyawan sebagai nomor staf dan wajib mengganti PIN saat pertama masuk.

### Changed

- Pintu internal HRIS kini menerima pelaku yang sedang masuk HRIS (tidak harus membuka backoffice), selama akunnya tertaut ke pengguna backoffice aktif ber-role Owner/GM.
