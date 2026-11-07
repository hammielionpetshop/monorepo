# Antrean perbaikan celah Logistik HRIS

Disetujui owner 2026-11-08, hasil analisis celah spec
[`2026-11-04-hris-logistik-t1-toko-surat-jalan-design.md`](../specs/2026-11-04-hris-logistik-t1-toko-surat-jalan-design.md)
(ada di `dev_hris` dan `staging`). Alur development tetap mengikuti `AGENTS.md`
(spec → persetujuan owner → klaim → implementasi → staging → uji owner → rilis).

## Panduan owner (komputer mana pun)

1. Buka terminal di folder repo, jalankan `git fetch` lalu `git pull` di branch yang sedang
   dipakai (biasanya `main`).
2. Buka Claude Code di folder repo, ketik: **lanjutkan perbaikan HRIS**
3. Ikuti tahapnya; Claude memberi tahu tiap tahap selesai:

   | Tahap | Claude | Owner |
   |---|---|---|
   | Spec | menelusuri kode, menulis rancangan | jawab "ok kerjakan" atau koreksi |
   | Kerja | klaim → kode → tes → gabung & push staging | tunggu kabar "tayang staging" |
   | Uji | memberi langkah uji singkat | coba di `bo.staginghml.my.id` / `hris.staginghml.my.id`, laporkan hasil |
   | Rilis | menyiapkan PR rilis ke `main` | beri izin rilis |

4. Satu chat = satu butir. Sesudah butir selesai, buka chat baru dan ketik kata kunci yang sama.
5. Hasil uji boleh dilaporkan dari komputer mana pun, di chat baru sekalipun
   (contoh: "A3 sudah saya uji, aman"). Claude mencatatnya di tabel status berkas ini.

## Panduan agent (saat menerima "lanjutkan perbaikan HRIS")

- Fetch, lalu baca **berkas ini versi `origin/staging`** (versi terbaru tabel status; versi
  `main` bisa tertinggal). Ambil butir pertama di tabel status yang belum **Selesai**:
  - status **Belum dimulai** → mulai dari spec; tunggu persetujuan owner.
  - status **Tayang staging — menunggu uji owner** → berikan langkah uji di kolom Catatan,
    tunggu hasil owner; bila lolos, siapkan PR rilis ke `main` sesuai `AGENTS.md`.
  - jangan mulai butir berikutnya di sesi yang sama.
- Ikuti `AGENTS.md` penuh (klaim dipublikasikan sebelum implementasi, HRIS dari
  `origin/dev_hris`, backoffice dari `origin/main`, merge lokal, satu push per batch).
- Setiap ganti tahap, perbarui tabel status di berkas ini lewat branch dokumentasi yang
  digabung lokal ke `staging` (bersama batch pekerjaannya bila ada). Workflow staging
  mengabaikan `docs/**`, jadi push dokumen saja tidak men-deploy ulang.
- Beri tahu owner dengan jelas tahap yang selesai; sesudah butir selesai, minta owner
  melanjutkan di chat baru.
- Komputer baru: identitas git bisa belum diatur. Tanyakan owner sebelum memakai identitas
  penulis untuk commit.

## Urutan dan isi

1. **A3 Cetak cara kirim di struk** (backoffice, dasar `origin/main`): "DIKIRIM TRUK GUDANG"
   (tebal) / "Diantar kurir cabang" / tidak dicetak untuk Ambil sendiri; struk + surat jalan
   (termasuk PO Internal); cetak ulang ikut cara kirim terbaru. Tanpa migrasi.
2. **B3 Kurang serah → Potongan Lain** (HRIS): tombol "Jadikan Potongan Lain" di tab Selisih
   Terima Uang, terisi orang/nominal/alasan, tetap lewat persetujuan, tanpa potong gaji
   otomatis; tanda bila belum ditindaklanjuti. Owner menekankan ini harus diperbaiki.
3. **A2 Tugas Jemput Retur** (HRIS, migrasi logistics): tugas dibuat Kepala Gudang/Marketing
   (toko, alasan, perkiraan barang), masuk antrean Menunggu, dicentang ke trip; driver:
   Diambil (foto + rincian retur → Barang Kembali LT2a) / Tidak ada barang / Kirim Besok.
   Owner: cukup sering terjadi.
4. **A1 Titipan Toko** (HRIS, mungkin kasir): pilihan "Lunas + titip" / "Titip saja" saat
   Terkirim, saldo titipan per toko tanpa hapus, diperiksa di Terima Uang, pemakaian lewat
   "Perlu dicatat di kasir" (HRIS tidak menulis ke kasir). Cek dulu apakah POS punya saldo
   pelanggan. Owner: cukup sering terjadi.
5. **B1+B2 Pemeriksa kasir**: tanda "Terlihat di kasir ✅ / Belum terlihat ⚠️" untuk potong
   nota & harga beda (pakai ulang `logistics-kasir-check`); tautan laporan retur ↔ nomor retur
   BO, nilai retur dibaca, merah "Retur belum dibuat di BO" > 3 hari.
6. **C Celah kecil**: foto Laporan Muat tampil di rincian surat jalan + tanda "belum ada foto
   muat" (Toko Pusat); saringan cabang/mobil di Laporan Logistik (tetap CSV, tanpa
   dependensi baru).

## Keputusan owner (2026-11-08)

- **A4** nota kurir bayar di tempat **selalu dicatat piutang** di kasir — tidak perlu fitur;
  dicatat di spec LT1 saat butir HRIS berikutnya menyentuhnya.
- **A1 dan A2 harus siap sebelum hari pindah** (target 26 Des 2026).
- Pengantar dipilih kantor: biarkan seperti sekarang.
- Modul Keuangan (Buku Kas, uang bensin sebelum isi) tetap di luar Fase 1.

## Status

| Butir | Status | Catatan |
|---|---|---|
| A3 | **Lolos uji owner — rilis ditahan** | Spec [`2026-11-08-cara-kirim-di-struk-design.md`](../specs/2026-11-08-cara-kirim-di-struk-design.md); commit `a9778ca7`, staging `b9fc6309`, deploy run `42402766854` sukses (2026-11-08); klaim dilepas. Langkah uji: lihat bagian **Uji A3** di bawah. **Lolos uji owner** di deployment staging `b9fc6309` (owner: "ok aman", 2026-11-08; skenario tidak dirinci). Owner: **jangan dulu PR ke `main`, simpan dulu** — PR rilis hanya atas izin owner berikutnya. |
| B3 | **Spec disetujui — dikerjakan** | Spec [`2026-11-08-kurang-serah-potongan-lain-design.md`](../specs/2026-11-08-kurang-serah-potongan-lain-design.md) (di `dev_hris`), disetujui owner 2026-11-08: bagi dengan kenek (bawaan driver penuh), tombol Sudah diganti tunai (Finance) + Tidak dipotong (Pemilik/GM), nominal boleh diturunkan, orang mingguan di form Potongan Lain. Branch `feat/hris-b3-short-handover`, migrasi hris `0054`. |
| A2 | Belum dimulai | — |
| A1 | Belum dimulai | — |
| B1+B2 | Belum dimulai | — |
| C | Belum dimulai | — |

## Uji A3 (staging backoffice `bo.staginghml.my.id`)

1. POS: nota berpelanggan, pilih **Dikirim truk Gudang**, bayar, cetak struk → di bawah
   pelanggan tercetak **DIKIRIM TRUK GUDANG** (tebal).
2. Nota **Diantar kurir cabang** (pengantar + ongkir) → "Diantar kurir cabang" (biasa).
3. Nota **Ambil sendiri** → tidak ada baris cara kirim.
4. Backoffice Riwayat Transaksi: nota langkah 1 → **Ubah cara kirim** ke Ambil sendiri →
   cetak ulang → baris truk hilang.
5. Surat jalan (detail transaksi / Bulk Sale, Truk Gudang) → baris
   **Kirim : DIKIRIM TRUK GUDANG** (tebal) di bawah Kepada/Staf.
6. PO Internal di kasir: **Kirim Sekarang** dengan Truk Gudang, lalu cetak struk/surat jalan →
   memuat DIKIRIM TRUK GUDANG ("Kirim sendiri" bila pilihannya itu). Detail PO Internal
   backoffice: Surat Jalan A4 memuat baris "Cara kirim".

Tanpa printer: gambar struk/surat jalan (kirim WA) memuat baris yang sama.
