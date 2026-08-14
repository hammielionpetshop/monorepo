#!/usr/bin/env bash
#
# Cadangan harian database. Dipasang sebagai cron di VPS:
#
#   crontab -e
#   15 2 * * * /srv/hammielion/backup-db.sh >> /srv/hammielion/backups/backup.log 2>&1
#
# Sejak Postgres pindah ke mesin ini, tidak ada lagi pihak lain yang mencadangkan
# data produksi. Berkas ini satu-satunya jaring pengaman — kalau volume pgdata
# hilang (mis. `docker compose down -v` yang tidak sengaja), inilah yang tersisa.

set -euo pipefail

DIR=/srv/hammielion
OUT="$DIR/backups"
SIMPAN_HARI=14

cd "$DIR"
mkdir -p "$OUT"

STAMP=$(date +%Y%m%d_%H%M%S)
TMP="$OUT/.petshop_${STAMP}.sql.gz.partial"
FINAL="$OUT/petshop_${STAMP}.sql.gz"

# Ditulis ke berkas sementara dulu, baru diganti nama setelah sukses. Tanpa itu,
# dump yang terpotong di tengah (disk penuh, server mati) akan tersimpan dengan nama
# yang terlihat sah — dan baru ketahuan rusak saat benar-benar dibutuhkan.
docker compose exec -T postgres \
  pg_dump -U "$(grep ^POSTGRES_USER postgres.env | cut -d= -f2)" \
          -d "$(grep ^POSTGRES_DB   postgres.env | cut -d= -f2)" \
  | gzip > "$TMP"

# gzip -t membaca seluruh isinya; kalau terpotong, di sinilah ketahuan.
gzip -t "$TMP"
mv "$TMP" "$FINAL"

# Sisa berkas .partial dari percobaan yang gagal sebelumnya.
find "$OUT" -name '.petshop_*.partial' -mtime +1 -delete 2>/dev/null || true

find "$OUT" -name 'petshop_*.sql.gz' -mtime +"$SIMPAN_HARI" -delete

echo "$(date -Is) OK $(basename "$FINAL") $(du -h "$FINAL" | cut -f1)"
