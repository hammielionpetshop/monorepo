# 01 — Arsitektur & Struktur (Langkah L0)

Masalah utama HRIS lama adalah kode dan modul yang tercampur ✅. Karena itu dokumen ini mengatur
**batas** lebih dulu daripada fitur. Semua butir 💡 di sini disahkan saat review PRD, lalu dirinci
di spec L0 (`docs/work/specs/…-hris-pondasi-design.md`).

## 1. Letak di monorepo

```
apps/
├── backoffice/          # sudah ada — POS & back office
├── order-web/           # sudah ada — portal pelanggan (auth OTP sendiri, tidak ikut auth terpusat)
└── hris/                # BARU — Next.js, versi sama dengan backoffice
packages/
├── db/                  # sudah ada — schema `petshop`
├── shared/              # sudah ada — tipe & util bersama
├── auth/                # BARU — schema `auth`, sesi, cookie, password (dipakai backoffice & hris)
├── hris-db/             # BARU — schema `hris` + view baca ke `petshop`
└── logistik/            # BARU — schema `logistik` + aturan trip & ritase (lihat 08)
```

- 💡 Satu package per schema, masing-masing dengan **config Drizzle & folder migrasi sendiri**
  (`schemaFilter` satu schema, tabel pencatat migrasi terpisah). Tidak ada package yang menulis
  migrasi untuk schema milik package lain.
- 💡 `pnpm migrations:check` dan kunci migrasi di `docs/agents/claims.md` diperluas: satu kunci per
  aliran migrasi (petshop, auth, hris, logistik).

## 2. Schema & pemilik data

| Schema | Pemilik | Isi |
|---|---|---|
| `petshop` | backoffice | Semua data kasir (tidak berubah) |
| `auth` | package `auth` | Akun, sesi, tautan akun ke tiap app (02) |
| `hris` | app `hris` | Karyawan, kehadiran, gaji, kasbon, gaji driver, pengaturan, pengajuan |
| `logistik` | package `logistik` | Mobil, rute, trip, awak, ritase (08) |

✅ Semua schema berada di database `petshop_db` yang sama (keputusan 2026-10-29).

- **Tidak ada foreign key lintas schema.** Id dari schema lain disimpan sebagai angka biasa, dan
  keutuhannya dijaga pintu server + tes.
- **HRIS hanya membaca `petshop` lewat view** yang dibuat di schema `hris` (bagian 4).
- **HRIS hanya membaca `logistik` lewat view** milik `logistik` (08).

## 3. Role database & hak akses

| Role | Boleh |
|---|---|
| `bo_app` (backoffice) | baca-tulis `petshop`, baca-tulis `auth`; **tanpa akses** `hris`, `logistik` |
| `order_app` (order-web) | hanya tabel `petshop` yang dipakai portal pelanggan |
| `hris_app` (HRIS) | baca-tulis `hris`, `logistik`, `auth`; **hanya SELECT** pada tabel `petshop` yang dipakai view |
| `migrator` | pemilik semua schema, hanya dipakai saat migrasi |

- **Kondisi produksi (dicek 2026-10-29):** backoffice **dan order-web** tersambung sebagai `admin`,
  satu-satunya role di Postgres, dan role itu **superuser**. Superuser melewati semua GRANT, jadi
  isolasi di tabel atas **belum berlaku** sampai tiap app punya role sendiri.
- ✅ (2026-10-29) Karena itu L0 membuat role `bo_app`, `order_app`, dan `hris_app`, lalu memindah app satu per satu
  (backoffice & order-web cukup ganti `DATABASE_URL`; skemanya tetap). `admin` hanya dipakai migrator
  & perawatan. Pemindahan backoffice/order-web diuji di staging lebih dulu.
- Catatan di luar HRIS: portal pelanggan (order-web) yang menghadap internet saat ini memegang akses
  superuser. Memindahnya ke `order_app` (hanya tabel yang dipakainya) juga menutup risiko keamanan itu.
- `hris_app` membaca `petshop` hanya untuk kolom yang tercantum di bagian 4.

## 4. Data dari kasir (pengganti Tarik Data Kasir v3)

Semua dibaca lewat view di schema `hris` (nama di bawah adalah usulan). View = **kontrak**: kolom
`petshop` yang dibaca view tidak boleh diubah tanpa mengubah view dan tesnya.

| View | Sumber `petshop` | Dipakai untuk |
|---|---|---|
| `v_kasir_pengguna` | `users`, `user_branch_assignments`, `roles` | Akun & Tautan (04) |
| `v_cabang_kasir` | `branches` | Menautkan cabang HRIS ke cabang kasir |
| `v_selisih_kas` | `shift_cashier_breakdown`, `shifts` | Minus kas (06) |
| `v_jasa_grooming` | baris nota jasa + `grooming_orders` + `groomers` | Bonus grooming GAJ-61 (06) |
| `v_ongkir` | baris ongkir + `service_deliveries` + `groomers` | Bonus ongkir LOG-76 (06) |
| `v_produk` | `products`, `product_uom_conversions`, `units_of_measure` | Bongkaran (09) |
| `v_supplier` | `suppliers` | Bongkaran (09) |

- 💡 Rumus nilai bersih baris nota (sesudah diskon) **tidak ditulis ulang**: dipindah dari
  `apps/backoffice/lib/line-net-value.ts` ke `packages/shared`, lalu dipakai backoffice dan HRIS,
  supaya bonus di slip = bonus di laporan kasir.
- 💡 CI menjalankan semua aliran migrasi berurutan di database kosong, sehingga perubahan `petshop`
  yang mematahkan view ketahuan sebelum merge.

## 5. Struktur kode app `hris`

💡 Satu modul = satu folder dengan pintu publik yang jelas:

```
apps/hris/
├── app/                      # route Next.js — tipis, hanya memanggil modul
│   ├── (portal)/             # layar karyawan (HP): Absen, Saya, Pengajuan
│   ├── (kantor)/             # layar kantor (PC)
│   └── api/
└── modules/
    ├── bersama/              # Mesin Pengajuan, Pengaturan, Pemberitahuan, jejak (03)
    ├── karyawan/             # (04)
    ├── kehadiran/            # (05)
    ├── gaji/                 # gaji bulanan + mesin slip (06)
    ├── kasbon/               # (07)
    └── gaji-driver/          # tarif ritase, slip mingguan, denda, bongkaran (09)
        ├── aturan/           # fungsi murni + tes, tiap tes menyebut nomor aturan v3
        ├── server/           # pintu baca/tulis, cek hak (tindakan bernama, KAR-71)
        ├── ui/               # komponen layar modul
        └── index.ts          # satu-satunya yang boleh diimpor modul lain
```

- 💡 **Lint memagari batas**: modul hanya boleh mengimpor `modules/<lain>/index.ts`, tidak boleh
  mengimpor isi `server/` atau `aturan/` modul lain, dan tidak boleh menulis tabel milik modul lain.
- **Setiap pintu tulis adalah tindakan bernama** (KAR-71). Pintu tanpa nama tindakan, atau tanpa tes
  hak per jabatan, membuat tes gagal (KAR-63, WAJ-06).
- Pola API, pesan error, dan validasi Zod mengikuti konvensi `CLAUDE.md` monorepo.

## 6. Foto & berkas

- Foto absen, foto surat dokter, foto kertas lembur, bukti bayar, dan foto surat jalan **tertutup**
  (KEH-15, KEH-42). Disimpan di volume khusus HRIS dan **tidak** disajikan Caddy secara publik
  (berbeda dengan `/uploads` backoffice). Hanya dibuka lewat route yang memeriksa hak.
- Foto dikompres di HP sebelum diunggah; foto absen dihapus setelah 60 hari (KEH-15) oleh mesin
  terjadwal. Perkiraan paling banyak ±0,5 GB.

## 7. Mesin terjadwal

v3 punya pekerjaan harian/mingguan: tandai alpha (KEH-52), gilir shift tiap Senin (KEH-06), antrean
promosi training (KAR-20), tanda 7 hari tidak masuk (KEH-55), hapus foto lama (KEH-15), hitung
perkiraan slip, tanda kasbon/slip lewat waktu (DRV-27, 64).

- 💡 Setiap pekerjaan = satu route server bernama yang dilindungi kunci rahasia, dipanggil cron VPS
  (atau container cron kecil). Setiap jalan dicatat (mulai, selesai, gagal), dan kegagalan memberi
  tahu Owner/GM lewat Pemberitahuan. Pekerjaan harus aman diulang (idempoten).
- Layar Kesehatan Mesin v3 ditunda; catatan jalannya tetap disimpan dari awal.

## 8. Deploy

- Container `hris` di `infra/apps/docker-compose.yml`, image dibangun GitHub Actions seperti
  backoffice, healthcheck, dan **batas RAM** (`mem_limit`).
- Caddy: subdomain HRIS di domain induk yang sama ✅ (❓ nama subdomain).
- PWA (bisa dipasang di HP); kamera & GPS butuh HTTPS.

### Staging ✅ (2026-10-29)

| Hal | Keputusan |
|---|---|
| Lokasi | **VPS yang sama**: project compose kedua `hammielion-staging` (backoffice-staging, hris-staging), masing-masing dengan batas RAM (perkiraan tambahan ±400–500 MB) |
| Database | Container Postgres yang sama, **database terpisah** `petshop_staging`, dengan role staging yang tidak punya akses ke `petshop_db` |
| Data | **Salinan database produksi**, disegarkan saat dibutuhkan (adaptasi `scripts/db-local-refresh.mjs`). Berisi data gaji nyata → staging hanya untuk Owner/GM |
| Domain | **Domain khusus staging** (dibeli owner, ❓ namanya), dengan subdomain `admin.` dan `hris.`. Cookie sesi produksi (`.hammielion.com`) tidak pernah terkirim ke server staging |
| Deploy | Push ke branch `staging` → workflow terpisah membangun image bertanda staging → migrasi di `petshop_staging` → restart project staging. Tidak menyentuh project produksi |
| Berkas & foto | Volume terpisah dari produksi |

- Staging disiapkan di L0, sebelum L1 (auth terpusat) dan pemindahan role database diuji.
- Image lama staging ikut dibersihkan seperti produksi supaya disk tidak penuh.

## 9. Kriteria selesai L0

- App `hris` jalan lokal & di container, dengan halaman kosong yang memakai auth dari L1 (stub dulu).
- Ketiga package schema baru punya migrasi pertama, terdeteksi `migrations:check`.
- Role DB terpisah dibuat; tes membuktikan `hris_app` tidak bisa menulis `petshop`, dan `bo_app` tidak
  bisa membaca `hris`.
- Lint batas modul aktif dan punya satu tes pelanggaran.
- Satu mesin terjadwal contoh tercatat jalannya.
- CI menjalankan typecheck, lint, dan tes untuk app & package baru.
- Staging berjalan di domain staging: push ke `staging` tayang otomatis, database `petshop_staging`
  berisi salinan produksi, dan role staging terbukti tidak bisa membuka `petshop_db`.
