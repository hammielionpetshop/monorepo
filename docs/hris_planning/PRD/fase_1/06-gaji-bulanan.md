# 06 — Gaji Bulanan (Langkah L4)

Sumber v3: buku `03-gaji.md` (GAJ-01 s.d. 114), spec `2026-10-13-gaji-bulanan-spec.md` (4E).

## 1. Tujuan

Slip bulanan semua orang berupah bulanan dihitung sistem dari data modul lain, ditutup, dan dibayar.
Mesin slip yang sama dipakai slip mingguan driver & kenek di L7.

## 2. Lingkup per bagian spec v3

| Bagian | Isi | Layar | Fase 1 |
|---|---|---|---|
| 4E-1 | Komponen gaji per orang, jenis komponen, Gaji Standar, pengaturan gaji, Aturan Potongan | GAJ-L01 s.d. L07 | **Masuk** |
| 4E-2 | Periode gaji, hitungan kehadiran, tiadakan potongan, koreksi periode lalu | GAJ-L08 s.d. L11 | **Masuk** |
| 4E-3 | Kehilangan barang, minus kas, potongan lain, keberatan potongan | GAJ-L12 s.d. L19 | **Masuk, minus kas disesuaikan** (§3.1) |
| 4E-4 | Buku Bonus, Persetujuan Bonus, bonus bebas, jenis bonus, Dana Disiplin & Tidak Hadir | GAJ-L20 s.d. L27 | **Masuk, bonus dibatasi** (§3.2) |
| 4E-5a | Halaman periode, slip, tutup, buka kembali, cetak | GAJ-L28 s.d. L32 | **Masuk** |
| 4E-5b | Jadwal bayar, bayar, batal bayar, daftar transfer, bayar di luar slip, ringkasan | GAJ-L33 s.d. L38 | **Masuk, bayar disesuaikan** (§3.3) |
| 4E-5c | Pendapatan Saya, Slip Saya, keberatan slip, total diterima per orang | GAJ-L39 s.d. L43 | **Masuk** |

## 3. Penyimpangan dari v3

### 3.1 Minus kas dari shift POS ✅
- v3 (GAJ-20): minus kas ditanggung orang yang menutup shift, bersumber dari Laporan Kasir milik
  Keuangan.
- Fase 1: sumbernya **selisih shift POS** lewat view `v_selisih_kas` (01 §4): `shifts.total_variance`,
  `closed_by_id`, `closed_at`, status shift, dan daftar kasir yang bertugas di shift itu
  (`shift_cashier_breakdown`, `shift_cashier_sessions`).
- **Fakta data POS (dicek di produksi 2026-10-29):**
  - Uang fisik dihitung **sekali per shift** (satu laci). Selisih hanya diketahui per shift; kolom
    `shift_cashier_breakdown.variance` & `real_cash` **selalu kosong** (0 dari 535 baris). Tidak ada
    data selisih per kasir.
  - Dari 363 shift tertutup, **136 (37%) melibatkan lebih dari satu kasir**.
  - 274 shift ditutup KASIR, 45 oleh GM, 26 oleh OWNER.
  - Ada 19 shift dengan minus **di atas Rp1 juta** (total ±Rp734 juta, terbesar ±Rp181 juta). Ini
    hampir pasti salah input atau masalah hitungan Kas Expected, bukan uang hilang. Minus yang wajar
    (≤ Rp1 juta) ada 54 shift, total ±Rp1,55 juta.
- Akibatnya:
  - Minus dari POS **tidak langsung menjadi potongan.** Setiap minus masuk sebagai **usulan potongan**
    yang ditinjau HR, lalu disahkan Owner/GM (pola GAJ-L15 & GAJ-81). Minus di atas ambang (pengaturan,
    awal Rp1 juta) ditandai "periksa dulu, kemungkinan salah input".
  - ❓ **Penanggung minus**: pertanyaan pending — lihat §3.1a.
- Yang dibaca hanya shift yang sudah ditutup. Tanggal kejadian = tanggal tutup shift; periode
  mengikuti tanggal itu (GAJ-38).
- Kelebihan kas hanya menutup minus, tidak menjadi tambahan gaji (GAJ-20).
- Keberatan atas minus kas memakai **Keberatan Potongan** (GAJ-L18), karena "keberatan kekurangan
  kas" v3 milik Keuangan.
- "Minus kas catat tangan" untuk kejadian di luar shift tetap ada (GAJ-L15).

### 3.1a Siapa menanggung minus shift ❓ PENDING

✅ (2026-10-29) Owner menjadikan ini **pertanyaan pending**, karena tiap pilihan membawa aturan
berbeda. Sampai diputuskan, minus kas dari POS hanya tampil sebagai **usulan yang ditinjau** dan
tidak dibebankan otomatis ke siapa pun. Penanggungnya ditetapkan manual oleh Owner/GM saat
mengesahkan. Keputusan ini harus diambil sebelum L4 (Gaji) dianggap selesai.

| Pilihan | Cara | Kelebihan | Kekurangan |
|---|---|---|---|
| A. Penutup shift (bunyi GAJ-20 v3) | Seluruh minus ditanggung yang menekan tutup shift | Paling sederhana | Tidak adil bila kasir lain ikut bertugas; 71 shift ditutup GM/OWNER (Pemilik tidak menanggung, GAJ-09) |
| B. Dibagi ke kasir yang bertugas | Rata, atau sebanding penjualan tunai tiap kasir di shift itu | Tanpa mengubah POS; sejalan "minus tanpa nama dibagi rata" GAJ-20 | Kasir yang tidak salah ikut menanggung |
| C. Hitung uang per kasir di POS | Kasir yang berhenti di tengah shift menghitung & menyerahkan laci (serah terima kas), sehingga selisih per kasir benar-benar ada | Paling tepat | Mengubah POS dan cara kerja kasir; pekerjaan di backoffice, bukan HRIS |

Catatan analisa (belum keputusan): B bisa dipakai tanpa mengubah POS; C paling tepat tetapi menjadi
pekerjaan POS tersendiri.

### 3.2 Bonus ✅
- Jenis bonus Fase 1: **grooming** (GAJ-61), **ongkir** (LOG-76), dan **bonus bebas**. Bonus promo
  dan Bonus Terukur/bersyarat menyusul bersama Kinerja.
- **Bonus grooming**: setiap jasa grooming yang sudah diambil di kasir menjadi satu baris Buku Bonus
  untuk groomer di nota itu = persen (awal 10%) × harga jasa sesudah diskon, dibulatkan ke bawah
  (GAJ-61). Rumus nilai bersih baris memakai fungsi bersama dengan backoffice (01 §4), sehingga
  angka di slip = angka bonus di laporan kasir.
- **Bonus ongkir** 💡: dicatat modul Gaji langsung dari data kasir, mengikuti isi LOG-76 (pengantar
  di nota, persen × ongkir sesudah diskon, bukan gratis ongkir, tanggal & cabang nota). Di v3 ini
  milik Logistik; dipindah karena Logistik penuh tidak ada di Fase 1.
- Baris dibentuk mesin terjadwal dari view, **idempoten** (nota yang sama tidak menghasilkan baris
  dua kali). Nota yang belakangan dibatalkan/diretur membatalkan baris bonusnya dengan alasan
  otomatis; kalau slipnya sudah ditutup, koreksinya masuk periode berikutnya (GAJ-50).
- Groomer/pengantar yang belum dipasangkan ke karyawan (04 §3.3) → bonusnya menunggu.

### 3.3 Membayar ✅
- v3 mencatat pembayaran ke Buku Kas Keuangan (GAJ-48, 56; KEU-24).
- Fase 1: **HRIS menyimpan sendiri** tanggal bayar (server), pembayar, sumber uang (pilihan dari
  daftar sederhana di Pengaturan), dan foto bukti transfer. Bentuknya disiapkan supaya kelak bisa
  diteruskan ke app Keuangan tanpa mengubah slip.
- Daftar Transfer untuk Finance (GAJ-100) tetap ada.
- Dana Disiplin & Dana Tidak Hadir (GAJ-33 s.d. 35) tetap dihitung, tetapi hanya tampil di HRIS.

### 3.4 Lain-lain
- Kehilangan barang (GAJ-17 s.d. 19) diisi manual seperti v3. 💡 Kelak bisa bersumber dari hasil
  stock opname POS (backlog, bukan Fase 1).
- Tidak ada BPJS, PPh 21, THR ✅.

## 4. Kriteria selesai

- Satu periode 26–25 dihitung dari data nyata (kehadiran L3, minus kas POS, bonus grooming & ongkir)
  dan diuji banding dengan slip HRIS lama; setiap selisih masuk daftar beda dan dijelaskan.
- Slip: Perkiraan → Ditutup → Dibayar → batal bayar → dibuka kembali, tanpa mengubah data mentah
  (GAJ-37, 47 s.d. 51).
- Gaji bersih tidak pernah minus; sisa potongan terbawa (GAJ-52).
- Bonus grooming satu periode = total bonus jasa di laporan kasir untuk periode yang sama.
- Hak lihat sesuai GAJ-46: Finance hanya total; Admin HR tanpa nominal; gaji Pemilik/GM hanya oleh
  kedua jabatan itu.

## 5. Pertanyaan terbuka

- ❓ Penanggung minus kas (§3.1a) dan ambang "periksa dulu" (awal Rp1 juta).
- ❓ Daftar "sumber uang" untuk pembayaran (mis. Brankas, rekening BCA, …).
- ❓ Persen bonus ongkir saat ini (pengaturan awal).
