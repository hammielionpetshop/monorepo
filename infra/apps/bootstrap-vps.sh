#!/usr/bin/env bash
#
# Setup awal VPS BARU untuk backoffice + order-web. Jalankan sebagai root.
#
#   scp -r infra/apps <user>@<vps>:/tmp/hammielion-infra
#   ssh <user>@<vps> 'sudo bash /tmp/hammielion-infra/bootstrap-vps.sh'
#
# Aman dijalankan berulang: setiap langkah memeriksa keadaan dulu, tidak ada yang
# ditimpa diam-diam. Skrip ini TIDAK menyentuh VPS lama dan tidak mengubah apa pun
# yang berhubungan dengan Postgres produksi — itu dikerjakan manual, lihat §4 di
# docs/work/specs/2026-08-14-migrasi-deployment-vps.md.

set -euo pipefail

TARGET_DIR=/srv/hammielion
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[33m[!] %s\033[0m\n' "$*"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "Harus dijalankan sebagai root (pakai sudo)." >&2
  exit 1
fi

log "1/5 Docker"
if command -v docker >/dev/null 2>&1; then
  echo "sudah terpasang: $(docker --version)"
else
  curl -fsSL https://get.docker.com | sh
fi
# Plugin compose v2 dibutuhkan; paket docker-compose lama (v1) tidak dipakai.
if ! docker compose version >/dev/null 2>&1; then
  echo "Plugin 'docker compose' tidak tersedia — pasang docker-compose-plugin." >&2
  exit 1
fi
systemctl enable --now docker

log "2/5 Firewall"
if command -v ufw >/dev/null 2>&1; then
  # SSH lebih dulu, sebelum ufw diaktifkan — kalau terbalik, sesi ini ikut terputus.
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  if ufw status | grep -q '^Status: active'; then
    echo "ufw sudah aktif"
  else
    ufw --force enable
  fi
  ufw status verbose
else
  warn "ufw tidak ada — pastikan hanya port 22/80/443 yang terbuka lewat firewall provider."
fi

log "3/5 Folder deployment"
mkdir -p "$TARGET_DIR"
for f in docker-compose.yml Caddyfile; do
  if [ -f "$TARGET_DIR/$f" ] && ! cmp -s "$SRC_DIR/$f" "$TARGET_DIR/$f"; then
    cp "$TARGET_DIR/$f" "$TARGET_DIR/$f.bak.$(date +%Y%m%d%H%M%S)"
    warn "$f berbeda dari versi repo — yang lama disimpan sebagai .bak"
  fi
  cp "$SRC_DIR/$f" "$TARGET_DIR/$f"
done
echo "docker-compose.yml & Caddyfile disalin ke $TARGET_DIR"

log "4/5 Berkas env"
# Contoh disalin HANYA kalau belum ada. Berkas env berisi rahasia produksi dan
# tidak boleh pernah tertimpa oleh skrip.
created_any=0
for f in .env backoffice.env order-web.env; do
  if [ -f "$TARGET_DIR/$f" ]; then
    echo "$f sudah ada, dibiarkan"
  else
    cp "$SRC_DIR/$f.example" "$TARGET_DIR/$f"
    chmod 600 "$TARGET_DIR/$f"
    echo "$f dibuat dari contoh — MASIH KOSONG, wajib diisi"
    created_any=1
  fi
done
chmod 700 "$TARGET_DIR"

log "5/5 Registry"
if [ -f /root/.docker/config.json ] && grep -q 'ghcr.io' /root/.docker/config.json; then
  echo "sudah login ke ghcr.io"
else
  warn "Belum login ke ghcr.io. Jalankan (PAT dengan scope read:packages):"
  echo '    echo "<PAT>" | docker login ghcr.io -u <username-github> --password-stdin'
fi

log "Selesai"
cat <<EOF
Berikutnya, berurutan:

  1. Isi $TARGET_DIR/.env             — domain, GHCR_OWNER, ACME_EMAIL
     Isi $TARGET_DIR/backoffice.env   — DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
     Isi $TARGET_DIR/order-web.env    — DATABASE_URL, CUSTOMER_JWT_SECRET, ORDER_*, WAHA_*

     DATABASE_URL wajib sslmode=verify-full DAN memakai hostname (bukan IP).
     Alasannya di runbook §4 — dengan IP, verifikasi sertifikat tidak pernah terjadi.

  2. Buka jalur DB di VPS lama (runbook §4), lalu jalankan uji positif DAN uji
     negatif di §4.4. Uji negatif yang membuktikan TLS-nya benar-benar diverifikasi.

  3. Simpan secret di GitHub: VPS_HOST, VPS_USER, VPS_SSH_KEY.

  4. Merge PR-nya. Workflow deploy-vps.yml yang menarik image dan menyalakan service.

Jangan pindahkan A record sebelum verifikasi lewat berkas hosts (runbook §6 langkah 3).
EOF

if [ "$created_any" -eq 1 ]; then
  echo
  warn "Ada berkas env yang baru dibuat dan masih kosong — 'docker compose up' akan gagal sampai diisi."
fi
