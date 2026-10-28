# Dokumen Referensi HRIS

Ini adalah directory referensi dokumen dari app HRIS yang sudah ada. Isinya dibaca untuk
dirakit menjadi PRD HRIS di monorepo ini (catatan diskusinya di `../BRAINSTORM.md`).

## Isinya apa

Folder `docs/` adalah salinan dokumen **HRIS Hammielion v3**, yaitu rancangan ulang sistem HRIS
lama dari repo lain. Ada dua sistem yang perlu dibedakan:

| Sebutan di dokumen | Artinya |
|---|---|
| **Sistem lama** | HRIS yang **dipakai sekarang** (absen selfie). Aturannya "digali" ke `aturan/arsip/*-galian.md`. |
| **v3** | Rancangan barunya. Aturan, spec, dan menunya sudah ditetapkan pemilik 11–14 Oktober 2026. Menurut `work/WIP.md` (28 Oktober 2026), v3 **sedang dibangun** di repo lain dan sudah sampai modul Keuangan. |

v3 berisi **tujuh modul**: Karyawan, Kehadiran, Gaji Bulanan, Logistik, Gaji Driver–Bongkaran–Kasbon,
Keuangan, dan Kinerja. Untuk HRIS di monorepo ini, yang relevan hanya urusan **kepegawaian, absensi,
dan penggajian**. Keuangan menjadi app tersendiri, sedangkan Logistik dan Kinerja di luar lingkup.

**Sumber utama adalah buku aturan (`aturan/`).** Spec (`work/specs/`) berisi rincian layar dan
tes, dan baru perlu dibaca saat menyusun PRD per modul. Galian (`aturan/arsip/`) hanya riwayat
sistem lama.

## A. Baca: inti HRIS

| Berkas | Isinya |
|---|---|
| `docs/aturan/01-karyawan.md` | Data induk karyawan, cabang, jabatan, akun, hak akses (KAR) |
| `docs/aturan/03-gaji.md` | Gaji bulanan: komponen, potongan, bonus, slip, periode (GAJ). Lihat juga catatan ketergantungan di bagian E |
| `docs/work/specs/2026-10-13-karyawan-dan-akses-spec.md` | Spec layar & data Karyawan dan Akses |
| `docs/work/specs/2026-10-13-hak-akses-desain.md` | Cara kerja hak akses per jabatan dan cara masuk |
| `docs/work/specs/2026-10-13-gaji-bulanan-spec.md` | Spec layar & data Gaji Bulanan (±3.300 baris; baca per bagian) |
| `docs/work/specs/2026-10-13-pengajuan-dan-laporan-desain.md` | Pola bersama pengajuan (izin, cuti, lembur, kasbon, dll.) dan persetujuannya |
| `docs/work/specs/2026-10-13-waktu-dan-uang-desain.md` | Pola bersama waktu (zona, periode) dan uang |
| `docs/work/backlog/2026-10-11-absen-qr-dan-titik-lokasi.md` | Keputusan cara absen v3 (QR + GPS + foto) dan masalah absen dari rumah |
| `docs/work/backlog/2026-10-11-pengajuan-terlambat.md` | Pengajuan yang terlambat ("Pak, saya lupa") |
| `docs/work/backlog/2026-10-11-bisa-tumbuh-dan-siap-dijual.md` | Keinginan pemilik: sistem bisa tumbuh dan "siap dijual, belum dijual" |

## B. Baca sebagian

| Berkas | Yang dibaca | Yang dilewati |
|---|---|---|
| `docs/aturan/02-kehadiran.md` | Semua bagian lain | 3.17 & 3.21 (absen lewat trip, khusus driver/kenek); bagian "keadaan mobil" di Laporan Pulang (3.16, 3.22) |
| `docs/work/specs/2026-10-13-kehadiran-spec.md` | Semua bagian lain | 3.4 (4D-2c Absen lewat Trip) dan rincian keadaan mobil di 3.5 (4D-3) |
| `docs/aturan/05-gaji-driver-kasbon.md` | 3.1 (jenis upah & jalur bayar), **3.9–3.14 dan 3.21–3.22 (kasbon)**, 3.15–3.16 bagian kasbon | 3.2–3.8 dan 3.17–3.20 (ritase, slip mingguan driver, denda driver/kenek, bongkaran) |
| `docs/work/specs/2026-10-14-gaji-driver-spec.md` | Layar **DRV-L23 s.d. L39 (kasbon, 4G-4a & 4G-4b)** beserta data, tes, dan tanya-jawabnya | 4G-1 s.d. 4G-3b (tarif ritase, upah ritase, denda, bongkaran) |
| `docs/work/backlog/2026-10-11-jenis-upah-dan-jadwal-bayar.md` | Jenis upah & jadwal bayar karyawan bulanan | Bagian khusus upah ritase/driver |
| `docs/aturan/00-gambaran-sistem.md` | Bab 1–6 (batas sistem) dan **bab 8 (data lama: apa yang dibawa saat pindah)** | Bab 7 & 9 (rencana tayang dan alat/server v3), diganti keputusan monorepo |
| `docs/aturan/00-aturan-wajib.md` | Prinsip data: WAJ-03 s.d. 07, 11, 12, 13 | WAJ-01, 02, 08, 09, 10 (cara kerja repo v3); yang berlaku adalah `CLAUDE.md` monorepo |
| `docs/aturan/00-prinsip-rancangan.md` | Prinsip waktu, jejak, upah, pengajuan (PRI) | Butir yang hanya menyangkut logistik/keuangan |
| `docs/aturan/00-pola-baku-tampilan.md` | Prinsip tampilan untuk karyawan di HP (TAM) | Komponen yang bertentangan dengan pola UI backoffice monorepo |
| `docs/aturan/00-kamus-istilah.md` | Istilah kepegawaian, kehadiran, gaji, kasbon | Istilah logistik, keuangan, kinerja |
| `docs/aturan/00-peta-modul.md` | Urutan modul, pemilik data, hak akses & menu untuk Karyawan/Kehadiran/Gaji | Baris Logistik, Keuangan, Kinerja, Tarik Data Kasir |
| `docs/work/specs/2026-10-13-peta-data-desain.md` | Data milik Karyawan, Kehadiran, Gaji | Data modul lain |
| `docs/work/specs/2026-10-14-daftar-lintas-modul.md` | Bab 1–3, hanya baris jenis pengajuan, pemberitahuan, dan pengaturan milik Karyawan/Kehadiran/Gaji/kasbon | Bab 4 (periksa silang spec v3) dan baris modul lain |
| `docs/work/specs/2026-10-13-perlengkapan-bersama-spec.md` | Mesin Pengajuan, Pengaturan, pemberitahuan, jejak perubahan | Fitur pendukung v3 yang belum tentu dibutuhkan (Papan Perubahan Aturan, Kesehatan Mesin, tempat uji); dipilih saat PRD |
| `docs/work/backlog/2026-10-11-mesin-pengaman-hak-akses.md` | Gagasan tes otomatis hak akses per jabatan | — |
| `docs/work/specs/2026-10-13-menu-desain.md` | Kebutuhan menu per jabatan (apa yang perlu dilihat siapa) | Susunan menu v3; menu HRIS monorepo dirancang ulang |
| `docs/work/specs/2026-10-13-tarik-data-kasir-desain.md`, `docs/work/specs/2026-10-13-tarik-data-kasir-spec.md`, `docs/work/backlog/2026-10-11-tarik-data-kasir.md` | **Daftar data kasir** yang dibutuhkan gaji: jasa grooming & pengerjanya, ongkir & pengantarnya, pemasangan nama groomer ke karyawan | **Mekanisme tarik data.** Di monorepo, HRIS membaca database kasir langsung (lihat `../BRAINSTORM.md` bagian 4). Penarikan data penjualan pindah ke app Keuangan |
| `docs/aturan/arsip/01-karyawan-galian.md`, `02-kehadiran-galian.md`, `03-gaji-galian.md`, `05-gaji-driver-kasbon-galian.md` | Hanya kalau perlu tahu cara kerja sistem lama (mis. saat memindahkan data) | Selebihnya; aturan yang berlaku sudah ada di buku aturan |

## C. Lewati: modul Keuangan, Logistik, Kinerja

Tidak dibaca untuk HRIS. Berkas Keuangan **disimpan untuk app Keuangan** nanti.

| Berkas | Modul |
|---|---|
| `docs/aturan/06-keuangan.md`, `docs/aturan/arsip/06-keuangan-galian.md`, `docs/work/specs/2026-10-14-keuangan-spec.md`, `docs/work/backlog/2026-10-12-laporan-pajak.md` | Keuangan |
| `docs/aturan/04-logistik.md`, `docs/aturan/arsip/04-logistik-galian.md`, `docs/work/specs/2026-10-13-logistik-spec.md`, `docs/work/backlog/2026-10-12-posisi-driver-di-peta.md` | Logistik |
| `docs/aturan/07-kinerja-rekrutmen.md`, `docs/aturan/arsip/07-kinerja-rekrutmen-galian.md`, `docs/work/specs/2026-10-14-kinerja-spec.md`, `docs/work/backlog/2026-10-12-rekrutmen-ditangguhkan.md` | Kinerja & rekrutmen |

## D. Lewati: dokumen kerja repo v3

Cara kerja, status, dan tampilan milik repo v3. Untuk monorepo ini yang berlaku adalah `CLAUDE.md`,
`docs/agents/claims.md`, dan `docs/work/WIP.md` milik monorepo.

| Berkas | Catatan |
|---|---|
| `docs/teknis.md` | Alat v3 (Supabase, Vercel, repo tersendiri); diganti stack monorepo |
| `docs/work/aturan-kerja.md`, `docs/work/claims.md`, `docs/work/README.md` | Cara kerja repo v3 |
| `docs/work/WIP.md`, `docs/work/WIP-arsip.md` | Status pembangunan v3. Dibaca **hanya** untuk tahu sejauh mana v3 sudah dibangun |
| `docs/work/plans/*` | Peta jalan, gali aturan, tempat uji, urutan pembangunan v3 |
| `docs/work/backlog/2026-10-11-gali-aturan-sistem-lama.md`, `2026-10-11-tempat-uji-per-jabatan.md`, `2026-10-11-susun-ulang-menu.md` | Pekerjaan proses v3 |
| `docs/work/backlog/2026-10-11-usulan-dari-panduan-kasir.md`, `2026-10-11-usulan-pola-baku-tambahan.md`, `2026-10-11-usulan-pondasi-rancangan.md` | Sudah disetujui dan tertuang di buku aturan `00-*` |
| `docs/work/desain/*` | Brief Claude Design, gambar HTML, dan CSS tampilan v3 (brief karyawan sudah ditandai tidak dipakai) |

## E. Ketergantungan yang perlu diputuskan

Beberapa aturan HRIS v3 membaca data dari modul yang **tidak** ikut ke HRIS monorepo. Ini perlu
diputuskan sebelum PRD dikunci (dicatat juga di `../BRAINSTORM.md`):

| Aturan HRIS | Bergantung pada | Kenapa jadi soal |
|---|---|---|
| GAJ-20 **minus kas** ditanggung penutup shift, dari Laporan Kasir | Keuangan (KEU-38 s.d. 55) | Keuangan jadi app terpisah dan dibangun **sesudah** HRIS. Di monorepo, selisih kas shift sudah ada di POS (`petshop.shifts`), jadi bisa dibaca dari sana |
| Cara bayar gaji, kas keluar | Keuangan | Sama seperti di atas |
| GAJ-29/31 **bonus bersyarat** & Bonus Terukur | Kinerja (KIN-13 s.d. 26) | Kinerja di luar lingkup |
| GAJ-02 & DRV-04: orang upah **ritase** (driver, kenek), slip mingguan, bongkaran; KEH-96 absen lewat trip | Logistik & Gaji Driver | Belum diputuskan apakah driver/kenek ikut HRIS monorepo |
| Bonus grooming & ongkir (GAJ-61) | Data kasir | Di monorepo bisa dibaca langsung dari `petshop` |
