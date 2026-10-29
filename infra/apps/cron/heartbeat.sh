#!/bin/sh
set -eu

if [ -z "${JOB_SECRET:-}" ]; then
  echo 'JOB_SECRET wajib diisi untuk memanggil pekerjaan.' >&2
  exit 1
fi

if ! status=$(printf 'x-job-key: %s\n' "$JOB_SECRET" | curl --fail --silent --show-error \
  --connect-timeout 5 --max-time 30 --request POST --header @- \
  --output /dev/null --write-out '%{http_code}' \
  "${HRIS_JOB_BASE_URL:-http://hris:3000}/api/jobs/heartbeat"); then
  echo 'Pekerjaan heartbeat gagal dipanggil.' >&2
  exit 1
fi

if [ "$status" != '200' ]; then
  echo "Pekerjaan heartbeat gagal dipanggil (HTTP $status)." >&2
  exit 1
fi
