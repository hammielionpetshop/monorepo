# Runbook Deployment — `apps/order-web` (Inisiatif #3 C6)

> Status: sisi kode/config repo **sudah disiapkan**. Sisanya adalah langkah **manual di luar repo**
> (dashboard Vercel, DNS, GitHub Secrets, server VPS) yang harus dijalankan oleh pemilik akun —
> tidak bisa dieksekusi dari sini. Checklist di bawah mengikuti kriteria selesai C6 di
> `docs/work/backlog/2026-07-08-customer-order-portal.md`.

---

## 0. Yang sudah disiapkan di repo

| File | Fungsi |
|---|---|
| `apps/order-web/vercel.json` | Config build Vercel untuk `order-web`, mirror `apps/backoffice/vercel.json` (`turbo build --filter=order-web`) |
| `.github/workflows/deploy-order-web.yml` | CI: push ke `main` yang menyentuh `apps/order-web/**`/`packages/**` → `vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod` |
| `infra/waha/docker-compose.yml` + `.env.example` | Docker Compose WAHA (WhatsApp HTTP API) self-host untuk OTP produksi |

**Catatan penting soal secret CI:** workflow baru memakai nama secret **`VERCEL_TOKEN_ORDER_WEB`** (bukan reuse `VERCEL_TOKEN` milik backoffice), karena `order-web` akan jadi **project Vercel terpisah**. Sebelum lihat apakah bisa reuse token yang sama:
- Jika `VERCEL_TOKEN` yang sudah ada adalah **token akun/tim** (bukan token yang di-scope ke 1 project), kemungkinan besar bisa dipakai ulang untuk kedua project — cukup ganti nama secret di workflow order-web jadi `VERCEL_TOKEN` juga, ATAU tambahkan `VERCEL_TOKEN_ORDER_WEB` dengan value yang sama.
- Jika deploy backoffice yang sudah jalan ternyata butuh `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` juga (workflow yang ada tidak menunjukkan ini secara eksplisit, tapi `vercel pull` di CI tanpa `.vercel/project.json` yang ter-commit biasanya butuh salah satu dari: token yang di-scope ke project tsb, ATAU env `VERCEL_ORG_ID`+`VERCEL_PROJECT_ID`) — **cek dulu apakah repo secrets GitHub sudah punya `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID`**. Kalau ada, kemungkinan perlu pasangan serupa untuk order-web (`VERCEL_PROJECT_ID_ORDER_WEB`, org id biasanya sama).
- Cara paling pasti tanpa menebak: jalankan `vercel link` secara lokal di dalam `apps/order-web` (langkah manual §1 di bawah) — itu akan membuktikan project id yang benar & bisa dipakai untuk isi secret GitHub secara eksplisit lewat step tambahan bila `vercel pull` ternyata gagal hanya dengan token.

---

## 1. Setup project Vercel untuk `order-web` (manual)

1. Login `vercel login` (kalau belum), lalu di root repo: `cd apps/order-web && vercel link` — pilih/​buat project baru (jangan pakai project backoffice yang sudah ada).
2. Di dashboard Vercel project baru ini → **Settings → Environment Variables (Production)**, isi:
   ```
   DATABASE_URL           # sama dengan yang dipakai backoffice (share DB)
   CUSTOMER_JWT_SECRET    # generate baru, min 32 char, BEDA dari JWT_SECRET staff
   ORDER_BRANCH_ID        # id cabang penjual tetap (Gudang/Pusat) di DB PRODUKSI
   ORDER_MIN_AMOUNT       # minimum order produksi (Rupiah), 0 = tanpa minimum
   OTP_PROVIDER=waha
   OTP_TTL_SECONDS=300
   WAHA_BASE_URL          # URL publik instance WAHA (lihat §2), mis. https://waha.hammielion.com
   WAHA_API_KEY           # nilai PLAIN key (bukan hash) — lihat catatan §2
   WAHA_SESSION=default
   ```
3. **Settings → Domains** → tambahkan `order.hammielion.com`, ikuti instruksi Vercel untuk record DNS (biasanya CNAME ke `cname.vercel-dns.com`, ditambahkan di panel DNS domain `hammielion.com`).
4. Buat token untuk CI: **Account Settings → Tokens** → generate token baru → simpan sebagai GitHub repo secret `VERCEL_TOKEN_ORDER_WEB` (Settings → Secrets and variables → Actions, di repo GitHub).
5. Push apapun ke `main` yang menyentuh `apps/order-web/**` akan memicu `.github/workflows/deploy-order-web.yml`.

---

## 2. Setup WAHA self-host (manual, di VPS)

Pilih server (bisa VPS yang sama dengan `server.hammielion.com`, atau VPS terpisah — WAHA tidak butuh resource besar untuk 1 sesi).

```bash
# di server, folder infra/waha (copy dari repo atau clone repo di server)
cd infra/waha
cp .env.example .env
# generate key: buat string acak, hash SHA512-nya untuk .env; simpan versi PLAIN untuk WAHA_BASE_URL/WAHA_API_KEY di Vercel
# contoh (Linux):
#   KEY=$(uuidgen | tr -d '-')
#   echo "Plain key (pakai di Vercel WAHA_API_KEY): $KEY"
#   echo "WAHA_API_KEY=sha512:$(echo -n "$KEY" | sha512sum | cut -d' ' -f1)" > .env
docker compose up -d
```

Lalu:
1. Pastikan port `3000` bisa diakses (langsung, atau lebih aman: taruh di belakang reverse proxy dengan TLS di subdomain sendiri, mis. `waha.hammielion.com`, agar `WAHA_BASE_URL` di Vercel pakai HTTPS — repo ini **tidak** menyediakan config reverse proxy, sesuaikan dengan setup server yang ada).
2. Buka `http://<host>:3000/dashboard` (atau URL reverse proxy-nya) → start sesi baru (default: `default`, harus sama dengan `WAHA_SESSION` di env order-web) → scan QR pakai **nomor WhatsApp toko** (bukan nomor pribadi staff, agar tidak terganggu kalau staff ganti HP).
3. Verifikasi sesi `WORKING`: `curl -H "X-Api-Key: <plain-key>" http://<host>:3000/api/sessions/default`.
4. Simpan folder `.sessions` (di-mount sebagai volume) — jangan dihapus, itu yang membuat sesi tidak perlu scan ulang tiap restart container.

**Catatan biaya/risiko (sudah dicatat di plan §5):** WAHA meng-otomasi WhatsApp Web multi-device (unofficial) — ada risiko nomor kena banned bila dipakai kirim OTP dalam volume besar/cepat; sesi bisa logout sendiri sewaktu-waktu (perlu scan ulang). Pantau dashboard WAHA secara berkala setelah go-live.

---

## 3. Verifikasi akhir (kriteria selesai C6)

- [ ] `https://order.hammielion.com` menampilkan halaman `/login` portal (bukan 404/domain belum ter-attach).
- [ ] Env produksi lengkap ter-set di Vercel (§1.2) — cek `vercel env ls production` di `apps/order-web`.
- [ ] Instance WAHA `docker compose ps` → `waha` container `Up`; sesi `default` berstatus `WORKING` di dashboard.
- [ ] **Uji kirim OTP sungguhan**: request OTP dari `order.hammielion.com/login` pakai nomor HP asli yang sudah di-whitelist (`customers.canOrderOnline=true`) di DB produksi → pastikan pesan WA benar-benar diterima (bukan cuma di-log, karena `OTP_PROVIDER=waha` di produksi, beda dari dev yang `console`).
- [ ] Cookie `customerToken` ter-set dengan benar di subdomain `order.hammielion.com` (cek DevTools → Application → Cookies, pastikan `Secure` aktif karena `NODE_ENV=production`).

---

## 4. Hal yang masih terbuka / belum diputuskan

- **Reverse proxy + TLS untuk WAHA** belum ada config konkret di repo ini (di luar scope Next.js apps) — perlu disiapkan manual sesuai infra server yang dipilih (nginx/Caddy/Traefik, dsb).
- **Backup/monitoring sesi WAHA**: belum ada alerting otomatis kalau sesi logout. Fast-follow: cek endpoint status WAHA secara berkala (cron/health-check), atau alert manual dulu untuk MVP.
- **`admin.hammielion.com` (backoffice)**: dari audit repo, tidak ada bukti domain ini sudah benar-benar di-attach ke project Vercel backoffice (hanya nama di diagram arsitektur). Kalau belum, mungkin worth dilakukan bersamaan saat setup domain `order.hammielion.com`.
