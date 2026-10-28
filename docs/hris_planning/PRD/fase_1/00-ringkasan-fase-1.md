# 00 — Ringkasan Fase 1

## 1. Latar belakang

- Hammielion sudah punya HRIS lama (absen selfie, gaji) yang menjadi penunjang operasional.
- Masalah utamanya ✅: **aplikasinya tumpang tindih — kode dan modul tercampur**. Setiap perubahan
  lambat dan berisiko.
- Owner sudah menyusun rancangan ulang lengkap, **HRIS v3** (`../../reference_docs/`): buku aturan,
  spec layar, dan menu yang ditetapkan 11–14 Oktober 2026. Kode v3 di repo lain **tidak dipakai**
  karena tidak konvensional dan tidak efisien ✅.
- HRIS baru dibangun di monorepo ini, bersebelahan dengan backoffice/POS, supaya data kasir
  (kasir, selisih kas, grooming, ongkir, supplier, produk) bisa dibaca langsung tanpa tarik data.

## 2. Tujuan Fase 1

1. **Absensi** semua karyawan berjalan di HP: QR cabang + lokasi + foto, libur, izin/sakit/cuti,
   penjelasan, dan lembur, mengikuti aturan v3.
2. **Penggajian** berjalan sampai dibayar: slip bulanan (26–25, dibayar tanggal 1), slip mingguan
   driver & kenek (dibayar Sabtu), kasbon, dan bongkaran.
3. **Struktur yang jelas** sehingga iterasi berikutnya cepat: satu modul = satu folder aturan + satu
   schema/batas data; modul lain hanya membaca lewat pintu yang jelas.
4. **Satu akun untuk semua app internal** (backoffice, HRIS, kelak Keuangan).

## 3. Ukuran berhasil

- Satu periode gaji 26–25 dari data nyata dihitung di HRIS baru dan dibandingkan dengan HRIS lama;
  setiap selisih punya penjelasan (uji banding, SIS-14 s.d. 16).
- Semua karyawan yang diabsen bisa absen dari HP sendiri di semua cabang.
- Slip bulanan dan mingguan bisa ditutup, dibayar, dan dibuka kembali tanpa mengubah data mentah.
- Tidak ada satu pun tulisan lintas modul di luar pintu yang terdaftar (diperiksa lint & tes).
- Login backoffice tetap sama bagi kasir setelah auth terpusat tayang.

## 4. Pengguna

Jabatan mengikuti v3 (`00-peta-modul.md`): Pemilik, GM, HR (saat ini dirangkap GM), Admin HR,
Finance, Marketing, Kepala Gudang, Driver, Kenek, Kepala Toko, Kasir, Pramuniaga, Groomer.
Karyawan toko, driver, dan kenek memakai **HP**; orang kantor memakai PC dan HP (SIS-03).

## 5. Lingkup

**Masuk Fase 1**

| Modul | PRD | Sumber v3 |
|---|---|---|
| Auth terpusat (baru, bukan v3) | [02](02-auth-terpusat.md) | — (pelapis KAR-69) |
| Perlengkapan Bersama (sebagian) | [03](03-perlengkapan-bersama.md) | spec 4B |
| Karyawan & Akses | [04](04-karyawan-dan-akses.md) | Bab 1, spec 4A |
| Kehadiran | [05](05-kehadiran.md) | Bab 2, spec 4D |
| Gaji Bulanan | [06](06-gaji-bulanan.md) | Bab 3, spec 4E |
| Kasbon | [07](07-kasbon.md) | Bab 5 bagian 3.9–3.14, spec 4G-4 |
| Logistik minimal (trip & ritase) | [08](08-logistik-minimal.md) | sebagian Bab 4; KEH 3.17 |
| Gaji Driver & Bongkaran | [09](09-gaji-driver-dan-bongkaran.md) | Bab 5, spec 4G-1 s.d. 4G-3 |

**Tidak masuk Fase 1** ✅

- App **Keuangan** dan semua laporan keuangan (termasuk penarikan data penjualan untuk owner).
- **Kinerja** (rapor, Bonus Terukur, bonus promo, tugas, Catatan Rapat) dan **rekrutmen**.
- **Logistik penuh**: rencana kirim, surat jalan, toko, muat, nota, retur, bensin, keadaan mobil,
  antar sendiri.
- **BPJS, PPh 21, THR** (tidak diatur v3).
- **Fitur pendukung v3**: Papan Perubahan Aturan, pengumuman darurat, pengingat berantai, Kesehatan
  Mesin, Riwayat Error, tempat uji & "Lihat sebagai", Panduan Karyawan, Pedoman Lapor.
- **Fitur import Excel/CSV** (data awal dimuat sekali lewat skrip; fitur import menyusul).
- Pemrosesan data mesin fingerprint.

## 6. Prinsip yang mengikat semua modul

1. **Aturan v3 berlaku** kecuali disebut lain di PRD ✅.
2. **Tidak ada edit/hapus** untuk data absen, uang, dan keputusan; koreksi lewat langkah baru yang
   tercatat & beralasan (PRI-02, glosarium monorepo).
3. **Satu data satu pemilik** (WAJ-03): modul lain hanya membaca.
4. **Satu rumus satu tempat** (WAJ-04): rumus berupa fungsi murni bertes yang merujuk nomor aturannya.
5. **Angka bisnis = pengaturan bertanggal berlaku** (WAJ-07), tidak ditulis di kode.
6. **Tidak ada nama jabatan, cabang, atau orang di kode** (WAJ-05); perilaku dibaca dari Pengaturan
   Jabatan dan hak akses.
7. **Jam server**, zona WIB; periode gaji 26–25 dihitung di satu fungsi (PRI-22).
8. **Uang integer rupiah**, dihitung dengan big.js (konvensi monorepo).
9. **Bahasa Indonesia sederhana**, semua layar bisa dipakai di HP (SIS-03).

## 7. Urutan langkah

| Langkah | Isi | PRD | Bergantung pada |
|---|---|---|---|
| **L0** | Pondasi: app `hris`, schema & migrasi, role DB, batas modul, komponen dasar UI, mesin terjadwal, deploy | 01 | — |
| **L1** | Auth terpusat (dikerjakan di backoffice lebih dulu) | 02 | L0 |
| **L2** | Perlengkapan Bersama + Karyawan & Akses + Akun & Tautan + muat data awal karyawan | 03, 04 | L1 |
| **L3** | Kehadiran (4D-1 s.d. 4D-5b, tanpa absen lewat trip) | 05 | L2 |
| **L4** | Gaji Bulanan (4E-1 s.d. 4E-5c) | 06 | L3 |
| **L5** | Kasbon (4G-4a, 4G-4b) | 07 | L4 |
| **L6** | Logistik minimal + absen lewat trip (4D-2c) | 08 | L3 |
| **L7** | Gaji Driver: tarif ritase, slip mingguan, denda (4G-1, 4G-2) | 09 | L4, L5, L6 |
| **L8** | Bongkaran (4G-3a, 4G-3b) | 09 | L4 |
| **L9** | Penutup: uji banding satu periode penuh, muat data awal final (gaji, sisa kasbon, saldo dana), latihan pindah | 00 | L1–L8 |

L5 dan L6 bisa berjalan bersamaan; L8 bisa maju setelah L4.

## 8. Definisi selesai satu langkah

Mengikuti SIS-10 v3, disesuaikan:
1. Tes mesin lulus, termasuk tes hak akses per jabatan untuk setiap pintu baru (WAJ-06).
2. `pnpm typecheck`, `pnpm lint`, `pnpm test` hijau di CI.
3. Dicoba owner di lingkungan uji (❓ staging, dibahas nanti).
4. Untuk langkah yang menghasilkan angka (L3, L4, L5, L7, L8): diuji banding dengan data HRIS lama.
5. `docs/work/WIP.md`, `docs/agents/claims.md`, dan potongan changelog diperbarui.

## 9. Penyimpangan dari v3 (gabungan)

| Hal | v3 | Fase 1 | Alasan / keputusan |
|---|---|---|---|
| Kode | Repo v3 sendiri | Ditulis ulang di monorepo dari aturan v3 | ✅ kode v3 tidak efisien |
| Akun | Akun HRIS sendiri, email + password (KAR-69) | **Auth terpusat** untuk semua app internal | ✅ |
| Pendaftaran | Daftar mandiri, disetujui HR (KAR-60) | **Akun hanya dibuat Owner/GM** | ✅ |
| Data karyawan awal | Diisi sendiri saat daftar ulang (SIS-24) | **Diekspor dari DB lama, dimuat sekali**; fitur import menyusul | ✅ |
| Akun kasir | Di sistem kasir | **Dibuat dari HRIS**, disimpan backoffice lewat pintu internal | ✅ |
| Tarik Data Kasir (4C) | Modul tarik data satu arah | **Diganti view** di database yang sama | ✅ |
| Minus kas (GAJ-20) | Dari Laporan Kasir (Keuangan) | Dari **selisih shift POS** | ✅ |
| Bonus | Promo, grooming, ongkir, bebas, bersyarat | **Grooming, ongkir, bebas** | ✅ |
| Bonus ongkir (LOG-76) | Dicatat Logistik | Dicatat **Gaji** dari data kasir (seperti GAJ-61) | 💡 karena Logistik penuh tidak ada |
| Pembayaran gaji, kasbon, bongkaran | Lewat Buku Kas Keuangan (KEU-24) | **Dicatat di HRIS** (tanggal, pembayar, sumber uang, bukti) | ✅ sampai app Keuangan ada |
| Supplier & produk (bongkaran) | Daftar supplier milik Keuangan; produk dari file export | **Dibaca dari `petshop`** | 💡 |
| Trip | Lahir dari rencana kirim | **Dibuat langsung Kepala Gudang** | ✅ cukup untuk data awal |
| Fitur pendukung | Lengkap (4B) | Hanya Mesin Pengajuan, Pengaturan, Beranda & Pemberitahuan dasar | ✅ (+💡 Beranda) |
| BPJS, PPh 21, THR | Tidak ada | Tidak ada | ✅ |

## 10. Risiko

| Risiko | Penanganan |
|---|---|
| Auth terpusat merusak login kasir produksi | L1 dikerjakan terpisah, akun lama dipindah otomatis dengan hash yang sama, diuji dulu di staging; ada jalan kembali (bagian 7 di 02) |
| View ke `petshop` patah saat backoffice mengubah kolom | View menjadi kontrak tertulis; CI menjalankan semua migrasi di DB kosong; perubahan kolom yang dibaca view wajib menyentuh view-nya |
| Lokasi HP meleset / dipalsukan | Lapisan v3: QR + radius + foto + tanda "perlu ditinjau" + pola mencurigakan (KEH-12 s.d. 19) |
| Lingkup Fase 1 besar | Urutan langkah dengan bukti selesai per langkah; HRIS lama tetap jalan, tidak ada tenggat ✅ |
| Angka gaji berbeda dari HRIS lama | Uji banding per langkah; daftar beda dijelaskan sebelum pindah |
| RAM VPS | Batas RAM per container; WAHA sudah dimatikan; ukur ulang setelah L3 |

## 11. Pertanyaan terbuka

- ❓ Alur branch staging & deployment staging (sebelum L1 di-merge).
- ❓ Subdomain HRIS (mis. `hris.<domain>`).
- Pertanyaan per modul ada di bagian akhir tiap PRD.
