# 05 — Kehadiran (Langkah L3)

Sumber v3: buku `02-kehadiran.md` (KEH-01 s.d. 167), spec `2026-10-13-kehadiran-spec.md` (4D).
✅ Cara absen ikut v3: **scan QR cabang → lokasi diperiksa server → foto diri dari kamera langsung**.

## 1. Tujuan

Mencatat siapa bekerja di mana dan jam berapa setiap hari, beserta libur, izin, sakit, cuti, dan
lembur. Modul Gaji membaca hasilnya; modul ini tidak menghitung rupiah.

## 2. Lingkup per bagian spec v3

| Bagian | Isi | Layar | Fase 1 |
|---|---|---|---|
| 4D-1 | Jam kerja cabang, jadwal & giliran shift, lokasi & QR, hari tutup, Jadwal Saya | KEH-L01 s.d. L05 | **L3** |
| 4D-2a | Absen (Masuk, Istirahat, Masuk Kembali, Pulang), perbantuan, sudah pindah cabang? | KEH-L06 s.d. L11 | **L3** |
| 4D-2b | Tinjau absen, koreksi, foto absen hari ini, catatan hari kerja, rekap, Kehadiran Saya | KEH-L12 s.d. L17 | **L3** |
| 4D-2c | Absen lewat trip (driver & kenek per ritase) | KEH-L18, L19 | **L6** (08) |
| 4D-3 | Laporan Pulang: serah terima & laporan masalah rahasia | KEH-L20 s.d. L24 | **L3**, tanpa keadaan mobil |
| 4D-3 | Keadaan Mobil | KEH-L25 | Tidak (Logistik penuh) |
| 4D-4a | Pilih libur, libur cabang, tukar libur/shift, minta masuk di hari libur | KEH-L26 s.d. L29 | **L3** |
| 4D-4b | Izin, sakit, cuti, sisa cuti, surat dokter menyusul, isikan atas nama | KEH-L30 s.d. L34 | **L3** |
| 4D-5a | Perlu Dijelaskan, pengajuan terlambat, laporan kebiasaan lupa absen | KEH-L35 s.d. L39 | **L3** |
| 4D-5b | Ini lembur?, klaim lembur, lembur tim | KEH-L40 s.d. L43 | **L3** |

💡 L3 dikerjakan per bagian dengan urutan di atas (satu bagian = satu plan di `docs/work/plans/`).

## 3. Ringkasan aturan inti (rincian di buku v3)

- **Jam kerja milik cabang**, bertanggal berlaku; kantor & gudang dianggap cabang (KEH-01 s.d. 04).
- **Jam kerja satu hari mengikuti cabang tempat absen masuk** (KEH-08) ✅. Shift digilir otomatis
  tiap Senin (KEH-05, 06) dan tidak pernah ditebak dari jam datang (KEH-07).
- **Absen**: QR dicetak per cabang; lokasi dalam radius (awal 100 m); di luar radius tetap dihitung
  dengan tanda "perlu ditinjau" (KEH-10 s.d. 19). Foto hanya dari kamera, disimpan tertutup 60 hari
  (KEH-15). Absen pulang paling cepat 15 menit setelah masuk; pulang sampai 04.00 masuk hari
  sebelumnya (KEH-17, 18).
- **Libur** 4 hari per periode, dipilih sendiri; batas per cabang & akhir pekan (KEH-31 s.d. 35);
  hari tutup (KEH-79).
- **Izin/sakit/cuti** (KEH-36 s.d. 51), **penjelasan dalam 3 hari** (KEH-56 s.d. 69), **lembur**
  diklaim dengan foto kertas + penyuruh (KEH-70 s.d. 75).
- **Koreksi** hanya lewat satu pintu oleh HR/pemilik, catatan asli tidak ditimpa (KEH-28, 29).
- **Status hari kerja** satu dari: Hadir, Libur terjadwal, Hari tutup, Izin, Sakit, Cuti, Alpha,
  Tidak jalan (KEH-81).
- Istilah: "shift" di HRIS = **jam kerja cabang**, berbeda dari **shift kasir** POS (buka–tutup kas).
  Ditulis di glosarium saat L3.

## 4. Penyesuaian monorepo

- **Foto** di penyimpanan tertutup HRIS (01 §6), dikompres di HP.
- **Mesin terjadwal** (01 §7): tandai alpha harian (KEH-52), gilir shift Senin (KEH-06), tanda 7 hari
  tidak masuk (KEH-55), hapus foto 60 hari (KEH-15), pengingat batas penjelasan & klaim (KEH-58, 72).
- **Pemberitahuan** lewat Pemberitahuan dasar (03 §2); pengingat berantai v3 menyusul.
- **Pengajuan** (izin, tukar, penjelasan, klaim lembur) lewat Mesin Pengajuan (03).
- Laporan Pulang tidak menanyakan keadaan mobil maupun bensin di Fase 1.

## 5. Kriteria selesai

- Absen QR + lokasi + foto berhasil di HP sungguhan (Android & iPhone) di minimal dua cabang,
  termasuk kasus di luar radius dan perbantuan.
- Jadwal satu periode terisi; giliran Senin berjalan otomatis.
- Satu periode 26–25 data HRIS lama diuji banding: status hari, telat, lembur disahkan, alpha.
- Tes aturan untuk telat, lembur, alpha, batas libur, dan perhitungan cuti, masing-masing menyebut
  nomor KEH-nya.

## 6. Pertanyaan terbuka

- ❓ Jam kerja & shift tiap cabang saat ini (diisi sebagai data awal L3).
- ❓ Titik lokasi tiap cabang: diambil dari HRIS lama atau dipasang ulang di lokasi?
