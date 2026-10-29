#!/usr/bin/env bash
# Salin database toko ke staging secara manual. Tidak pernah dipanggil pipeline.
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DB=petshop_db
TARGET_DB=petshop_staging
PRODUCTION_DIR=/srv/hammielion

if [ "$#" -gt 1 ] || { [ "$#" -eq 1 ] && [ "$1" != '--check' ] && [ "$1" != '--bootstrap' ]; }; then
  echo 'Pemakaian: bash refresh-db.sh [--check|--bootstrap]. Target selalu petshop_staging.' >&2
  exit 1
fi
# Nama tidak berasal dari argumen/env. Palang eksplisit menjaga perubahan berikutnya.
if [ "$SOURCE_DB" != 'petshop_db' ] || [ "$TARGET_DB" != 'petshop_staging' ] || [ "$SOURCE_DB" = "$TARGET_DB" ]; then
  echo 'Sumber/target refresh tidak aman.' >&2
  exit 1
fi

cd "$SCRIPT_DIR"
exec 9> .deploy.lock
flock -n 9 || { echo 'Deploy/refresh staging lain masih berjalan.' >&2; exit 1; }
compose=(docker compose --project-name hammielion-staging --project-directory "$SCRIPT_DIR" -f "$SCRIPT_DIR/docker-compose.yml")
production=(docker compose --project-name hammielion --project-directory "$PRODUCTION_DIR" -f "$PRODUCTION_DIR/docker-compose.yml")

"${compose[@]}" config --quiet
# Bootstrap hanya menyalin ke nama DB tetap, tanpa URL aplikasi, image migrator,
# migrasi atau menyalakan app. Deploy pertama menjalankan pemeriksaan URL & role.
if [ "${1:-}" != '--bootstrap' ]; then
  "${compose[@]}" --profile tools run --rm --no-deps --entrypoint node migrator-staging /opt/staging/check-env.mjs
fi
database_container="$("${production[@]}" ps -q postgres)"
if [[ ! "$database_container" =~ ^[a-f0-9]{12,64}$ ]]; then
  echo 'Container Postgres produksi tidak ditemukan secara pasti.' >&2
  exit 1
fi
if [ "$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$database_container")" != 'hammielion' ] \
  || [ "$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.service" }}' "$database_container")" != 'postgres' ]; then
  echo 'Identitas container database tidak sesuai.' >&2
  exit 1
fi
if [ "${1:-}" = '--check' ]; then
  echo 'Palang refresh valid: petshop_db → petshop_staging. Belum ada data diubah.'
  exit 0
fi
if [ "${1:-}" = '--bootstrap' ]; then
  existing="$(docker exec -i "$database_container" sh -c 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec psql -U "$POSTGRES_USER" -d postgres -At -v ON_ERROR_STOP=1' <<'SQL'
SELECT COUNT(*) FROM pg_database WHERE datname = 'petshop_staging';
SQL
  )"
  if [ "$existing" != '0' ]; then
    echo 'Bootstrap ditolak: database staging sudah ada. Gunakan refresh biasa.' >&2
    exit 1
  fi
fi

mkdir -p backups
dump_file="$(mktemp "$SCRIPT_DIR/backups/source-XXXXXXXX.dump")"
# Simpan dump yang tervalidasi sebelum menghentikan aplikasi atau mengganti DB staging.
docker exec "$database_container" sh -c 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec pg_dump -U "$POSTGRES_USER" -d petshop_db -Fc --no-owner --no-acl' > "$dump_file"
test -s "$dump_file"
docker exec -i "$database_container" pg_restore --list < "$dump_file" > /dev/null

if [ "${1:-}" != '--bootstrap' ]; then
  "${compose[@]}" stop cron-staging bo-staging order-staging hris-staging
  # --force hanya memutus koneksi database staging; koneksi petshop_db tidak disentuh.
  docker exec "$database_container" sh -c 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec dropdb -U "$POSTGRES_USER" --if-exists --force petshop_staging'
fi
docker exec "$database_container" sh -c 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec createdb -U "$POSTGRES_USER" petshop_staging'
docker exec "$database_container" sh -c 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec psql -U "$POSTGRES_USER" -d petshop_staging -v ON_ERROR_STOP=1 -c "REVOKE CONNECT ON DATABASE petshop_staging FROM PUBLIC"'
docker exec -i "$database_container" sh -c 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec pg_restore -U "$POSTGRES_USER" -d petshop_staging --no-owner --no-acl --exit-on-error' < "$dump_file"
if [ "${1:-}" = '--bootstrap' ]; then
  echo 'Snapshot awal petshop_staging tersedia; lanjutkan deploy untuk migrasi, role dan aplikasi.'
  exit 0
fi
# Migrator memilih STG_* dari nama database; password role produksi tidak disetel.
"${compose[@]}" --profile tools run --rm --no-deps migrator-staging
"${compose[@]}" up -d --wait --wait-timeout 180 bo-staging order-staging hris-staging cron-staging
echo 'Refresh petshop_staging berhasil. Dump sumber tersimpan privat di folder backups.'
