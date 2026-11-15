---
title: 'HRIS L0d — mesin terjadwal'
type: feature
created: '2026-10-29'
status: done
baseline_commit: 533423cb0f47ec3353015b2a809c3fd132d0f205
context:
  - docs/work/specs/2026-10-29-hris-l0-foundation-design.md
  - docs/work/plans/2026-10-29-hris-l0-foundation.md
---

<frozen-after-approval reason="L0 disetujui owner 2026-10-29; pelaksanaan L0d diperintahkan dalam sesi ini">

## Intent

**Masalah:** HRIS belum punya pintu untuk menjalankan pekerjaan terjadwal dan mencatat hasilnya.

**Pendekatan:** endpoint internal dengan kunci akses, daftar pekerjaan, pencatatan di tabel
`hris.job_runs` yang sudah tersedia, dan cron tiap menit untuk membuktikan jalur heartbeat.

## Boundaries & Constraints

**Selalu:** nama teknis Inggris, pesan Indonesia, akses modul lewat `index.ts`, kunci kosong
ditolak, satu catatan audit per pemanggilan sah, pekerjaan idempoten. Tidak menghapus riwayat.

**Perlu keputusan owner:** deploy produksi, staging/domain, atau perubahan lingkup di luar L0d.

**Di luar lingkup:** migrasi baru, auth pengguna, pemberitahuan L2, deploy HRIS L0e,
perubahan data produksi. Profil `hris` menjaga cron agar tidak hidup saat deploy biasa.

## I/O & Edge-Case Matrix

| Skenario | Masukan | Hasil |
|---|---|---|
| Autentikasi gagal | kunci hilang/salah atau env kosong | 401, tanpa catatan job |
| Nama tidak terdaftar | kunci benar, termasuk nama properti prototipe | 404, tanpa catatan job |
| Heartbeat | kunci benar, nama heartbeat | RUNNING menjadi SUCCEEDED, waktu akhir dan ringkasan tersimpan |
| Ulang heartbeat | dua pemanggilan | dua catatan audit; tidak ada efek bisnis berulang |
| Pekerjaan gagal | handler melempar error | FAILED, waktu akhir dan error tersimpan, HTTP 500 |
| Database gagal | insert atau update gagal | HTTP 500 generik, log server; tidak melaporkan sukses |
| Cron | secret tersedia dan target sehat | POST tiap menit ke jaringan internal |
| Pemicu bermasalah | secret kosong, HTTP gagal, jaringan macet | gagal terlihat di log tanpa membocorkan secret; waktu panggilan dibatasi |

</frozen-after-approval>

## Code Map

- `apps/hris/app/api/jobs/[name]/route.ts`: autentikasi dan pemetaan respons HTTP.
- `apps/hris/modules/shared/server/jobs.ts`: daftar pekerjaan dan siklus catatan eksekusi.
- `apps/hris/modules/shared/index.ts`: pintu fungsi modul untuk route.
- `packages/hris-db/src/schema/shared.ts`: tabel audit yang sudah ada; tidak diubah.
- `infra/apps/cron/`: crontab dan pemanggil endpoint internal.
- `infra/apps/docker-compose.yml`: service cron opt-in, belum menyalakan HRIS produksi.
- `turbo.json`: meneruskan JOB_SECRET ke proses aplikasi.

## Tasks & Acceptance

- [x] Implementasikan endpoint, daftar heartbeat dan pencatatan hasil.
- [x] Tambahkan tes batas kepercayaan dan siklus berhasil/gagal/ulang.
- [x] Tambahkan cron profil hris, timeout jaringan, konfigurasi target lokal dan secret.
- [x] Verifikasi typecheck root, lint HRIS, tes terarah, changelog dan konfigurasi compose.
- [x] Buktikan endpoint dan cron menulis ke database lokal bila Docker tersedia.
- [x] Perbarui plan L0, WIP dan potongan changelog sesuai bukti.

**Kriteria penerimaan:**

- Dengan database lokal dan secret tersedia, saat cron berjalan, heartbeat tercatat tiap menit.
- Dengan profil hris tidak dipilih, saat compose dijalankan biasa, cron tidak diaktifkan.
- Dengan permintaan tidak sah, saat endpoint dipanggil, pekerjaan tidak dijalankan.
- Dengan pekerjaan gagal, saat eksekusi berakhir, catatan audit memuat kegagalannya.

## Verification

- `pnpm typecheck`
- `pnpm --filter hris lint`
- `pnpm --filter hris exec vitest run <tes job>`
- `pnpm changelog:check` dan `git diff --check`
- Compose config dengan env dummy; runtime hanya database lokal terisolasi.
- Suite luas tidak dijalankan: cakupan ini cukup diverifikasi dengan tes job dan batas modul.

## Design Notes

Idempotensi berarti efek bisnis tidak terulang, bukan menghapus audit panggilan ulang.
L0 hanya punya heartbeat tanpa efek bisnis. Target cron dapat diarahkan ke proses Next lokal
untuk menguji jalur sebelum service HRIS disiapkan pada L0e.

## Spec Change Log

- Review edge case: curl `--fail` menerima redirect 3xx. Pemicu kini mensyaratkan HTTP 200;
  uji Docker terhadap server redirect 302 membuktikan exit 1. Kontrak endpoint tetap sama.

## Hasil Verifikasi

- `pnpm typecheck`: 6 task berhasil (seluruh package/app yang punya script typecheck).
- Lint HRIS dan 18 tes job + batas modul lulus; changelog dan compose config valid.
- Runtime Next dev + Postgres lokal terpisah: 401/404 tanpa audit, dua panggilan sah
  menghasilkan dua catatan SUCCEEDED dengan ringkasan dan waktu akhir.
- Cron Alpine 32 MB memanggil runtime lokal otomatis; audit tersimpan pada
  05:34:01 dan 05:35:01 UTC (selang satu menit).
- Pemicu di Docker: secret kosong/salah, 404, dan 302 gagal; respons 200 berhasil.
- Tiga review independen: satu temuan redirect diperbaiki; tidak ada temuan lain.
- Suite penuh tidak dijalankan sesuai batas verifikasi proyek.

## Suggested Review Order

- Batas akses endpoint dan respons HTTP.
  [route.ts:1](../../../apps/hris/app/api/jobs/[name]/route.ts#L1)
- Daftar pekerjaan dan siklus audit eksekusi.
  [jobs.ts:1](../../../apps/hris/modules/shared/server/jobs.ts#L1)
- Pemicu internal, timeout dan pemeriksaan hasil.
  [heartbeat.sh:1](../../../infra/apps/cron/heartbeat.sh#L1)
- Bukti perilaku autentikasi, audit dan kegagalan.
  [jobs.test.ts:1](../../../apps/hris/modules/shared/server/jobs.test.ts#L1)
