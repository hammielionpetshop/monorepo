### Changed
- **WAHA (gateway WhatsApp) tidak lagi dinyalakan otomatis saat deploy.** Layanan `waha` di `infra/apps/docker-compose.yml` dipindah ke profil `whatsapp`, karena belum dipakai dan memakan ±950 MB RAM VPS. Menyalakannya kembali: `docker compose --profile whatsapp up -d waha`.
  - Selama WAHA mati, OTP portal pelanggan tidak terkirim dan halaman Pengaturan › WhatsApp menampilkan error.
