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
| B3 | **Tayang staging — menunggu uji owner** | Spec [`2026-11-08-kurang-serah-potongan-lain-design.md`](../specs/2026-11-08-kurang-serah-potongan-lain-design.md) (disetujui owner 2026-11-08). `feat/hris-b3-short-handover` `c6094423`, dev_hris `2570643d`, migrasi hris `0054`; tes unit 7 + integrasi Terima Uang 6 (termasuk skenario B3) lulus, Potongan Lain / slip mingguan / denda driver lulus; klaim dilepas. Langkah uji: bagian **Uji B3** di bawah. Rilis HRIS ikut jadwal rilis HRIS (belum produksi). |
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

## Uji B3 (staging HRIS `hris.staginghml.my.id`)

Butuh satu trip truk berawak driver + kenek yang uang tunainya diperiksa **Tidak cocok** (kurang) di
Logistik › Terima Uang.

1. **Finance** › Terima Uang › tab **Selisih**: bagian **Kurang serah** memuat toko itu, tanda
   ⚠️ Belum ditindaklanjuti, nota dan angkanya. Lebih serah / transfer kurang ada di "Selisih lain".
2. **Sudah diganti tunai** sebagian (mis. 5.000) → tercatat, "Sisa belum ditindaklanjuti" berkurang.
   Nominal di atas sisa ditolak.
3. Masuk sebagai **HR**: menu Terima Uang hanya tab Selisih; Beranda memuat kartu "kurang serah belum
   ditindaklanjuti"; HR mendapat pemberitahuan saat kurang serah baru diperiksa.
4. HR › **Jadikan Potongan Lain**: terisi driver, jenis "Kurang serah uang toko", sisa, alasan. Coba
   **Bagi dengan kenek** → **Bagi rata** → Kirim usulan. Potongan Lain memuat 2 usulan (driver & kenek),
   tanda kurang serah 🕓 menunggu pengesahan.
5. **Pemilik/GM** › Persetujuan: sahkan / tolak usulan. Ditolak → kurang serah kembali ⚠️ dan bisa
   diajukan ulang. Disahkan → ✅, cicilan muncul di slip mingguan driver/kenek.
6. Finance › **Batalkan pemeriksaan** toko itu selama ada potongan/ganti tunai → ditolak dengan pesan.
7. Kurang serah lain: Pemilik/GM › **Tidak dipotong** (alasan) → tanda "Tidak dipotong".
8. Potongan Lain biasa (Gaji › Potongan Lain › Ajukan): driver/kenek kini bisa dipilih.
