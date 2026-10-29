#!/bin/sh
set -eu

if [ -z "${JOB_SECRET:-}" ]; then
  echo 'JOB_SECRET wajib diisi untuk menjalankan mesin terjadwal.' >&2
  exit 1
fi

apk add --no-cache curl
cp /opt/hris-cron/crontab /etc/crontabs/root
exec crond -f -l 8
