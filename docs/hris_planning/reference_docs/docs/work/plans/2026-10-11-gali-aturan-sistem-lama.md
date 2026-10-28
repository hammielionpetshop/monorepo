# Plan: gali aturan dari sistem lama

Backlog: `../backlog/2026-10-11-gali-aturan-sistem-lama.md`

Satu bab dikerjakan dalam satu sesi. Jangan mengerjakan dua bab sekaligus.

Urutan bab mengikuti `2026-10-11-peta-jalan-v3.md` (Tahap 2). Logistik dikerjakan
sebelum Gaji Driver, karena upah ritase dihitung dari perjalanan di Logistik.
Tiap bab melewati tiga langkah: gali, diskusi dengan pemilik, lalu tetapkan.

## Daftar bab

| Bab | Modul | Hasil | Status |
|---|---|---|---|
| 0 | Peta sistem | `hris-app/docs/sistem/00-PETA-SISTEM.md` | Selesai |
| 1 | Data induk | `docs/aturan/01-karyawan.md` | **Ditetapkan** 11 Oktober 2026 |
| 2 | Kehadiran | `docs/aturan/02-kehadiran.md` | **Ditetapkan** 12 Oktober 2026 (KEH-01 s.d. 79). Galian dan jawaban pemilik di `docs/aturan/arsip/02-kehadiran-galian.md` |
| 3 | Gaji bulanan | `docs/aturan/03-gaji.md` | **Ditetapkan** 12 Oktober 2026 (GAJ-01 s.d. 57). Galian dan jawaban pemilik di `docs/aturan/arsip/03-gaji-galian.md` |
| 4 | Logistik | `docs/aturan/04-logistik.md` | **Ditetapkan** 12 Oktober 2026 (LOG-01 s.d. 88). Lima bagian disetujui 12 Oktober 2026: 4A toko dan rencana kirim, 4B perjalanan dan muat, 4C nota, uang, dan retur, 4D grooming dan laporan, 4E penetapan. Galian di `docs/aturan/arsip/04-logistik-galian.md`.  |
| 5 | Gaji driver, borongan, kasbon | `docs/aturan/05-gaji-driver-kasbon.md` | **Ditetapkan** 12 Oktober 2026 (DRV-01 s.d. 84). Lima bagian disetujui 12 Oktober 2026: 5A gaji driver, 5B borongan, 5C kasbon, 5D jenis upah dan jadwal bayar, 5E penetapan. 5A **selesai dibahas** 12 Oktober 2026 (17 aturan di 5A.10). 5B **selesai dibahas** 12 Oktober 2026 (24 aturan di 5B.10). 5C **selesai dibahas** 12 Oktober 2026 (29 aturan di 5C.10). 5D **selesai dibahas** 12 Oktober 2026 (14 aturan di 5D.10). 5E selesai 12 Oktober 2026. Galian di `docs/aturan/arsip/05-gaji-driver-kasbon-galian.md` |
| 6 | Keuangan | `docs/aturan/06-keuangan.md` | **Ditetapkan** 12 Oktober 2026 (KEU-01 s.d. 123). Bagian yang dikerjakan: 6A kas harian, 6B Laporan Kasir dan uang pengiriman, 6C pembelian, supplier, HPP, piutang, 6D1 modal, aset, biaya tetap, sewa aset Owner, 6D2 arus kas, laporan, dashboard, 6E1 mencocokkan dan memberi nomor, 6E2 menulis buku aturan. Galian di `docs/aturan/arsip/06-keuangan-galian.md` |
| 7 | KPI, tugas, meeting, rekrutmen | `docs/aturan/07-kinerja-rekrutmen.md` | **Ditetapkan** 13 Oktober 2026 (KIN-01 s.d. 51, tanpa rekrutmen). Empat bagian disetujui 12 Oktober 2026: 7A penilaian dan target (KPI, Ranking, Penjualan Promo), 7B Tugas Harian dan Catatan Meeting, 7C Rekrutmen, 7D penetapan. 7A **sudah digali dan dijawab** 12 Oktober 2026 (KIN-A01 s.d. A36, 25 aturan di 7A.10), butir penutup A–D disetujui, **7A selesai dibahas**. 7B **sudah digali dan dijawab** 12 Oktober 2026 (KIN-B01 s.d. B41, 23 aturan di 7B.10), **7B selesai dibahas**; 7D selesai 13 Oktober 2026. 7C (Rekrutmen) **ditangguhkan** pemilik 12 Oktober 2026. Galian di `docs/aturan/arsip/07-kinerja-rekrutmen-galian.md` |
| (lanjutan) | Rancangan lintas modul dan spec | Tahap 3 dan 4 di peta jalan | Belum |

## Langkah untuk satu bab

1. Baca bagian modul itu di `00-PETA-SISTEM.md` untuk tahu tabel dan halamannya.
2. Baca sumbernya di sistem lama, ketiga lapis:
   - halaman dan komponen di `hris-app/app/` dan `hris-app/components/`
   - fungsi di `hris-app/lib/` dan `hris-app/app/api/`
   - tabel, fungsi, trigger, dan kebijakan akses di database
3. Tulis buku aturannya memakai format di bawah.
4. Tambahkan istilah baru ke `docs/aturan/00-kamus-istilah.md`.
5. Perbarui tabel status di file ini, `docs/aturan/README.md`, `docs/work/WIP.md`,
   dan `CHANGELOG.md`.
6. Laporkan ke pemilik: jumlah aturan yang ditemukan, daftar pertanyaan, dan
   tumpang tindih yang paling penting.

## Kalau sambungan database terputus

Bab tetap ditulis dari kode dan file migrasi, dengan tanda "(perlu dicek ke
database)" pada aturan yang bergantung pada database. Bab itu baru dianggap
lengkap setelah tanda-tanda itu diperiksa pada sesi yang sambungannya hidup.

## Batasan

- Sistem lama hanya dibaca. Tidak ada file di `hris-app/` yang diubah.
- Database Supabase (project `rwzerjfzazhpcnfktgax`) hanya dibaca, dan hanya
  strukturnya: tabel, kolom, fungsi, trigger, kebijakan akses. Isi data karyawan
  (nama, gaji, nomor) tidak dibuka. Jumlah baris boleh dihitung untuk mengetahui
  apakah sebuah tabel masih dipakai.
- Tidak ada commit atau push tanpa diminta pemilik.
- Kalau sebuah aturan tidak jelas dari kode, tulis sebagai pertanyaan. Jangan menebak.

## Format buku aturan

```markdown
# Buku Aturan: <Modul>

Status: draf, menunggu koreksi pemilik
Digali dari sistem lama pada: <tanggal>

## 1. Modul ini mengurus apa
<2–4 kalimat bahasa bisnis>

## 2. Data yang dimiliki modul ini
| Data | Isinya | Di sistem lama disimpan di |

## 3. Aturan
| No | Aturan | Sumber di sistem lama | Keputusan |
|---|---|---|---|
| KAR-01 | <satu aturan, satu kalimat bahasa bisnis> | <file atau tabel> | |

Kolom "Keputusan" dikosongkan. Pemilik mengisinya: bawa, ubah, atau buang.

## 4. Menu dan sub menu di sistem lama
| Menu | Sub menu | Dipakai untuk apa | Mirip dengan menu lain? |

## 4b. Tumpang tindih yang ditemukan
<konsep yang disimpan atau dihitung di lebih dari satu tempat, dan di mana saja>

## 4c. Kejadian di lapangan dan jalan keluarnya
| Kejadian | Di sistem lama ditangani bagaimana | Ada jalan keluar? |
<salah isi, pembatalan, pengulangan, koreksi setelah disetujui, dan sejenisnya>

## 5. Pertanyaan untuk pemilik
<bernomor; hal yang tidak bisa diputuskan dari kode>

## 6. Usulan untuk v3
<bagaimana modul ini sebaiknya disusun; ini usulan, bukan keputusan>
```

Awalan nomor aturan: KAR (karyawan), KEH (kehadiran), GAJ (gaji), DRV (gaji driver
dan kasbon), LOG (logistik), KEU (keuangan), KIN (kinerja dan rekrutmen).
