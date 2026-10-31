### Added
- Adapter autentikasi pusat di backoffice (mode `central`) yang memakai layanan sesi HRIS L1b: login password dan PIN, onboarding dengan ganti password, bootstrap sesi tanpa login ulang, serta logout yang mencabut sesi di server. Mode ini nonaktif secara bawaan; `BO_AUTH_MODE=legacy` tetap memakai sesi lama tanpa perubahan perilaku.

### Changed
- Menonaktifkan atau mereset kredensial pengguna di Pengaturan > Pengguna pada mode `central` ikut mencabut seluruh sesi akun pusatnya.
- Halaman login dan onboarding menyertakan token CSRF bila mode `central` aktif; pada mode `legacy` tidak ada perubahan.
