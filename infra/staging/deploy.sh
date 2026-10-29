#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ ! "${TAG:-}" =~ ^staging-[a-f0-9]{40}$ ]]; then
  echo 'TAG wajib staging-<SHA commit 40 karakter>.' >&2
  exit 1
fi
for file in .env backoffice.env order-web.env hris.env migrator.env; do
  if [ ! -f "$file" ]; then
    echo "Berkas staging $file belum tersedia." >&2
    exit 1
  fi
done

# Wrapper pipeline mewariskan FD 9 agar penyalinan konfigurasi dan deploy memegang
# kunci yang sama. Pemanggilan manual membuka kuncinya sendiri.
if [[ ! /proc/self/fd/9 -ef "$SCRIPT_DIR/.deploy.lock" ]]; then
  exec 9> .deploy.lock
fi
flock -n 9 || { echo 'Deploy/refresh staging lain masih berjalan.' >&2; exit 1; }

export STAGING_IMAGE_TAG="$TAG"
export DOCKER_CONFIG
DOCKER_CONFIG="$(mktemp -d)"
trap 'rm -rf -- "$DOCKER_CONFIG"' EXIT
printf '%s' "${GHCR_TOKEN:?token registry wajib diisi}" \
  | docker login ghcr.io -u "${GHCR_USER:?pengguna registry wajib diisi}" --password-stdin

compose=(docker compose --project-name hammielion-staging --project-directory "$SCRIPT_DIR" -f "$SCRIPT_DIR/docker-compose.yml")
"${compose[@]}" config --quiet
"${compose[@]}" --profile tools pull migrator-staging
# Pemeriksaan target tidak membuka koneksi DB; dijalankan sebelum migrasi apa pun.
"${compose[@]}" --profile tools run --rm --no-deps --entrypoint node migrator-staging /opt/staging/check-env.mjs
"${compose[@]}" pull bo-staging order-staging hris-staging cron-staging
"${compose[@]}" --profile tools run --rm --no-deps migrator-staging
"${compose[@]}" up -d --wait --wait-timeout 180 bo-staging order-staging hris-staging cron-staging

python3 "$SCRIPT_DIR/configure-gateway.py"

# Hanya simpan tag setelah aplikasi dan gerbang sehat. Kegagalan sebelumnya tidak
# mengganti tag cadangan dalam .env; rollback dapat memakai TAG staging sebelumnya.
if grep -q '^STAGING_IMAGE_TAG=' .env; then
  sed -i "s|^STAGING_IMAGE_TAG=.*|STAGING_IMAGE_TAG=${TAG}|" .env
else
  printf '\nSTAGING_IMAGE_TAG=%s\n' "$TAG" >> .env
fi
echo 'Staging sehat; tag deployment tersimpan.'

# Hanya tag staging-* milik aplikasi sendiri; image/tag produksi tidak disentuh.
for image in backoffice order-web hris migrator; do
  keep="$(docker images --filter "reference=ghcr.io/*/${image}:staging-*" --format '{{.ID}}' | awk '!seen[$0]++' | head -n 6 || true)"
  docker images --filter "reference=ghcr.io/*/${image}:staging-*" --format '{{.ID}} {{.Repository}}:{{.Tag}}' \
    | while read -r id reference; do
        if ! printf '%s\n' "$keep" | grep -qx "$id"; then
          docker rmi "$reference" >/dev/null 2>&1 || true
        fi
      done || true
done
