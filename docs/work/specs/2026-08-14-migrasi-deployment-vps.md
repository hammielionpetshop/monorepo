# Migrasi Deployment: Vercel → VPS Baru

Runbook eksekusi. Rencana & alasannya ada di bagian akhir.

**Ruang lingkup:** `apps/backoffice` dan `apps/order-web` pindah dari Vercel ke VPS baru
sebagai container Docker. **Postgres, PgBouncer, dan WAHA tetap di VPS lama.** Domain
produksi tidak berubah — hanya A record yang dipindahkan.

---

## 1. Bentuk akhirnya

```
                 push ke main
                      │
              GitHub Actions (runner)
              pnpm install → next build → docker build
                      │ push
                      ▼
        ghcr.io/hammielionpetshop/{backoffice,order-web}:<sha>
                      │ ssh: docker compose pull && up -d
                      ▼
┌─────────────────── VPS BARU ────────────────────┐
│  caddy :80/:443  (TLS otomatis)                 │
│    ├─ <domain-bo>    → backoffice   :3000       │
│    ├─ <domain-order> → order-web    :3000       │
│    └─ /uploads/*     → volume uploads_data      │
└────────────────────────┬────────────────────────┘
                         │ sslmode=require, :6432
                         ▼
┌─────────────── VPS LAMA (tetap) ────────────────┐
│  PgBouncer :6432 → Postgres 14.23 :5432         │
│  firewall: hanya izinkan IP VPS baru            │
│  WAHA :3000                                     │
└─────────────────────────────────────────────────┘
```

Build terjadi di runner GitHub, tidak pernah di VPS — server produksi tidak perlu
menanggung RAM untuk `next build`.

---

## 2. Yang perlu disiapkan sebelum mulai

| Hal | Keterangan |
|---|---|
| IP VPS baru | Untuk A record dan whitelist firewall DB |
| Akses SSH VPS baru | User non-root, key-only |
| Domain backoffice & order-web | Domain produksi yang sekarang, tidak berubah |
| Private network antar-VPS? | Kalau ada, dipakai — port 6432 tidak perlu terbuka ke publik |
| PAT GitHub `read:packages` | Untuk `docker login ghcr.io` di VPS |

**Latensi adalah risiko utama.** Postgres tetap di VPS lama, jadi setiap query melintasi
jaringan. Halaman berat seperti laporan menembak beberapa query per request. Urutan
preferensi: (1) provider & region sama lewat private network — < 1 ms dan port DB tidak
perlu terbuka sama sekali; (2) provider beda, region berdekatan, `sslmode=require` wajib;
(3) beda benua — jangan; kalau terpaksa, pindahkan Postgres sekalian.

---

## 3. Setup VPS baru (sekali)

```bash
# 1. Docker
curl -fsSL https://get.docker.com | sh

# 2. Firewall — hanya SSH + HTTP + HTTPS
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable

# 3. Folder deployment
mkdir -p /srv/hammielion
```

Salin dari repo ke `/srv/hammielion/`:

- `infra/apps/docker-compose.yml`
- `infra/apps/Caddyfile`

Buat tiga berkas env dari contohnya (semuanya gitignored, jangan pernah di-commit):

| Berkas | Isi |
|---|---|
| `.env` | `GHCR_OWNER`, `IMAGE_TAG`, `DOMAIN_BACKOFFICE`, `DOMAIN_ORDER_WEB`, `ACME_EMAIL` |
| `backoffice.env` | `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET` |
| `order-web.env` | `DATABASE_URL`, `CUSTOMER_JWT_SECRET`, `ORDER_BRANCH_ID`, `ORDER_MIN_AMOUNT`, `OTP_*`, `WAHA_*` |

Nilai rahasianya diambil dari environment produksi Vercel yang sekarang — **pakai nilai
yang sama persis**. Mengganti `JWT_SECRET` memaksa semua user login ulang; mengganti
`CUSTOMER_JWT_SECRET` memaksa semua pelanggan login ulang.

Login ke registry (image-nya privat):

```bash
echo "<PAT>" | docker login ghcr.io -u <username-github> --password-stdin
```

`NEXT_PUBLIC_APP_URL` dan `NEXT_PUBLIC_API_URL` ada di `.env.local` lama tetapi tidak
dipakai kode mana pun — tidak perlu dibawa.

---

## 4. Setup VPS lama (buka jalur DB)

1. PgBouncer listen di IP privat (kalau ada private network) atau IP publik.
2. Firewall: port `6432` **hanya** dari IP VPS baru. Jangan pernah `0.0.0.0/0`.
   ```bash
   ufw allow from <IP-VPS-BARU> to any port 6432 proto tcp
   ```
3. `pg_hba.conf`: entry untuk IP VPS baru dengan `hostssl` + `scram-sha-256`.
4. Kalau jalurnya publik, PgBouncer **wajib** punya sertifikat TLS lebih dulu —
   trafik DB akan melintasi internet. Periksa ini sebelum membuka port.
5. `DATABASE_URL` di kedua berkas env menunjuk `:6432` dengan `sslmode=require`.
   Ini sekaligus menuntaskan cutover PgBouncer yang selama ini tertunda.

Uji dari VPS baru sebelum lanjut:

```bash
docker run --rm postgres:14 psql "<DATABASE_URL>" -c 'select 1'
```

---

## 5. Secret GitHub

| Secret | Isi |
|---|---|
| `VPS_HOST` | IP atau hostname VPS baru |
| `VPS_USER` | User SSH |
| `VPS_SSH_KEY` | Private key OpenSSH, lengkap dengan baris BEGIN/END |

`VERCEL_TOKEN` dan `VERCEL_TOKEN_ORDER_WEB` **belum dihapus** — masih dipakai kalau
workflow Vercel dijalankan manual untuk rollback.

---

## 6. Urutan cutover

1. **H-1** — turunkan TTL DNS kedua domain ke 300 detik. Ini yang menentukan seberapa
   cepat rollback berlaku.
2. Merge PR. Workflow `deploy-vps.yml` membangun image, mendorongnya ke GHCR, lalu
   SSH ke VPS untuk `docker compose pull && up -d` dan menunggu kedua container sehat.
3. **Verifikasi tanpa menyentuh DNS** — arahkan lewat berkas `hosts` di laptop:
   ```
   <IP-VPS-BARU>  admin.<domain>
   <IP-VPS-BARU>  order.<domain>
   ```
   Jalankan seluruh daftar di §7. Caddy belum bisa menerbitkan sertifikat sebelum DNS
   publik dipindah, jadi pada tahap ini gunakan `curl -k` atau terima peringatan
   sertifikat di browser.
4. Flip A record kedua domain ke IP VPS baru. **Vercel dibiarkan hidup.** Caddy akan
   menerbitkan sertifikat dalam hitungan detik setelah DNS menyebar.
5. Pantau 24–48 jam: log Caddy, `/api/health`, dan jumlah koneksi di VPS lama.
6. Baru setelah itu — matikan project Vercel, hapus `vercel.json` di kedua app dan kedua
   workflow lama lewat PR tersendiri, naikkan TTL DNS kembali.

**Rollback:** kembalikan A record ke Vercel, lalu jalankan workflow Vercel yang tersisa
secara manual (`workflow_dispatch`) bila perlu deploy ulang. Selama langkah 4–6 Vercel
masih utuh dan menunjuk DB yang sama, jadi rollback tidak kehilangan data.

**Rollback versi (tanpa DNS):** di VPS, ubah `IMAGE_TAG` di `.env` ke SHA sebelumnya lalu
`docker compose up -d`. Image lama masih ada di GHCR.

---

## 7. Daftar verifikasi

Lokal sebelum push:

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm changelog:check
docker build -f infra/apps/Dockerfile --build-arg APP_NAME=backoffice .
docker build -f infra/apps/Dockerfile --build-arg APP_NAME=order-web .
```

Di VPS setelah deploy, sebelum flip DNS:

- [ ] `docker compose ps` — ketiga service `Up`, backoffice & order-web `healthy`.
- [ ] `/api/health` kedua app → `{"status":"healthy","database":"connected"}`.
      Ini sekaligus bukti jalur DB lintas-server hidup.
- [ ] Login staf → `/dashboard` termuat dengan data nyata (cookie `accessToken`
      dengan flag `Secure` — kalau login gagal berputar, curigai `X-Forwarded-Proto`).
- [ ] Login PIN kasir → `/pos` → satu transaksi uji tersimpan.
- [ ] Unggah lampiran dari POS → berkasnya **masih ada** setelah
      `docker compose restart backoffice`. Ini yang membuktikan volume benar; di Vercel
      hal ini tidak pernah bisa diuji karena berkasnya memang tidak pernah tersimpan.
- [ ] Aset PWA tanpa auth → `/manifest.webmanifest`, `/sw.js`, `/offline` balas 200,
      bukan redirect ke `/login`.
- [ ] Portal pelanggan: minta OTP dengan nomor whitelist → WA benar-benar diterima
      (jalur WAHA masih ke VPS lama).
- [ ] Di VPS lama: `SELECT count(*) FROM pg_stat_activity` stabil di kisaran 20 dan
      tidak merangkak naik.
- [ ] Laporan yang paling berat dibuka — catat waktunya. Ini ukuran nyata dampak
      latensi lintas-server; kalau terasa jauh lebih lambat dari Vercel, tinjau ulang
      keputusan menyimpan Postgres di VPS lama.

---

## 8. Perubahan repo yang menyertai migrasi ini

| Berkas | Kenapa |
|---|---|
| `apps/*/next.config.ts` | `output: 'standalone'` + `outputFileTracingRoot`. Yang kedua wajib: `@petshop/db` & `@petshop/shared` di-symlink dari `packages/` tanpa build step, jadi tanpa itu bundle-nya keluar tidak lengkap |
| `infra/apps/Dockerfile` | Satu berkas untuk dua app lewat `ARG APP_NAME`. Base Debian, **bukan** Alpine — `argon2` native dan prebuild resminya glibc |
| `.dockerignore` | Tanpa ini `node_modules` seluruh workspace ikut masuk build context |
| `apps/*/lib/db.ts` | Pool 3 → 10. Angka 3 dipilih karena serverless mengalikan pool per instance; di VPS jumlah prosesnya tetap |
| `apps/order-web/lib/shop-name.ts` | Kelima halaman portal menyalin query nama toko yang sama dan Next mem-prerender-nya saat build — artinya build menuntut koneksi DB, yang tidak bisa dipenuhi runner GitHub. Sekarang halaman-halaman itu `force-dynamic` dan query-nya di-cache di memori |
| `apps/order-web/app/api/health/route.ts` | Gerbang sehat butuh endpoint ini di kedua app |
| `apps/backoffice/app/api/pos/uploads/route.ts` | `UPLOAD_DIR` → volume. Di build standalone `process.cwd()` bukan lagi folder app |
| `.github/workflows/deploy-vps.yml` | Menggantikan dua workflow Vercel |

### Kenapa upload disajikan Caddy, bukan Next

`public/` hanya menyajikan berkas yang sudah ada saat build. Berkas yang ditulis
saat runtime ke dalamnya tidak terjamin terlayani. Karena itu volume yang sama di-mount
ke container Caddy dan disajikan langsung di `/uploads/*`. Sifat aksesnya sama seperti
sebelumnya — berkas di bawah `public/` memang publik; yang diproteksi adalah endpoint
unggahnya, dan itu tetap di balik middleware auth.
