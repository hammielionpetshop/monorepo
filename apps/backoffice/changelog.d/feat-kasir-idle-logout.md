### Added
- **Kasir otomatis logout saat idle di POS.** Setelah 5 menit tanpa aktivitas (tanpa klik/ketik/sentuh/scroll), sesi kasir dicabut dan dikembalikan ke halaman login. Role lain (OWNER/GM/MANAGER/GUDANG/FINANCE) tidak terpengaruh. Durasinya bisa diatur lewat env var `KASIR_IDLE_TIMEOUT_MINUTES`.
