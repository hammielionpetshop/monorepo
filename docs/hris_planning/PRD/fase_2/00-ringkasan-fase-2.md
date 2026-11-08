# 00 — Ringkasan Fase 2

## 1. Latar belakang

- Fase 1 (L0–L8) sudah dibangun dan lolos uji owner di staging; L9 (uji banding, latihan pindah)
  dan pengisian data staging **ditunda** atas keputusan owner 2026-11-08. HRIS belum di produksi.
- **Logistik penuh** (Tahap 1–5 + 6 butir perbaikan), yang di Fase 1 tertulis "tidak masuk",
  ternyata sudah dibangun atas permintaan owner dan lolos uji di staging. Ia menjadi bagian dari
  dasar Fase 2 (penyimpangan dari rencana Fase 1, §8).
- Owner menilai ada yang **keliru dalam penyusunan**: Logistik menumpang di dalam web HRIS. Yang
  diinginkan: **4 web terpisah** dengan satu pintu masuk, supaya tidak tercampur ✅.
- Keuangan dulu ditetapkan "menyusul setelah HRIS" (BRAINSTORM 2026-10-29). Selama Fase 1, HRIS
  dan Logistik sudah menyiapkan angka uang keluar (gaji, kasbon, bongkaran, bensin, uang toko)
  agar Keuangan tinggal membaca.

## 2. Tujuan Fase 2

1. **Susunan 4 web** yang jelas: POS (Back Office + kasir), Finance, Logistik, HRIS Karyawan —
   masing-masing hanya terlihat oleh yang berhak (01).
2. **Arus uang 4 cabang terbaca sangat jelas**: setiap uang masuk dan keluar tercatat "dari mana →
   ke mana", sekali saja, di modul tempat kejadiannya ✅.
3. **Finance sebagai tempat analisa**: laba rugi bersih per cabang & gabungan, arus uang, saldo
   tiap Tempat Uang, utang antar cabang — dengan penjelasan "Cara membaca" di setiap angka ✅.

## 3. Ukuran berhasil

- Saldo setiap Tempat Uang di Finance bisa dicocokkan dengan mutasi rekening / hitungan fisik.
- Tidak ada angka uang yang diketik dua kali di dua tempat.
- Pembayaran antar cabang tidak lagi diinput manual untuk kasus biasa: lahir otomatis dari
  verifikasi setoran (04).
- Laba rugi bersih per cabang bisa dijelaskan sampai ke nota, shift, dan catatan biaya asalnya
  lewat "Cara membaca".
- Kasir tidak merasakan perubahan cara masuk (01 §4).

## 4. Pengguna

Jabatan sama seperti Fase 1. Yang paling terlibat: **Finance** (verifikasi setoran, bayar,
mencatat biaya), **Owner** & **GM** (pengawas, pengesah), **Kepala Toko** (kelak, untuk tokonya
sendiri), **Kepala Gudang** (sewa mobil lewat Logistik).

## 5. Prinsip yang mengikat Fase 2

Semua prinsip Fase 1 (`../fase_1/00-ringkasan-fase-1.md` §6) tetap berlaku. Tambahan:

1. **Dicatat sekali, di modul tempat kejadiannya** ✅. Jualan, setoran, bayar supplier, Arus Kas →
   POS/Back Office; gaji, kasbon, bongkaran, dana, minus kas → HRIS; trip, uang toko, bensin,
   sewa mobil → Logistik. Layar uang yang sudah ada di HRIS "memang sudah seharusnya" di sana dan
   **tidak dipindah** ✅.
2. **Finance hanya membaca** ✅. Finance tidak punya tombol bayar atau catat biaya; ia menyusun
   angka dari ketiga sumber di atas.
3. **Setiap perpindahan uang menyebut "dari mana" dan "ke mana"** ✅ — lewat satu daftar
   **Tempat Uang** (02). Catatan uang yang belum punya "dari mana" ditambal (05).
4. **Biaya dicatat "untuk bulan apa" terpisah dari "dibayar kapan"** ✅ (sewa Oktober dibayar
   1 November masuk laba rugi Oktober, uangnya keluar November).
5. **"Cara membaca" wajib di setiap angka Finance** ✅ (07 §3).
6. **Tidak menggandakan fitur POS** (aturan AGENTS.md) dan **tidak membuka HRIS lama**.

## 6. Lingkup

**Masuk Fase 2**

| Langkah | Isi | PRD | Dikerjakan di |
|---|---|---|---|
| **F2-1** | Tempat Uang | [02](02-tempat-uang.md) | Back Office (+ HRIS membaca) |
| **F2-2** | Verifikasi setoran non-tunai per metode bayar | [03](03-verifikasi-non-tunai.md) | Back Office |
| **F2-3** | Pelunasan otomatis antar cabang dari verifikasi setoran | [04](04-pelunasan-otomatis.md) | Back Office |
| **F2-4** | "Dibayar dari" di bayar supplier + Arus Kas dirapikan | [05](05-supplier-dan-arus-kas.md) | Back Office |
| **F2-5** | Biaya Rutin + sewa mobil per ritase | [06](06-biaya-rutin-dan-sewa-mobil.md) | Back Office + Logistik |
| **F2-6** | Modul Finance (+ web uji staging 💡) | [07](07-modul-finance.md), [01](01-susunan-web.md) | Modul Finance |

**Belakangan (masih Fase 2, sesudah F2-6)** ✅: Halaman Awal + tombol Pindah web, Logistik dipisah
dari HRIS menjadi web sendiri (01).

**Tidak masuk Fase 2**: Kinerja & rekrutmen, fitur pendukung v3, import Excel, fingerprint, pajak
(tidak diatur v3) — kecuali owner memutuskan lain.

## 7. Urutan langkah

| Langkah | Bergantung pada | Catatan |
|---|---|---|
| F2-1 Tempat Uang | — | Pondasi semua langkah berikutnya |
| F2-2 Verifikasi non-tunai | F2-1 | Metode bayar ditautkan ke Tempat Uang |
| F2-3 Pelunasan otomatis | F2-1, F2-2 | ⚠️ **Utang lama wajib dibahas khusus sebelum F2-3 tayang produksi** (§9) |
| F2-4 Supplier & Arus Kas | F2-1 | Bisa sejajar dengan F2-2/F2-3 |
| F2-5 Biaya Rutin & sewa mobil | F2-1, F2-4 | Sewa mobil menyentuh Logistik (alur `dev_hris`) |
| F2-6 Modul Finance | F2-1 s.d. F2-5 | Bisa dimulai bertahap: tiap bagian membaca sumber yang sudah rapi |
| Belakangan: Halaman Awal, pisah Logistik | F2-6 | Domain/alamat diputuskan dev asli |

Definisi selesai satu langkah mengikuti Fase 1 §8 (tes, CI hijau, dicoba owner di staging,
WIP/klaim/changelog diperbarui). Untuk langkah yang menghasilkan angka uang, owner mencocokkan
satu contoh nyata (mis. satu hari setoran satu toko) sebelum rilis.

## 8. Penyimpangan dari v3 dan dari rencana Fase 1

| Hal | v3 / Fase 1 | Fase 2 | Keputusan |
|---|---|---|---|
| Susunan app | HRIS v3 satu app berisi semua modul; Fase 1: Logistik di dalam HRIS | **4 web terpisah** + Halaman Awal | ✅ 2026-11-08 |
| Logistik penuh | Fase 1: tidak masuk | Sudah dibangun (LT1–LT5 + 6 perbaikan), lolos uji staging | ✅ (permintaan owner selama Fase 1) |
| Buku Kas (KEU 3.1) | Keuangan memiliki Buku Kas, semua uang dicatat di sana | **Tidak ada Buku Kas sendiri.** Uang dicatat di modul kejadian; Finance menyusun "buku" dari bacaan | ✅ (Finance = analisa) |
| Catatan Cepat (KEU 3.5) | Pemilik uang mencatat singkat, dilengkapi finance | **Tidak dibuat**; biaya lain dicatat di Arus Kas Back Office | ✅ satu tempat input |
| Laporan Kasir & setoran (KEU 3.7–3.8) | Milik Keuangan | Tetap di **POS (Riwayat Shift)**, ditambah verifikasi non-tunai | ✅ |
| Utang supplier (KEU 3.9) | Daftar supplier & pembayaran milik Keuangan | Tetap di **Back Office**, ditambah "dibayar dari" | ✅ |
| Toko dan Gudang (KEU 3.10) | Utang belanja & deposit toko di Gudang | Utang antar cabang Back Office yang sudah ada + **pelunasan otomatis berantai**; kelebihan = setoran bebas (bukan deposit) | ✅ |
| Tagihan Rutin (KEU 3.12) | Di Keuangan | **Biaya Rutin di Back Office**; sewa mobil per ritase di **Logistik** | ✅ |
| Sumber Uang HRIS | Fase 1: daftar sendiri di HRIS | Membaca **Tempat Uang** Back Office | 💡 |

## 9. Wajib dikerjakan, dibahas khusus ⚠️

**Utang antar cabang lama** — utang yang masih terbuka di sistem sebelum pelunasan otomatis
berjalan (mis. nota Oktober yang belum lunas). Owner 2026-11-08: "nanti saja kita bahas, karena
ini butuh konsentrasi saya yang sangat tinggi" — **wajib diputuskan sebelum F2-3 tayang
produksi**. Bahan diskusi ada di 04 §7.

## 10. Dibahas sambil jalan 🗣️

Owner 2026-11-08: "bisakah kita bahas sambil berjalan saja". Hal-hal dari buku v3 yang belum
diputuskan, diangkat di langkah tempat ia dibutuhkan:

| No | Hal | Diangkat di | Kenapa penting |
|---|---|---|---|
| 1 | **Pindah Dana** antar Tempat Uang (setor tunai ke bank, tarik ATM, isi uang pegangan) | F2-1 | Tanpa ini saldo Tempat Uang tidak pernah cocok |
| 2 | **Uang diambil Owner** (pribadi) | F2-4 | Bukan biaya; kalau tercatat biaya, laba tampak lebih kecil |
| 3 | **Modal masuk & pinjaman** (+ cicilan) | F2-4 | Uang masuk bukan penjualan; jangan tampak sebagai untung |
| 4 | **Pembelian aset** & penyusutan | F2-5 | Beli freezer bukan biaya satu bulan |
| 5 | **Saldo awal** tiap Tempat Uang | F2-1 | Finance mulai dari angka nyata pada satu tanggal |
| 6 | **Hitung fisik kas** (brankas, uang pegangan) | F2-6 | Mencocokkan saldo sistem dengan uang nyata |
| 7 | **Dua daftar kategori** di Back Office (Pengeluaran Kasir vs Arus Kas) disatukan | F2-4 | Supaya satu biaya tidak punya dua nama |
| 8 | **Biaya bersama** (kantor, Finance, Owner) dibagi ke cabang atau berdiri sendiri | F2-6 | Untuk laba bersih per cabang |
| 9 | **Tutup bulan** (angka bulan yang sudah ditutup dikunci) | F2-6 | Laporan yang sudah dilihat tidak berubah diam-diam |
| 10 | **Finance libur** — siapa yang verifikasi setoran | F2-1 / F2-2 | Setoran tidak menggantung |

## 11. Risiko

| Risiko | Penanganan |
|---|---|
| Pelunasan otomatis salah melunasi utang | Simulasi di salinan data produksi sebelum rilis; owner mencocokkan contoh; koreksi lewat pembalikan, bukan hapus (04) |
| Verifikasi non-tunai menambah kerja Finance tiap shift | Layar ringkas per metode; dana belum cair boleh menunggu tanpa mengunci shift (03) |
| Mengubah layar kasir/BO yang sedang dipakai produksi | Perubahan Back Office lewat staging + uji owner; kasir tidak merasakan perubahan cara masuk |
| Angka Finance dipercaya padahal sumbernya belum rapi | F2-6 baru dibangun setelah F2-1 s.d. F2-5; "Cara membaca" menunjukkan asal setiap angka |
| HRIS & Logistik belum produksi | Bagian yang membaca HRIS/Logistik di Finance baru berisi data nyata setelah HRIS rilis; ditandai di layar |

## 12. Pertanyaan terbuka

- ❓ Web Finance khusus staging (hanya Owner/GM) untuk uji, atau modul saja tanpa layar sampai web
  resmi ada? (01 §5)
- ❓ Utang lama (§9).
- Pertanyaan per langkah ada di akhir tiap dokumen.
