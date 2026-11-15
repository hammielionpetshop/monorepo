# 03 — Perlengkapan Bersama (Langkah L2)

Sumber v3: spec `2026-10-13-perlengkapan-bersama-spec.md` (4B), PRI-23, PRI-37, `00-peta-modul.md`.
✅ Owner 2026-10-29: rilis pertama hanya **Mesin Pengajuan** dan **Pengaturan**; fitur pendukung lain
menyusul.

## 1. Lingkup

| Layar v3 | Fase 1 | Catatan |
|---|---|---|
| BER-L04 s.d. L07 Pengajuan Saya, pilih jenis, isian, rincian | **Masuk** | Satu pintu semua jenis pengajuan |
| BER-L20, L21 Persetujuan, Putuskan pengajuan | **Masuk** | |
| BER-L42 Jenis Pengajuan | **Masuk** | Hanya jenis milik modul Fase 1 |
| BER-L40, L41 Pengaturan, Ubah satu pengaturan | **Masuk** | Semua angka bertanggal berlaku |
| BER-L01 Beranda, BER-L02 Pemberitahuan | **Masuk, versi dasar** 💡 | Lihat bagian 2 |
| BER-L34 Jejak Perubahan | **Datanya masuk, layarnya menyusul** | Jejak wajib tercatat dari awal (PRI-02) |
| BER-L03 pengingat berantai & pengumuman darurat | Tidak | Menyusul |
| BER-L08 s.d. L11, L22 s.d. L26 Papan Perubahan Aturan, Panduan, Pengumuman | Tidak | Menyusul |
| BER-L30 s.d. L33 Kesehatan Mesin, Riwayat Error | Tidak (catatan jalan mesin tetap disimpan, 01 §7) | Menyusul |
| BER-L50, L51 tempat uji & ganti akun contoh | Tidak | Menyusul |

## 2. Beranda & Pemberitahuan dasar 💡

Banyak aturan v3 berbunyi "orangnya diberi tahu" atau "ditandai untuk HR/pemilik" (mis. KEH-26, 45,
55, 58; DRV-63, 64). Tanpa tempat pemberitahuan, aturan itu tidak bisa dijalankan. Karena itu Fase 1
memuat versi dasar:
- **Pemberitahuan di dalam aplikasi** (daftar + tanda belum dibaca). Notifikasi HP (push) menyusul.
- **Beranda**: kartu "perlu perhatian saya" (pengajuan yang menunggu saya, penjelasan yang hampir
  lewat batas, dan sejenisnya), diisi tiap modul.

## 3. Mesin Pengajuan (PRI-23, PRI-37)

Mengikuti v3 utuh: satu jalur untuk semua jenis pengajuan (siapa mengajukan, untuk siapa, status,
penyetuju, pemeriksa, alasan, lampiran, riwayat keputusan). Isi khas tiap jenis dan akibatnya
setelah disetujui milik modul jenisnya.

Jenis pengajuan Fase 1 (daftar lengkap & aturannya: `daftar-lintas-modul` bab 1):

| Modul | Jenis |
|---|---|
| Karyawan | Ubah data identitas (KAR-66) |
| Kehadiran | Izin, sakit, cuti; tukar libur/shift; penjelasan (alpha, lupa absen, telat >30 menit, pulang cepat); pengajuan terlambat; klaim lembur |
| Gaji | Keberatan slip; keberatan potongan |
| Kasbon | Kasbon; tunda cicilan |
| Gaji Driver | Usulan denda; Laporan Bongkaran terlambat |

Batas keras KAR-72 berlaku: tidak ada yang memutuskan pengajuannya sendiri.

## 4. Pengaturan

- Setiap angka di bagian "Pengaturan dan angka awalnya" buku aturan v3 (KEH 3.13, GAJ 3.7, DRV 3.16)
  menjadi baris pengaturan **bertanggal berlaku**, dengan siapa yang boleh mengubah dan siapa yang
  mengusulkan (WAJ-07, KAR-73).
- Nilai yang berlaku pada suatu tanggal dibaca dari **satu fungsi**; rumus tidak pernah memakai angka
  yang ditulis di kode.
- Mengubah pengaturan tidak mengubah hitungan yang sudah ditutup.

## 5. Kriteria selesai

- Satu jenis pengajuan contoh berjalan dari diajukan → diperiksa → diputuskan → akibatnya tercatat,
  dengan tes hak per jabatan.
- Pengaturan bertanggal: tes membuktikan nilai lama dipakai untuk tanggal lama dan nilai baru untuk
  tanggal baru.
- Pemberitahuan muncul untuk penyetuju saat ada pengajuan baru.
