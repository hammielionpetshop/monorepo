# 08 — Logistik Minimal (Langkah L6)

Bukan modul v3 utuh. Keputusan owner 2026-10-29: driver & kenek ikut HRIS, dan ritasenya dicatat
lewat **Logistik minimal di schema sendiri** supaya Logistik tidak menjadi bagian utama HRIS.
Sumber aturan: buku `04-logistik.md` (LOG-18, 22, 24 s.d. 36), `02-kehadiran.md` bagian 3.17 & 3.21
(KEH-96 s.d. 101, 120 s.d. 124), `05-gaji-driver-kasbon.md` DRV-14 s.d. 18.

## 1. Tujuan

- Mencatat **trip** truk gudang beserta awaknya, supaya **ritase** lahir sekali per trip (DRV-14).
- Menjadi **absen** driver & kenek yang dibayar per ritase: absen masuk = Berangkat, absen pulang =
  lapor sampai garasi (KEH-96).

## 2. Batas modul

- Schema **`logistik`** milik package `logistik` (01 §1). HRIS **hanya membaca** lewat dua view:
  - `v_ritase`: orang, tanggal trip, mobil, rute, peran (driver/kenek), berkenek atau tidak, jenis
    (ritase/belanja), status batal.
  - `v_absen_trip`: orang, tanggal, jam berangkat, jam lapor garasi, ditutup kantor atau tidak.
- Pemilik data mengikuti v3: **mobil, rute, trip, ritase milik Logistik**; tarif ritase, denda, dan
  slip mingguan milik Gaji Driver (09).
- Layarnya sementara menumpang di app HRIS dalam kelompok menu **"Logistik"**, dan bisa dipindah ke
  app Logistik kelak tanpa memindah data.

## 3. Isi

| Data | Isi minimal |
|---|---|
| Mobil, Rute | Nama, aktif/nonaktif (tidak dihapus, LOG-18); rute punya jenis biasa/belanja (LOG-17) |
| Trip | Mobil, rute, tanggal (= tanggal berangkat, jam server), status Draft / Berjalan / Selesai / Dibatalkan, jam & foto awak saat Berangkat, jam & lokasi lapor garasi, ditutup kantor + alasan + foto |
| Awak trip | Karyawan HRIS sebagai driver atau kenek (izin menyetir/kenek KAR-05, 64, 65) |
| Ritase | Dicatat server sekali saat trip selesai, satu baris per awak; batal hanya oleh pemilik dengan alasan (DRV-14, 15) |

| Layar | Dipakai | Isi |
|---|---|---|
| **Trip** (PC & HP) | Kepala Gudang, Pemilik, GM | ✅ Buat trip langsung (pilih mobil, rute, awak) tanpa rencana kirim; ganti awak sebelum selesai (LOG-22); batalkan selagi Draft dengan alasan (LOG-23); tutup atas nama driver (LOG-30); daftar trip belum lapor garasi sampai 12.00 hari berikutnya (LOG-31) |
| **Trip Saya** (HP) | Driver, Kenek | Lihat trip yang menugaskan dirinya; **Berangkat** dengan satu foto awak = absen masuk seluruh awak (LOG-25, KEH-97); **Sampai Garasi** wajib di titik gudang = absen pulang (LOG-29, KEH-98) |
| **Absen Trip Hari Ini** (KEH-L19) | Kepala Gudang, HR, Pemilik, GM | Dari 4D-2c v3 |
| **Mobil & Rute** | Pemilik, GM, Kepala Gudang | Daftar dasar |

Dibawa juga dari v3: telat & lembur tidak dihitung untuk absen lewat trip (KEH-99); dua trip sehari =
dua penutupan (KEH-98); trip yang ditutup kantor tidak dikenai denda lupa absen (KEH-101).

## 4. Tidak masuk Fase 1

Rencana kirim, surat jalan, toko, urutan & proses toko (LOG-26 s.d. 28), laporan muat, nota, retur,
bensin & foto amper, keadaan mobil, Laporan Pulang driver bagian mobil/bensin, antar sendiri, posisi
di peta.

## 5. Kriteria selesai

- Satu trip dibuat Kepala Gudang → Berangkat dari HP driver → Sampai Garasi di gudang → ritase
  tercatat sekali per awak → terbaca di `v_ritase`.
- Dua trip sehari menghasilkan dua ritase dan absen pulang pada lapor garasi terakhir.
- Tes membuktikan HRIS tidak bisa menulis schema `logistik`.

## 6. Pertanyaan terbuka

- ❓ Daftar mobil & rute saat ini, dan 23 tarif lama (DRV-08) untuk data awal L7.
