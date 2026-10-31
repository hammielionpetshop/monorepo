# Spec HRIS L2c — Karyawan (Data Induk)

Tanggal: 2026-11-01 · Status: **draf — menunggu persetujuan owner atas §7**
Cakupan: bagian L2c di [plan L2](../plans/2026-11-01-hris-l2.md). Sumber: PRD
[04](../../hris_planning/PRD/fase_1/04-karyawan-dan-akses.md) §2–3.1, v3 `01-karyawan.md` (KAR-01, 02, 05–07,
20–24, 55, 56, 64, 65, 68, 72, 74, 80, 81, 84), `karyawan-dan-akses-spec` §3 (KAR-L10, L11, L20–L24, L27), §4, §5,
§10–12. Aturan v3 berlaku kecuali disebut lain. Dasar kode: L2b (`can()`, tindakan bernama, cabang/jabatan).
Aliran migrasi: `hris` (kunci dipegang `feat/hris-l2c-employees`). Tanpa migrasi `auth`/`petshop`.

## 1. Batas

**Dikerjakan:** data orang; riwayat penempatan bertanggal (cabang, jabatan, status kerja); riwayat status
aktif/nonaktif; izin tugas lapangan; kode karyawan dari server; Tambah Karyawan (Pemilik/GM); layar
Daftar Karyawan, Halaman orang, Catat perubahan penempatan, Nonaktifkan/aktifkan lagi, Izin tugas
lapangan, Promosi Training, Profil saya (baca) dan Ubah kontak; nonaktif → akun pusat nonaktif;
`loadActor()` membaca penempatan pada tanggal hari ini; tabel sementara L2b dipensiunkan.

**Tidak dikerjakan (usulan, lihat §7):**

| Hal | Di mana |
|---|---|
| Akun & Tautan, beri akses kasir, reset password, Perangkat dan riwayat masuk (L14, L40) | L2d |
| Ubah data identitas (L12) dan "usulkan berhenti tanpa pemberitahuan" — butuh Mesin Pengajuan | L2f |
| Foto diri (unggah/kamera) dan pengingat data belum lengkap di Beranda | L2f (bersama lampiran) |
| Jabatan tambahan, hak tambahan, gantikan sementara (L29) | L2f |
| Pekerja Lepas (L28) | Langkah Logistik/bongkaran yang memakainya |
| Shift/kelompok giliran saat pindah cabang (KEH-103) | Kehadiran |
| Gaji Standar saat promosi, slip terakhir, denda tanpa pemberitahuan | Gaji (catatan tanggalnya disimpan sekarang) |
| Muat data lama, tautkan pengguna backoffice lama | L2g |
| Ganti password (L13) | Sudah ada sejak L1d; Profil saya hanya menautkannya |

## 2. Data (schema `hris`, migrasi `0002`)

Nama teknis Inggris. Tidak ada hapus (PRI-02); trigger menolak `DELETE` pada semua tabel di bawah dan
`UPDATE` pada tabel riwayat kecuali kolom pembatalan. Semua tabel punya `created_at`, `updated_at`,
`created_by_account_id`. Tanpa FK lintas schema.

| Tabel | Kolom penting |
|---|---|
| `employees` | `id` (= `local_user_id` tautan HRIS), `code` (unik, dari server, tidak bisa diubah — trigger), `name`, `joined_on` (date), `phone` (unik bila diisi), `email`, `birth_date`, `gender`, `address`, `emergency_contact_name`, `emergency_contact_phone`, `bank_name`, `bank_account_number`, `bank_account_holder`, `birth_place`, `religion`, `marital_status`, `dependents`, `education`, `source` (`HRIS`/`LEGACY`/`FIXTURE`). Semua selain nama, kode, tanggal bergabung boleh kosong (KAR-01, 80, 81) |
| `placements` | `employee_id`, `kind` (`INITIAL`/`BRANCH`/`POSITION`/`WORK_STATUS`/`CORRECTION`), `branch_id`, `position_id`, `work_status`, `effective_from` (date), `reason`, `cancelled_at`, `cancelled_by_account_id`, `cancel_reason`. Setiap baris menyimpan **penempatan lengkap** sesudah perubahan, jadi "penempatan pada tanggal X" = baris tak dibatalkan dengan `effective_from <= X` terbaru (urut `effective_from`, lalu `id`). Pembatalan hanya untuk baris bertanggal depan (KAR-56) |
| `employment_events` | `employee_id`, `kind` (`DEACTIVATE`/`REACTIVATE`), `effective_on` (date; nonaktif = sesudah tanggal terakhir bekerja), `reason_kind` (`RESIGNED`/`DISMISSED`/`OTHER`), `resignation_notice` (`WITH_NOTICE`/`WITHOUT_NOTICE`, hanya bila berhenti), `note`. Status aktif pada tanggal X = kejadian terakhir dengan `effective_on <= X` (tanpa kejadian = aktif) |
| `field_permits` | `employee_id`, `kind` (`DRIVE`/`ASSIST`), `granted_by_account_id`, `granted_at`, `revoked_at`, `revoked_by_account_id`, `revoke_reason`; satu izin aktif per orang per jenis |
| `training_reviews` | `employee_id`, `decision` (`APPROVE`/`DEFER`), `review_again_on`, `reason`, `promotion_effective_on`; keputusan tidak bisa diubah (KAR-23) |
| `employee_code_counter` | satu baris penghitung, dikunci saat membuat kode (tidak ada kode kembar walau bersamaan) |

`work_status`: enum `TRAINING`/`EMPLOYEE` (Freelance menyusul bersama L28). Departemen tidak disimpan:
mengikuti jabatan (KAR-06). Semua perubahan juga masuk `hris.audit_events` (sebelum/sesudah).

**Migrasi `interim_actor_positions`:** setiap baris diubah menjadi `employees` (`id = person_id`, nama dari
username akun bila ada, `source = FIXTURE`, `joined_on` = tanggal baris dibuat) + satu `placements` `INITIAL`
(status `EMPLOYEE`); sequence disetel melewati id terbesar; tabel sementara dihapus. Di produksi tabel itu
kosong, jadi tidak ada data yang dibuat. Skrip `assign-interim-position.mjs` diganti
`assign-fixture-employee.mjs` (local/staging saja) yang membuat karyawan fixture + tautan HRIS-nya.

## 3. Hak dan pelaku

- `loadActor()` membaca penempatan + status aktif **pada tanggal hari ini WIB** (jam server). Orang
  nonaktif pada tanggal itu → tanpa jabatan → semua tindakan ditolak (H13), walau akunnya belum dicabut.
- Target `can()` untuk data orang = `{ personId, branchId, departmentId }` dari penempatannya hari ini;
  pindah cabang bertanggal depan baru berpengaruh di tanggalnya (H10, W3).
- Tindakan yang dipakai (sudah terdaftar di L2b): `employee.list`, `employee.directory`, `employee.update`,
  `placement.record`, `employee.activation`, `resignation.set_unnotified`, `field_permit.update`,
  `training_promotion.decide`, `profile.view`, `contact.update_own`. Tindakan baru: **`employee.create`**
  (`ownerOnly`, KAR-60) — dengan hak awal di migrasi `0002` (tidak ada baris; hanya Pemilik/GM).
- Batas keras tambahan: jabatan `high_rights` hanya bisa dipilih bila pelaku `full_access` (KAR-74, H2);
  catat penempatan/nonaktif/izin atas diri sendiri ditolak (`selfForbidden`, H1); Training → Karyawan
  hanya lewat Promosi (KAR-22, kejadian 9); Kepala Gudang hanya menerima kolom daftar terbatas — server
  memilih kolom, bukan layar (H5); karyawan biasa hanya melihat dirinya (H6).

## 4. Layar

Komponen L2a, mobile-first. Menu grup "Karyawan" di `lib/nav.ts`, dibaca dari `can()`.

- **Daftar Karyawan (KAR-L20)** `/karyawan` — cari nama/kode/HP; saring cabang, jabatan, status kerja,
  aktif/nonaktif/semua (bawaan aktif); per halaman. Tanda "Training: waktunya dinilai", "Belum ada
  rekening". Tombol **Tambah karyawan** hanya untuk `employee.create`. Kepala Gudang (`employee.directory`)
  melihat versi terbatas: nama, cabang, jabatan, izin; hanya bisa membuka Izin tugas lapangan.
- **Tambah Karyawan** `/karyawan/baru` (3 langkah): data diri (nama wajib; HP, email, tanggal lahir,
  jenis kelamin boleh kosong) → penempatan (cabang aktif, jabatan aktif, status kerja, tanggal
  bergabung) → periksa → simpan (ditahan 3 detik). Kode karyawan diberikan server. Tanpa akun (L2d).
- **Halaman orang (KAR-L21)** `/karyawan/[id]` — kepala (nama, kode, cabang, jabatan, status kerja,
  aktif) + kartu: Data diri (**Ubah data** oleh `employee.update`, langsung berlaku, tercatat), Penempatan
  (riwayat + **Catat perubahan**), Status (riwayat + **Nonaktifkan / Aktifkan lagi**), Izin tugas lapangan,
  Akun (hanya baca: ada/tidaknya tautan HRIS; pengelolaan di L2d). Di halaman dirinya sendiri tombol
  catat/nonaktif/izin tidak tampil; server tetap menolak.
- **Catat perubahan penempatan (KAR-L22)** (4 langkah): jenis (pindah cabang, ganti jabatan, ganti status
  kerja) → isi (hanya yang aktif; berhak tinggi hanya untuk Pemilik/GM) → tanggal berlaku (boleh lalu atau
  depan) + alasan wajib → periksa dengan kalimat akibat → simpan (3 detik). Catatan bertanggal depan yang
  belum berlaku boleh **Dibatalkan** dengan alasan; yang sudah berlaku dibetulkan dengan catatan baru.
- **Nonaktifkan / Aktifkan lagi (KAR-L23)** (3 langkah): tanggal terakhir bekerja + alasan (berhenti,
  diberhentikan, lainnya) + keterangan → cara berhenti bila berhenti ("dengan pemberitahuan"; "tanpa
  pemberitahuan" hanya Pemilik/GM) → periksa (akibat ke akun disebut) → simpan (3 detik). Aktifkan lagi:
  tanggal mulai + alasan; penempatan memakai yang terakhir.
- **Izin tugas lapangan (KAR-L24)**: dua sakelar Boleh menyetir / Boleh ikut sebagai kenek, dengan pemberi
  dan tanggal; mencabut wajib alasan. Penanda "Otomatis (jabatan Driver)" menunggu tanda jabatan di L2e,
  karena kode tidak boleh membandingkan nama jabatan (WAJ-05).
- **Promosi Training (KAR-L27)** `/karyawan/promosi` — orang Training yang genap 3 bulan sejak bergabung
  (bulan tanpa tanggal itu memakai tanggal terakhirnya, W1) atau yang tanggal "nilai lagi"-nya tiba;
  dihitung saat layar dibuka (tanpa mesin jadwal). **Setujui** (3 detik) → catatan `WORK_STATUS` ke Karyawan
  berlaku awal periode berikutnya (tanggal 26, GAJ-04, W2). **Tunda** → alasan + tanggal nilai lagi wajib.
- **Profil saya (KAR-L10)** `/profil` — kartu Penempatan (+ riwayat, baca), Kontak & data diri, Data
  identitas (baca; rekening disamarkan kecuali 4 angka terakhir), tautan Ganti password.
  **Ubah kontak (KAR-L11)**: HP, alamat, kontak darurat, data diri lain; langsung berlaku; HP yang dipakai
  orang lain ditolak. Email pemberitahuan ganti HP (KAR-70) menyusul bersama pemberitahuan L2f.

Route mutasi di `app/api/employees/**` memakai pola L2b: `checkMutation` lalu `requireMutationAction`
dengan target orang. Satu simpan = satu transaksi + satu baris `audit_events`.

## 5. Nonaktif dan akun pusat

`deactivateAccount` di `@petshop/auth` saat ini hanya menerima pelaku dengan sesi **backoffice**
OWNER/GM, jadi HRIS tidak bisa memanggilnya. Usulan: fungsi baru `setAccountActiveFromHris(sql, { token,
employeeId, active, reason })` di `packages/auth` yang memverifikasi sesi HRIS pelaku, mencari akun lewat
tautan HRIS `local_user_id = employeeId`, lalu menonaktifkan (cabut semua sesi) atau mengaktifkan lagi, dengan
`auth.audit_events`. Hak pelaku (`employee.activation`) tetap diperiksa HRIS lebih dulu, seperti pola
provisioning ("pemanggil wajib sudah memverifikasi hak"). Tanpa tautan → hanya data HRIS yang berubah.

- Nonaktif hari ini atau tanggal lalu → akun langsung nonaktif di semua app (KAR-69, kejadian 13).
- Nonaktif bertanggal depan → akses HRIS tertutup otomatis di tanggalnya (resolver §3); akun pusat dicabut
  oleh job harian `employee-status-apply` (00.01 WIB) lewat infrastruktur job L0. Job produksi baru aktif
  bersama layanan HRIS.
- Aktifkan lagi → akun lama aktif lagi (kejadian 38); password tidak berubah.

## 6. Tes (non-UI)

- Penempatan pada tanggal: W3 (31 Okt 23.59 masih cabang lama, 1 Nov sudah baru), W4 (koreksi mundur),
  pembatalan bertanggal depan, urutan baris bertanggal sama.
- Promosi: W1 (10 Jan → 10 Apr; 31 Jan → 30 Apr), W2 (disetujui 10 Nov → berlaku 26 Nov), tunda → masuk lagi.
- Hak: H1, H2, H5, H6, H10, H13 dan kejadian 6, 9, 12, 13, 33 sebagai tiap jabatan awal (kunci jawaban L2b
  diperluas dengan target orang nyata dari penempatan).
- DB (`packages/db-roles/tests/hris-employees.integration.test.mjs`): migrasi interim → karyawan, kode unik
  dan tak bisa diubah walau bersamaan, tidak ada hapus, riwayat tidak bisa diubah, nonaktif mencabut sesi
  akun tertaut, aktifkan lagi.
- `pnpm migrations:check`, `pnpm check:candidate` sekali pada kandidat akhir. Uji UI oleh owner di staging.

## 7. Keputusan yang perlu disetujui

1. **Pangkas lingkup L2c** seperti tabel §1: L12, usulan berhenti tanpa pemberitahuan, foto, jabatan
   tambahan, hak tambahan → L2f; L14 → L2d; Pekerja Lepas → saat bongkaran dibangun.
2. **Fungsi auth baru untuk HRIS (§5)**, tanpa migrasi `auth`. Butuh perluasan klaim ke
   `packages/auth/src/**` dan infrastruktur job HRIS.
3. **Format kode karyawan**: usulan `K` + 5 angka berurutan (`K00001`). Kode dari data lama (L2g) dibawa apa
   adanya bila ada, dan penghitung mulai sesudah yang terbesar.
4. **Status kerja sebagai daftar tetap di kode** (Training, Karyawan; Freelance menyusul), bukan tabel yang
   bisa diubah, karena mesin (promosi, gaji) bergantung pada artinya.
5. **Tabel sementara L2b dikonversi** menjadi karyawan fixture (§2), supaya `sundus`/`fauzan` di staging
   tetap berjabatan tanpa fixture ulang; namanya bisa dibetulkan lewat Ubah data.
6. **Promosi dihitung saat layar dibuka** (tanpa mesin jadwal 08.15 dan pemberitahuan) sampai L2f.
