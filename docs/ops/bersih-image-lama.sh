#!/bin/bash
# Hapus paket (image) lama aplikasi sendiri. TIDAK menyentuh postgres/caddy/waha, volume, atau container.
# MODE=cek  -> hanya menghitung; MODE=hapus -> benar-benar menghapus.
# `docker rmi` tanpa -f menolak menghapus image yang sedang dipakai container.
set -u
MODE="${MODE:-cek}"
KEEP=6
INUSE=$(sudo -n docker ps -a --format '{{.Image}}' | while read -r i; do sudo -n docker image inspect --format '{{.Id}}' "$i" 2>/dev/null; done | sed 's/^sha256://' | cut -c1-12 | sort -u)
echo "image dipakai container: $(echo "$INUSE" | tr '\n' ' ')"
total_del=0
for repo in backoffice order-web migrator; do
  full="ghcr.io/hammielionpetshop/$repo"
  # urutan bawaan docker images: terbaru dulu
  ids=$(sudo -n docker images --format '{{.ID}}' "$full" | awk '!seen[$0]++')
  keep=$(echo "$ids" | head -n "$KEEP")
  n_all=$(echo "$ids" | grep -c .)
  del=0
  while read -r id tag; do
    [ -z "$id" ] && continue
    echo "$keep" | grep -qx "$id" && continue
    echo "$INUSE" | grep -qx "$id" && continue
    case "$tag" in *"<none>"*) ref="$id" ;; *) ref="$tag" ;; esac
    del=$((del + 1))
    if [ "$MODE" = "hapus" ]; then
      sudo -n docker rmi "$ref" >/dev/null 2>&1 || echo "  dilewati (ditolak docker): $ref"
    fi
  done < <(sudo -n docker images --format '{{.ID}} {{.Repository}}:{{.Tag}}' "$full")
  echo "$repo: $n_all image, disimpan $KEEP terbaru, target hapus $del tag"
  total_del=$((total_del + del))
done
echo "MODE=$MODE total target: $total_del"
df -h / | tail -1
