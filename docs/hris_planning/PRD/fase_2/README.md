# PRD — Fase 2: Susunan Web & Keuangan

Status: **disetujui owner 2026-11-08** ("prd saya setujui"), disusun dari diskusi owner 2026-11-08, dengan pertanyaan ❓ yang masih terbuka di tiap dokumen.
Belum ada spec atau kode; koding dimulai di sesi baru, diawali spec F2-1 Tempat Uang.

Fase 2 = merapikan **susunan web** (4 web terpisah) dan membangun **Keuangan** sebagai tempat
**analisa** uang. Pencatatan uang tetap di modul tempat kejadiannya (POS/Back Office, HRIS,
Logistik); Finance hanya membaca.

## Daftar dokumen

| No | Dokumen | Isi | Langkah |
|---|---|---|---|
| 00 | [Ringkasan Fase 2](00-ringkasan-fase-2.md) | Latar, tujuan, prinsip, lingkup, urutan langkah, hal yang dibahas sambil jalan, penyimpangan dari v3 | — |
| 01 | [Susunan Web](01-susunan-web.md) | 4 web, Halaman Awal, hak per web, Pindah web, posisi modul Finance | F2-6, Belakangan |
| 02 | [Tempat Uang](02-tempat-uang.md) | Satu daftar rekening, brankas, kas untuk semua web | F2-1 |
| 03 | [Verifikasi Setoran Non-Tunai](03-verifikasi-non-tunai.md) | Verifikasi per metode bayar, wajib ketik, sebab selisih, potongan bank | F2-2 |
| 04 | [Pelunasan Otomatis Antar Cabang](04-pelunasan-otomatis.md) | Verifikasi setoran melunasi utang antar cabang, berantai, koreksi, umur utang | F2-3 |
| 05 | [Bayar Supplier & Arus Kas](05-supplier-dan-arus-kas.md) | "Dibayar dari", satu daftar kategori, kategori bawaan, bukti, "untuk bulan apa" | F2-4 |
| 06 | [Biaya Rutin & Sewa Mobil](06-biaya-rutin-dan-sewa-mobil.md) | Sewa toko/kendaraan/lainnya, sewa mobil per ritase | F2-5 |
| 07 | [Modul Finance](07-modul-finance.md) | Arus uang, saldo Tempat Uang, laba rugi bersih, "Cara membaca" | F2-6 |

## Cara membaca

Urutan sumber kebenaran, dari yang paling kuat (sama seperti Fase 1):
1. **Keputusan owner** di PRD ini (bertanggal) dan di memori/WIP yang lebih baru.
2. PRD Fase 1 (`../fase_1/`), untuk hal yang sudah ditetapkan di sana.
3. **Buku aturan v3**: `../../reference_docs/docs/aturan/` — terutama `06-keuangan.md` (KEU-).
4. **Spec v3**: `../../reference_docs/docs/work/specs/2026-10-14-keuangan-spec.md`.

PRD tidak menyalin aturan v3. Kalau PRD diam, aturan v3 berlaku **kecuali** bertentangan dengan
prinsip Fase 2 "dicatat sekali di modul kejadian, Finance hanya membaca" (00 §5).

Tanda: ✅ keputusan owner · 💡 usulan (belum disetujui) · ❓ terbuka · 🗣️ dibahas sambil jalan.

## Dari PRD ke pengembangan

Sama seperti Fase 1: satu langkah = satu spec (`docs/work/specs/`) + satu plan, disetujui owner
sebelum koding; alur branch/staging/rilis mengikuti `AGENTS.md`. Langkah F2-1 s.d. F2-5 adalah
pekerjaan **Back Office** (dan Logistik untuk sewa mobil), jadi mengikuti alur backoffice
(dasar `origin/main`); bagian yang menyentuh HRIS/Logistik mengikuti alur `dev_hris`.
