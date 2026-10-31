#!/bin/sh
# Memanggil satu pekerjaan HRIS: sh run-job.sh <nama-pekerjaan>
set -eu

job="${1:-}"
if [ -z "$job" ]; then
  echo 'Nama pekerjaan wajib diisi.' >&2
  exit 1
fi
if [ -z "${JOB_SECRET:-}" ]; then
  echo 'JOB_SECRET wajib diisi untuk memanggil pekerjaan.' >&2
  exit 1
fi

if ! status=$(printf 'x-job-key: %s\n' "$JOB_SECRET" | curl --fail --silent --show-error \
  --connect-timeout 5 --max-time 120 --request POST --header @- \
  --output /dev/null --write-out '%{http_code}' \
  "${HRIS_JOB_BASE_URL:-http://hris:3000}/api/jobs/$job"); then
  echo "Pekerjaan $job gagal dipanggil." >&2
  exit 1
fi

if [ "$status" != '200' ]; then
  echo "Pekerjaan $job gagal dipanggil (HTTP $status)." >&2
  exit 1
fi
