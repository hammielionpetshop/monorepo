# Spec HRIS L2g — Muat data awal karyawan

Tanggal: 2026-11-01 · Status: **disetujui owner 2026-11-01; kode dan migrasi `0007` terintegrasi; pemuatan data DITUNDA atas keputusan developer via owner 2026-11-01, data belum dimuat ke staging maupun produksi**
Sumber: plan L2 bagian L2g, PRD 04 (muat data), arahan owner 2026-11-01. Berkas sumber: Excel ekspor HRIS lama, 39 baris, **tidak masuk repo**
(data pribadi). Aliran migrasi: **`hris` 0007**.

## 1. Batas

Dikerjakan: memuat **karyawan aktif saja**, tanpa satu orang atas keputusan owner (24 orang) ke staging; yang kosong tetap kosong, tanpa email.

Tidak dikerjakan: 14 karyawan nonaktif (keputusan owner); akun dan tautan kasir (dibuat di Akun & Tautan);
Pasangkan Groomer (langkah terpisah sesudah ini); produksi (izin owner terpisah, sesudah cutover L1).

## 2. Pemetaan kolom

| Excel | HRIS | Catatan |
|---|---|---|
| Kode Karyawan | `code` | Tidak dimuat. Kode `HML-xxxx` diberi server saat dimuat, sama dengan karyawan baru (keputusan owner) |
| Nama Lengkap, Tanggal Masuk | `name`, `joined_on` | apa adanya; satu koreksi nama dari owner lewat argumen skrip, bukan ditulis di repo |
| No. HP, HP Kontak Darurat | `phone`, `emergency_contact_phone` | `normalizePhone` |
| Tempat Lahir, Tanggal Lahir, Alamat, Agama, Tanggungan, Pendidikan | kolom senama | apa adanya |
| Jenis Kelamin | `gender` | male/Laki-laki, female/Perempuan disatukan |
| Status Pernikahan | `marital_status` | single/Belum Menikah disatukan; married, divorced |
| Bank, No. Rekening, Nama Rekening | `bank_*` | apa adanya, termasuk dompet digital |
| Kontak Darurat | `emergency_contact_name` | apa adanya |
| Cabang | penempatan awal | Back Office → Gudang; Raja Petshop → Toko Raja; Markas Petshop → Toko Markas; lainnya sama nama (keputusan owner) |
| Jabatan | penempatan awal | Owner → Pemilik; Helper → "Belum ditentukan" (§3); lainnya sama nama |
| Tipe Karyawan | `work_status` | training → TRAINING; permanent, driver → EMPLOYEE |

Tidak dimuat: No, Kode Karyawan, NIK, Status, Departemen (ikut jabatan), tanggal/alasan nonaktif, hubungan kontak darurat, bonus, kasbon,
loyalitas, fingerprint, jam khusus, denda, lembur, gaji flat, bisa driver/helper, kompensasi libur, foto, dibuat pada.
Bagian fingerprint dan absensi dibaca lagi dari Excel saat L3.

## 3. Jabatan "Belum ditentukan"

Owner meminta jabatan yang tidak ada dibiarkan kosong. `placements.position_id` wajib dan hak akses mengikuti jabatan, jadi
"kosong" diwujudkan sebagai jabatan **Belum ditentukan** (migrasi 0007, Team Gudang, hanya hak diri sendiri), bukan mengubah
kolom menjadi boleh kosong. Owner menggantinya lewat Catat Penempatan.

## 4. Cara muat

Skrip sekali pakai membaca Excel di komputer pengerja, memakai aturan validasi yang sama dengan layar, semua-atau-tidak sama
sekali, melaporkan baris + sebab bila ada yang salah; `source = LEGACY`, tercatat di jejak. Tidak aman diulang tanpa pemeriksaan: skrip menolak bila sudah ada karyawan `LEGACY`. Karyawan fixture yang sudah ada di staging tidak disentuh.

## 5. Tes dan uji

Tes aturan pemetaan; integrasi DB: 25 baris masuk, satu baris salah membatalkan semua, nonaktif tidak ikut, kolom kosong tetap kosong.
Uji owner: Daftar Karyawan di staging berisi 25 orang, cocok dengan Excel.

## 6. Klaim

`docs/claim-hris-l2g`: `packages/hris-db/**` (kunci `hris`), `apps/hris/changelog.d/**`, skrip muat. Branch `feat/hris-l2g-load`.
