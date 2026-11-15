# Alamat halaman HRIS, Logistik, dan Finance ke bahasa Inggris

Tanggal: 2026-11-14 · Status: **diperintahkan owner 2026-11-14** ("perbaiki sekarang saja", atas temuan
bahwa alamat halaman HRIS/Logistik/Finance berbahasa Indonesia padahal `AGENTS.md` meminta nama route
bahasa Inggris dan tidak ada pengecualian owner). Padanan nama di bawah disusun agent.

## 1. Lingkup

- Hanya **alamat halaman** (folder route di `apps/hris/app/**` dan `apps/finance/app/**`) beserta semua
  tautan yang menunjuk ke sana: menu (`lib/nav.ts`), kunci tanda Baru (`lib/new-features.ts`), pembagian
  alamat HRIS/Logistik (`lib/web-split*.ts`), `middleware.ts`, tautan di layar, tautan yang dibuat server
  (pemberitahuan, kartu Beranda, pengingat mesin), tautan dari Back Office/Gateway ke HRIS/Finance, dan tes.
- **Tidak berubah:** label/teks layar (tetap Bahasa Indonesia), API (`/api/**` sudah bahasa Inggris),
  tabel/kolom DB, hak akses, alamat Back Office.
- **Tanpa migrasi.** Tautan lama yang sudah tersimpan (mis. `hris.notifications.link` di staging) dan
  bookmark lama tetap jalan lewat **pengalihan otomatis** alamat lama → baru di HRIS dan Finance
  (peta pengalihan dibuat dari tabel padanan yang sama; diuji). HRIS/Finance belum produksi, jadi tidak
  ada tautan produksi yang rusak; pengalihan boleh dihapus sesudah rilis HRIS bila tidak diperlukan.

## 2. Padanan per bagian alamat

Dipakai per bagian (segmen), jadi `/gaji/kasbon/[id]/lunasi` → `/payroll/advances/[id]/settle`.
Segmen dinamis (`[id]`, `[employeeId]`, …) tidak berubah.

### HRIS dan Logistik

| Lama | Baru | Lama | Baru |
|---|---|---|---|
| `absen` | `clock-in` | `libur` | `days-off` |
| `absen-trip` | `trip-attendance` | `logistik` | `logistics` |
| `akun` | `accounts` | `luar-slip` | `off-slip` |
| `antar-sendiri` | `self-delivery` | `lunasi` | `settle` |
| `apa-yang-baru` | `whats-new` | `lupa-password` | `forgot-password` |
| `aturan-potongan` | `deduction-rules` | `kode` | `code` |
| `ajukan` | `submit` | `minta-masuk` | `work-requests` |
| `barang-kembali` | `returned-goods` | `minus-kas` | `cash-shortages` |
| `baru` | `new` | `mobil-rute` | `vehicles-routes` |
| `batal-bayar` | `cancel-payment` | `organisasi` | `organization` |
| `batal-catatan` | `cancel-entry` | `panduan` | `guides` |
| `bawaan` | `opening-balances` | `pasangkan` | `pairings` |
| `bayar` | `pay` | `pekerja-lepas` | `casual-workers` |
| `bensin-mobil` | `fuel` | `pembetulan` | `adjustments` |
| `berat` | `weights` | `pemberitahuan` | `notifications` |
| `bongkaran` | `unloading` | `pendapatan` | `earnings` |
| `bonus` | `bonuses` | `pengajuan` | `requests` |
| `buka` | `reopen` | `pengaturan` | `settings` |
| `buku` | `ledger` | `perbantuan` | `assistance` |
| `catat` | `record` | `periode` | `periods` |
| `catat-kasir` | `cashier-entries` | `perlu-dijelaskan` | `clarifications` |
| `catatan-hari` | `day-notes` | `perlu-dilihat` | `needs-review` |
| `cetak` | `print` | `persetujuan` | `approvals` |
| `cuti` | `leave` | `piutang` | `receivables` |
| `dana` | `funds` | `potongan` | `deductions` |
| `dashboard` | `dashboard` | `potongan-lembur` | `deductions-overtime` |
| `denda-driver` | `driver-fines` | `profil` | `profile` |
| `di-luar-titik` | `off-site` | `promosi` | `promotions` |
| `foto-hari-ini` | `todays-photos` | `qr` | `qr` |
| `gaji` | `payroll` | `rekap` | `recap` |
| `gaji-standar` | `standard-pay` | `ringkasan` | `summary` |
| `hak-akses` | `access-rights` | `riwayat-masuk` | `login-history` |
| `hapus-utang` | `write-off` | `ritase` | `trip-counts` |
| `hari-tutup` | `closed-days` | `serah-terima` | `handovers` |
| `hitungan` | `calculation` | `serahkan` | `hand-over` |
| `isikan` | `on-behalf` | `sewa-mobil` | `vehicle-rental` |
| `jabatan` | `positions` | `siap-pindah` | `go-live-readiness` |
| `jadwal` | `schedule` | `slip` | `payslips` |
| `jadwal-bayar` | `pay-schedule` | `sumber-uang` | `money-sources` |
| `jam-kerja` | `work-hours` | `surat-dokter` | `doctor-notes` |
| `jemput-retur` | `return-pickups` | `surat-jalan` | `delivery-notes` |
| `jenis-bonus` | `bonus-types` | `tanggungan-kehilangan` | `loss-liabilities` |
| `jenis-denda` | `fine-types` | `tarif-ritase` | `trip-rates` |
| `jenis-pengajuan` | `request-types` | `tautan` | `cashier-links` |
| `jenis-potongan-lain` | `other-deduction-types` | `tautkan` | `link` |
| `jenis-upah` | `wage-types` | `terima-uang` | `money-checks` |
| `kantor` | `office` | `tertunda` | `pending` |
| `karyawan` | `employees` | `tiadakan` | `waivers` |
| `kasbon` | `advances` | `tidak-masuk` | `absence` |
| `keberatan` | `objections` | `tinjau` | `review` |
| `keberatan-potongan` | `deduction-objections` | `titipan` | `store-deposits` |
| `kebiasaan-lupa-absen` | `missed-clock-in-habits` | `toko` | `stores` |
| `kehadiran` | `attendance` | `total-diterima` | `total-received` |
| `kehadiran-saya` | `my-attendance` | `transfer` | `transfer` |
| `kehilangan-barang` | `lost-items` | `trip` | `trips` |
| `khusus` | `special` | `trip-saya` | `my-trips` |
| `komponen` | `components` | `tukar` | `swaps` |
| `komponen-gaji` | `salary-components` | `tunda` | `defer` |
| `koreksi` | `corrections` | `tutup` | `close` |
| `lain` | `other` | `tutup-cepat` | `early-close` |
| `lapor-masalah` | `report-problem` | `uang-toko` | `store-money` |
| `laporan` | `reports` | `ubah` | `edit` |
| `laporan-masalah` | `problem-reports` | `ubah-jadwal` | `reschedule` |
| `laporan-muat` | `load-reports` | `uji-banding` | `comparison` |
| `laporan-toko` | `store-reports` | `umum` | `general` |
| `lembur` | `overtime` | `upah-ritase` | `trip-wages` |

### Finance

| Lama | Baru | Lama | Baru |
|---|---|---|---|
| `arus-uang` | `cash-flow` | `mutasi` | `movements` |
| `dana-belum-cair` | `pending-funds` | `setoran-vs-laba` | `deposits-vs-profit` |
| `hitung-kas` | `cash-counts` | `tutup-bulan` | `month-close` |
| `laba-rugi` | `profit-loss` | `utang-antar-cabang` | `inter-branch-debts` |
| `rincian` | `details` | | |

## 3. Branch dan urutan

- `feat/english-routes` (dasar `origin/dev_hris`): HRIS + Logistik + Finance (+ tautan dari Back Office/
  Gateway bila ada). Merge lokal ke `dev_hris` lalu `staging`, satu push.
- Fragment changelog HRIS (`apps/hris/changelog.d/feat-english-routes.md`): alamat halaman berubah,
  alamat lama otomatis dialihkan. Tanpa tanda Baru (tidak ada menu baru).

## 4. Pemeriksaan

- `pnpm typecheck` root; tes HRIS terkait menu/alamat (`lib/nav.test.ts`, `lib/web-split.test.ts`, tes
  baru peta pengalihan) dan tes Finance terkait tautan.
- Pencarian sisa: tidak ada lagi string alamat lama di kode kecuali di peta pengalihan.

## 5. Langkah uji owner (staging)

1. Buka HRIS dari Halaman Awal → beranda, lalu klik beberapa menu (Gaji, Kasbon, Kehadiran, Pengaturan):
   alamat di browser bahasa Inggris, layar sama seperti sebelumnya.
2. Buka web Logistik (`logistik.staginghml.my.id`) → Trip, Surat Jalan, Terima Uang: tetap terbuka.
3. Buka satu pemberitahuan lama di HRIS: halaman tujuannya tetap terbuka (dialihkan).
4. Ketik satu alamat lama, mis. `/gaji/kasbon` → otomatis pindah ke `/payroll/advances`.
5. Web Finance: semua menu terbuka (Saldo, Arus Uang, Laba Rugi, Tutup Bulan, …).
