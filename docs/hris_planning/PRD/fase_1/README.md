# PRD HRIS — Fase 1

Status: **disetujui owner 2026-10-29** (semua usulan disahkan), dengan pertanyaan ❓ yang masih
terbuka di tiap dokumen. Disusun dari `../../BRAINSTORM.md`.

Fase 1 = HRIS yang bisa **menggantikan HRIS lama untuk absensi dan penggajian**, dibangun di
monorepo ini dengan struktur modul yang tegas.

## Daftar dokumen

| No | Dokumen | Isi | Langkah |
|---|---|---|---|
| 00 | [Ringkasan Fase 1](00-ringkasan-fase-1.md) | Tujuan, lingkup, prinsip, urutan langkah, definisi selesai, semua penyimpangan dari v3 | — |
| 01 | [Arsitektur & Struktur](01-arsitektur.md) | Letak di monorepo, schema, batas modul, data dari kasir, foto, mesin terjadwal, deploy | L0 |
| 02 | [Auth Terpusat](02-auth-terpusat.md) | Satu akun & satu sesi untuk semua app, tautan akun | L1 |
| 03 | [Perlengkapan Bersama](03-perlengkapan-bersama.md) | Mesin Pengajuan, Pengaturan, Beranda & Pemberitahuan, jejak perubahan | L2 |
| 04 | [Karyawan & Akses](04-karyawan-dan-akses.md) | Data induk, cabang & jabatan, hak akses, Akun & Tautan, data awal | L2 |
| 05 | [Kehadiran](05-kehadiran.md) | Jam kerja, absen QR, libur, izin/sakit/cuti, penjelasan, lembur | L3 |
| 06 | [Gaji Bulanan](06-gaji-bulanan.md) | Komponen, potongan, minus kas dari POS, bonus, slip, bayar | L4 |
| 07 | [Kasbon](07-kasbon.md) | Pengajuan sampai lunas, Dana Kasbon | L5 |
| 08 | [Logistik Minimal](08-logistik-minimal.md) | Trip & ritase, absen lewat trip | L6 |
| 09 | [Gaji Driver & Bongkaran](09-gaji-driver-dan-bongkaran.md) | Tarif ritase, slip mingguan, denda, bongkaran | L7, L8 |

## Cara membaca

Urutan sumber kebenaran, dari yang paling kuat:
1. **Keputusan owner** di PRD ini dan di `../../BRAINSTORM.md` (bertanggal).
2. **Buku aturan v3**: `../../reference_docs/docs/aturan/` (nomor KAR-, KEH-, GAJ-, DRV-, PRI-, SIS-, WAJ-).
3. **Spec v3**: `../../reference_docs/docs/work/specs/` (kode layar KAR-L, KEH-L, GAJ-L, DRV-L, BER-L), yaitu rincian layar, data, dan tes.

PRD **tidak menyalin** aturan v3. Setiap PRD modul berisi: tujuan, lingkup (bagian & layar v3 yang
masuk / tidak masuk), **penyimpangan dari v3**, kebutuhan khusus monorepo, kriteria selesai, dan
pertanyaan terbuka. Kalau PRD diam tentang suatu hal, aturan v3 yang berlaku.

Tanda: ✅ keputusan owner · 💡 usulan (belum disetujui) · ❓ terbuka.

## Dari PRD ke pengembangan

Saat pengembangan, perencanaan dan pelacakan memakai `docs/work/` monorepo (lihat `docs/work/README.md`):

| Kebutuhan | Tempat |
|---|---|
| Desain teknis satu langkah (tabel, pintu server, view) | `docs/work/specs/YYYY-MM-DD-hris-<langkah>-design.md` |
| Rencana implementasi & daftar task satu langkah | `docs/work/plans/YYYY-MM-DD-hris-<langkah>.md` |
| Temuan, ide, hal yang ditunda | `docs/work/backlog/YYYY-MM-DD-hris-<slug>.md` |
| Posisi terakhir pengembangan | `docs/work/WIP.md` (bagian HRIS) |
| Siapa mengerjakan apa | `docs/agents/claims.md` |

Satu langkah (L0–L9 di [00](00-ringkasan-fase-1.md)) = satu spec + satu plan. Langkah besar dipecah
mengikuti bagian spec v3 (mis. 4D-1, 4D-2a), seperti di v3.

## Branch

✅ (2026-10-29)

```
feat/hris-<langkah> ──PR──► dev_hris ──► staging ──(owner coba, ok)──► main ──► produksi
                                            ▲
backoffice: fix/... ──PR──► main ───────────┘ (staging rutin disamakan dengan main)
```

- **`dev_hris`**: branch utama pengembangan HRIS. Tiap langkah (L0, L1, …) dikerjakan di branch kecil
  `feat/hris-<langkah>` lalu di-PR ke `dev_hris`.
- **`staging`**: setiap push otomatis tayang ke lingkungan staging; owner mencoba di sini.
- **`main`**: produksi. Perbaikan backoffice harian **tetap boleh langsung ke `main`** seperti sekarang.
  Yang **wajib lewat staging**: semua HRIS, auth terpusat (L1), dan pemindahan role database.
- Lingkungan staging dijelaskan di [01 §8](01-arsitektur.md#8-deploy).
