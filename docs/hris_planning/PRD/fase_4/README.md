# PRD — Fase 4: Kinerja (Tugas, Rak, Rapor, Bonus Terukur, Penjualan Promo, Catatan Rapat)

Status: **draf, menunggu persetujuan owner**. Disusun 2026-11-15 atas permintaan owner ("kita buat
modul ini, rencanakan ini di fase 4"), setelah owner menanyakan letak laporan tugas berfoto seperti
kebersihan rak yang menjadi penilaian kinerja.

Fase 4 = membangun modul **Kinerja** v3 di web HRIS: mengukur kerja tiap karyawan **dari data yang
sudah tercatat**, tanpa nilai yang diketik orang (KIN-03). Rekrutmen tetap **ditangguhkan** owner
(12 Oktober 2026).

## Daftar dokumen

| No | Dokumen | Isi | Langkah |
|---|---|---|---|
| 00 | [Ringkasan Fase 4](00-ringkasan-fase-4.md) | Latar, tujuan, lingkup, prinsip, urutan langkah, penyimpangan dari v3 | — |
| 01 | [Tugas & Kerapian Rak](01-tugas-dan-rak.md) | Master Judul, tugas rutin & sekali jalan, lapor berfoto, daftar rak, tanda janggal, tidak sah | F4-1, F4-2 |
| 02 | [Rapor](02-rapor.md) | Ukuran, kriteria & bobot per jabatan per cabang, Perkiraan → Ditetapkan, koreksi | F4-3 |
| 03 | [Bonus Terukur](03-bonus-terukur.md) | Aturan "kalau ukuran X memenuhi syarat → bonus Y", dinilai mesin, masuk Buku Bonus | F4-4 |
| 04 | [Penjualan Promo](04-penjualan-promo.md) | Produk & target promo per cabang, lapor penjualan, bonus per pcs | F4-5 |
| 05 | [Catatan Rapat](05-catatan-rapat.md) | Arsip hasil rapat + tugas tindak lanjut | F4-6 |

## Cara membaca

Urutan sumber kebenaran, dari yang paling kuat:

1. **Keputusan owner** di PRD ini (bertanggal) dan di memori/WIP yang lebih baru.
2. PRD Fase 1–3 (`../fase_1/`, `../fase_2/`, `../fase_3/`), untuk hal yang sudah ditetapkan di sana
   (misalnya minus kas dari shift POS, data kasir dibaca langsung tanpa Tarik Data).
3. **Buku aturan v3**: `../../reference_docs/docs/aturan/07-kinerja-rekrutmen.md` (KIN-01 s.d. 88).
4. **Spec v3**: `../../reference_docs/docs/work/specs/2026-10-14-kinerja-spec.md` (KIN-L01 s.d. L35).

PRD tidak menyalin aturan v3. Kalau PRD diam, aturan v3 berlaku.

Tanda: ✅ keputusan owner · 💡 usulan (belum disetujui) · ❓ terbuka · 🗣️ dibahas sambil jalan.

## Dari PRD ke pengembangan

Satu langkah = satu spec (`docs/work/specs/`) + satu plan, disetujui owner sebelum koding. Semua
langkah di **web HRIS** → alur `dev_hris` (`AGENTS.md`), termasuk fragment changelog HRIS dan tanda Baru.
