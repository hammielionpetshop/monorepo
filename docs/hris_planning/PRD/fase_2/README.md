# PRD — Fase 2: Susunan Web & Keuangan

Status: **disetujui owner 2026-11-08** ("prd saya setujui"), disusun dari diskusi owner 2026-11-08.
Pertanyaan ❓ di tiap dokumen sudah dijawab di spec langkahnya (dirapikan 2026-11-14, tautan di bagian
"Pertanyaan terbuka" tiap dokumen). Status langkah ada di tabel di bawah; status rinci di `docs/work/WIP.md`.

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

## Status langkah (2026-11-14)

Bagian Back Office dirilis lewat PR rilis ke `main`; bagian HRIS, Logistik, Finance, dan Gateway
baru ke produksi bersama rilis HRIS, yang **ditunda sampai owner memutuskan** (keputusan owner 2026-11-14).

| Langkah | Spec | Back Office | HRIS / Logistik / Finance / Gateway |
|---|---|---|---|
| F2-1 Tempat Uang | [spec](../../../work/specs/2026-11-08-f2-1-tempat-uang-design.md) | Produksi 1.107.118 | F2-1b lolos uji staging |
| F2-2 Setoran & verifikasi non-tunai | [spec](../../../work/specs/2026-11-08-f2-2-setoran-design.md) | Produksi 1.107.119 | — |
| F2-3 Pelunasan otomatis (+ F2-3b utang lama) | [spec](../../../work/specs/2026-11-08-f2-3-pelunasan-otomatis-design.md), [3b](../../../work/specs/2026-11-08-f2-3b-utang-lama-design.md) | Produksi 1.107.120–121 | — |
| F2-4 Supplier & Arus Kas | [spec](../../../work/specs/2026-11-09-f2-4-supplier-arus-kas-design.md) | Produksi 1.107.122 | — |
| F2-5 Biaya Rutin & Sewa Mobil | [spec](../../../work/specs/2026-11-11-f2-5-biaya-rutin-sewa-mobil-design.md) | Biaya Rutin produksi 1.107.131 | Sewa Mobil lolos uji staging |
| F2-6a Saldo & Arus Uang | [spec](../../../work/specs/2026-11-12-f2-6-modul-finance-design.md) | Saldo awal produksi 1.107.132 | Web Finance lolos uji staging |
| F2-6b Laba Rugi | [spec](../../../work/specs/2026-11-12-f2-6b-laba-rugi-design.md) | — | Lolos uji staging |
| F2-6c Utang antar cabang, Dana belum cair, Setoran vs Laba | [6c](../../../work/specs/2026-11-12-f2-6c-utang-setoran-bebas-dana-belum-cair-design.md), [6c-2](../../../work/specs/2026-11-12-f2-6c-2-setoran-bebas-vs-laba-design.md) | — | Lolos uji staging |
| F2-6d Aset & Penyusutan | [spec](../../../work/specs/2026-11-12-f2-6d-aset-penyusutan-design.md) | Produksi 1.107.134 | Lolos uji staging |
| F2-6e Hitung Kas | [spec](../../../work/specs/2026-11-12-f2-6e-hitung-kas-design.md) | Produksi 1.107.135 | Lolos uji staging |
| F2-6f Tutup Bulan + Koreksi bulan lalu | [spec](../../../work/specs/2026-11-12-f2-6f-tutup-bulan-design.md) | Produksi 1.107.136 dalam keadaan tidak aktif | Tayang staging — uji owner mulai 1 Des 2026 |
| F2-7a Halaman Awal + Pindah web | [spec](../../../work/specs/2026-11-14-f2-7a-halaman-awal-pindah-web-design.md) | API gateway di staging | Lolos uji staging |
| F2-7b Logistik dipisah | [spec](../../../work/specs/2026-11-14-f2-7b-pisah-logistik-design.md) | — | Lolos uji staging |

Sisa Fase 2: uji Tutup Bulan (mulai 1 Des 2026), lalu rilis HRIS/Finance/Gateway/Logistik ke produksi
saat owner memutuskan. Alamat halaman HRIS, Logistik, dan Finance diganti ke bahasa Inggris
(perintah owner 2026-11-14, spec `docs/work/specs/2026-11-14-english-routes-design.md`).

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
