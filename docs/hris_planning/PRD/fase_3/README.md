# PRD — Fase 3: Fitur Pendukung (Pengumuman, Pengingat, Panduan)

Status: **disetujui owner 2026-11-15** ("ok. setuju"; **dikerjakan sebelum Fase 4**). Keputusan utama ("ok" untuk: darurat di web HRIS saja,
tanpa push HP, isi awal Panduan disusun baru dari v3, isi awal Pedoman Lapor dari baris yang sudah
ada). Disusun 2026-11-14 atas permintaan owner: "susun dokumen untuk fase 3, fitur pendukung: papan
perubahan aturan dan pengumuman darurat, pengingat berantai, panduan karyawan, dan pedoman lapor".
Pertanyaan ❓ kecil yang tersisa dijawab di spec langkahnya.

Fase 3 = membangun **fitur pendukung v3** yang di Fase 1 ditunda ("menyusul"), supaya:
aturan yang berubah selalu diumumkan dan terbaca, kejadian mendesak sampai ke semua orang,
pengingat penting tidak terlewat, dan karyawan punya **satu tempat** mencari "aturannya bagaimana".

## Daftar dokumen

| No | Dokumen | Isi | Langkah |
|---|---|---|---|
| 00 | [Ringkasan Fase 3](00-ringkasan-fase-3.md) | Latar, tujuan, lingkup, prinsip, urutan langkah, penyimpangan dari v3 | — |
| 01 | [Antrean Berantai](01-antrean-berantai.md) | Jendela satu per satu, urutan, "OK, sudah baca", pindahan pengingat modul | F3-1, F3-4 |
| 02 | [Pengumuman Darurat](02-pengumuman-darurat.md) | Kirim kejadian mendesak ke semua/cabang/jabatan, jendela 5 detik, siapa sudah baca | F3-2 |
| 03 | [Papan Perubahan Aturan](03-papan-perubahan-aturan.md) | Tulis, setujui, jadwalkan, terbitkan, ralat, tarik; wajib saat pengaturan diubah | F3-3 |
| 04 | [Panduan & Pedoman Lapor](04-panduan-dan-pedoman-lapor.md) | Menu Panduan: Panduan Karyawan, Papan, Pedoman Lapor; layar ubahnya | F3-5 |

## Cara membaca

Urutan sumber kebenaran, dari yang paling kuat (sama seperti Fase 1 dan 2):

1. **Keputusan owner** di PRD ini (bertanggal) dan di memori/WIP yang lebih baru.
2. PRD Fase 1 (`../fase_1/`) dan Fase 2 (`../fase_2/`), untuk hal yang sudah ditetapkan di sana.
3. **Buku aturan v3**: `../../reference_docs/docs/aturan/` — terutama `00-prinsip-rancangan.md`
   (PRI-29, 35, 36, 40, 43), `00-pola-baku-tampilan.md` (TAM-22, 24, 25), `00-gambaran-sistem.md`
   (SIS-06), `01-karyawan.md` (KAR-57, 79).
4. **Spec v3**: `../../reference_docs/docs/work/specs/2026-10-13-perlengkapan-bersama-spec.md`
   (BER-L01 s.d. L26), `2026-10-13-karyawan-dan-akses-spec.md` (KAR-L34, L35), dan
   `2026-10-14-daftar-lintas-modul.md` bab 2 (daftar jenis antrean berantai).

PRD tidak menyalin aturan v3. Kalau PRD diam, aturan v3 berlaku.

Tanda: ✅ keputusan owner · 💡 usulan (belum disetujui) · ❓ terbuka · 🗣️ dibahas sambil jalan.

## Dari PRD ke pengembangan

Sama seperti Fase 1: satu langkah = satu spec (`docs/work/specs/`) + satu plan, disetujui owner
sebelum koding. Semua langkah Fase 3 ada di **web HRIS**, jadi mengikuti alur `dev_hris`
(`AGENTS.md`), termasuk fragment changelog HRIS dan tanda Baru.
