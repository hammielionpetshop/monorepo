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
| B3 | **Lolos uji owner** | Lolos uji owner di deployment staging `8582f86b` (run `42406407964`; owner: "ok sudah saya check", 2026-11-08; skenario tidak dirinci). HRIS belum produksi; ikut rilis HRIS. Spec [`2026-11-08-kurang-serah-potongan-lain-design.md`](../specs/2026-11-08-kurang-serah-potongan-lain-design.md) (disetujui owner 2026-11-08). `feat/hris-b3-short-handover` `c6094423`, dev_hris `2570643d`, migrasi hris `0054`; tes unit 7 + integrasi Terima Uang 6 (termasuk skenario B3) lulus, Potongan Lain / slip mingguan / denda driver lulus; klaim dilepas. Langkah uji: bagian **Uji B3** di bawah. Rilis HRIS ikut jadwal rilis HRIS (belum produksi). |
| A2 | **Tayang staging — menunggu uji owner** | Spec [`2026-11-08-jemput-retur-design.md`](../specs/2026-11-08-jemput-retur-design.md) (disetujui lewat jawaban sesi malam). `feat/hris-a2-return-pickup` `76bcb8c3`, dev_hris `891f839f`; migrasi logistics `0017`, hris `0055`. Tes integrasi jemput retur 4 + Barang Kembali, Laporan Toko, trip, Trip Saya, antar sendiri, Terima Uang (55 tes) lulus; typecheck lulus. Deploy staging run `42408818634` sukses (staging `3758618f`). Langkah uji: bagian **Uji A2** di bawah. HRIS belum produksi; ikut rilis HRIS. |
| A1 | **Tayang staging — menunggu uji owner** | Spec [`2026-11-08-titipan-toko-design.md`](../specs/2026-11-08-titipan-toko-design.md) (disetujui lewat jawaban sesi malam). `feat/hris-a1-store-deposit` `5aa7b001`, dev_hris `5d1e6c4b`; migrasi logistics `0018` (tanpa migrasi hris; hak memakai `logistics.money_check.do`). Tes integrasi titipan 2 + uang toko, Terima Uang, Trip Saya, jemput retur, antar sendiri (26 tes) lulus; typecheck lulus. **Di luar:** antar sendiri dan titipan lewat transfer belum bisa dititipkan. Deploy staging run `42409644898` sukses. Langkah uji: bagian **Uji A1** di bawah. |
| B1+B2 | **Tayang staging — menunggu uji owner** | Spec [`2026-11-08-pemeriksa-kasir-design.md`](../specs/2026-11-08-pemeriksa-kasir-design.md) (disetujui lewat jawaban sesi malam). `feat/hris-b12-kasir-check` `0b34b2b4`, dev_hris tergabung; migrasi logistics `0019` (view `pos_sale_returns`). Tes uang toko 8 (termasuk skenario B1+B2), jemput retur, Terima Uang, antar sendiri lulus; typecheck lulus. Langkah uji: bagian **Uji B1+B2** di bawah. |
| C | Antre sesi malam | Sesudah B1+B2. |

## Sesi malam 2026-11-08

Owner (sebelum tidur) mengizinkan A2 → A1 → B1+B2 → C dikerjakan berurutan dalam **satu sesi**:
spec + kode + tes + tayang staging **tanpa menunggu "ok kerjakan"** (jawaban pertanyaan berikut =
persetujuan spec). Butir yang macet dicatat alasannya di tabel status lalu dilewati. Rilis ke `main`
tidak disentuh. Jawaban owner:

- **A2** pembuat tugas jemput: Kepala Gudang, Marketing, Finance, Pemilik/GM. Nilai retur tetap lewat
  Retur di BO (keputusan C), HRIS tidak mengisi nilai. Trip boleh mampir ke toko **hanya** untuk jemput
  retur (tanpa surat jalan), dan retur langsung tanpa tugas (Lapor masalah › Retur) tetap ada.
- **A1** POS tidak punya saldo/deposit pelanggan → saldo titipan disimpan di HRIS (tanpa hapus), dipakai
  lewat **Pelunasan Piutang** di kasir melalui "Perlu dicatat di kasir" (kasir tidak diubah).
  "Lunas + titip" = toko bayar lebih dari tagihan; "Titip saja" = toko menyerahkan uang tanpa tagihan di
  kunjungan itu. Titipan boleh **dikembalikan tunai** ke toko (alasan wajib).
- **B2** saat Sudah dicatat untuk Retur BO, nomor retur **wajib ada** di kasir (dicek), nilainya ditampilkan.

## Uji B1+B2 (staging HRIS `hris.staginghml.my.id` + BO `bo.staginghml.my.id`)

1. Laporan Toko Retur → keputusan **Dicatat lewat Retur BO**. Di BO staging buat Retur Penjualan untuk nota toko itu.
2. HRIS › Perlu dicatat di kasir › **Sudah dicatat**: ketik nomor salah → ditolak "tidak ditemukan"; nomor retur toko
   lain → ditolak; nomor yang benar → tersimpan, kartu menampilkan ✅ nomor retur + nilainya (juga di Laporan Toko).
3. Batalkan retur itu di BO → kartu berubah ⚠️ "dibatalkan di kasir".
4. Potong nota → Sudah dicatat sebelum nota diubah di kasir → ⚠️ Belum terlihat di kasir (nominal sekarang). Kurangi
   nota di kasir sebesar potongan → ✅ Terlihat di kasir.
5. Retur BO yang belum dicatat > 3 hari bertanda merah "Retur belum dibuat di BO".

## Uji A1 (staging HRIS `hris.staginghml.my.id`)

1. **Driver** › Trip Saya › Terkirim ke toko bertagihan › cara bayar **Lunas + titip** → ketik seluruh uang tunai (lebih
   dari tagihan) → ringkasan menampilkan "Titipan toko Rp…"; Simpan baru aktif sesudah mencentang "Benar, toko
   menitipkan kelebihannya".
2. Toko tanpa tagihan (lunas di kasir) › ringkasan › centang **Toko menitipkan uang (Titip saja)** → isi nominal.
3. Sesudah Menuju Garasi: **Finance** › Terima Uang › bagian **Titipan toko menunggu diperiksa** → Cocok (atau ketik
   angka lain + catatan). Sebelum Menuju Garasi tertulis "Menunggu trip Menuju Garasi".
4. Logistik › **Titipan Toko**: saldo toko itu bertambah. **Pakai untuk nota** (pilih nota berpiutang, nominal) →
   muncul di **Perlu dicatat di kasir › Pakai titipan toko** → catat Pelunasan Piutang di kasir → Sudah dicatat.
   Nominal di atas saldo / sisa piutang ditolak.
5. **Kembalikan tunai** (alasan) mengurangi saldo; **Batalkan** pemakaian yang belum dicatat / pengembalian mengembalikan saldo.

## Uji A2 (staging HRIS `hris.staginghml.my.id`)

1. **Finance / Marketing / Kepala Gudang** › Logistik › **Jemput Retur** › cari toko, isi alasan (+ perkiraan barang),
   Simpan. Membuat tugas kedua untuk toko yang sama ditolak.
2. **Kepala Gudang** › Buat trip: bagian **Jemput retur** di form memuat tugas itu → centang, simpan. Atau dari halaman
   Jemput Retur › pilih trip › **Masukkan ke trip** (trip berjalan: awak dapat pemberitahuan). Coba juga toko yang
   tidak punya surat jalan di trip itu.
3. Rincian trip memuat bagian Jemput retur; **Lepas dari trip** (alasan) mengembalikannya ke Menunggu.
4. **Driver** › Trip Saya (trip berjalan): Menuju Garasi biasa tertahan "jemput retur di …". Tekan **Diambil** → isi
   barang + foto → simpan. Tugas lain: **Kirim Besok** (alasan + foto) → kembali Menunggu "dicoba ×1".
   **Tidak ada barang** → pembuat tugas diberi tahu.
5. Sesudah Sampai Garasi: **Barang Kembali** memuat "Jemput retur" toko itu dengan rinciannya; terima seperti biasa.
6. **Finance** › Laporan Toko: laporan bertanda "Jemput retur" → hanya Retur BO / Tidak dipotong, tanpa pilih nota →
   muncul di **Perlu dicatat di kasir**.
7. Trip berjalan yang membawa tugas lalu **Selesai lebih awal** / ditutup kantor → tugas kembali Menunggu (riwayat "Terlewat").

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
