# 03 — Verifikasi Setoran Non-Tunai (Langkah F2-2)

Sumber v3: `06-keuangan.md` bagian 3.8 & 3.23 (setoran, non-tunai, selisih kasir, finance libur).
Dasar POS: verifikasi setoran Riwayat Shift (ketik dua kali + wajib cetak, rilis 1.107.90),
Laporan Minus Kasir (1.107.105–106).

## 1. Tujuan

Verifikasi setoran di Riwayat Shift tidak hanya menghitung tunai, tetapi **setiap metode bayar**,
supaya semua uang toko — tunai maupun transfer/QRIS/debit — tercatat sampai di Tempat Uang mana ✅.

## 2. Keadaan sekarang

Verifikasi hanya menyimpan uang **tunai** yang diterima (`shifts.deposit_received_cash`,
`deposit_variance`). Penjualan non-tunai langsung masuk rekening tanpa dicocokkan.

## 3. Isi ✅

- Layar verifikasi menampilkan **setiap metode bayar** shift itu: angka menurut kasir, kolom
  **"diterima"**, dan selisih.
- Kolom "diterima" **wajib diketik** oleh Finance dari mutasi rekening — **tidak terisi otomatis**
  ✅ (owner memilih "yang lebih aman").
- Setiap metode menunjuk ke Tempat Uang (02 §3), misalnya QRIS Toko B → Rekening Toko B.
- Kalau ada selisih, **wajib memilih sebab** 💡: potongan bank / dana belum cair / salah input
  kasir / lainnya + catatan.
- **Potongan bank QRIS/EDC** dicatat sebagai **Biaya Bank** (masuk laba rugi), **bukan minus
  kasir** ✅.
- **Dana belum cair** (mis. QRIS H+1): verifikasi non-tunai boleh menunggu; shift tetap tertutup,
  status "menunggu dana masuk" 💡.

## 4. Selisih tampil di mana ✅

| Tempat | Isi |
|---|---|
| Layar verifikasi (Riwayat Shift) | Per metode: kasir vs diterima vs selisih + sebab |
| Detail Shift | Ringkasan selisih per metode sesudah diverifikasi |
| Laporan Minus Kasir (sudah ada) | **Hanya** selisih bersebab "salah kasir"; potongan bank tidak masuk |
| Finance | Biaya Bank di laba rugi; daftar dana non-tunai belum cair per rekening |

## 5. Dibahas sambil jalan 🗣️

- Finance libur: siapa yang memverifikasi (00 §10 no.10).

## 6. Kriteria selesai

- Shift dengan penjualan tunai + QRIS + transfer bisa diverifikasi per metode; tidak bisa disimpan
  tanpa mengetik setiap metode.
- Potongan bank tidak menambah Minus Kasir.
- Shift yang dananya belum cair bisa diselesaikan verifikasinya kemudian.

## 7. Pertanyaan terbuka

- ❓ Batas waktu "dana belum cair" sebelum ditandai merah (mis. 2 hari kerja)?
- ❓ Apakah verifikasi non-tunai tetap memakai pola ketik dua kali seperti tunai?

## 8. Keputusan owner 2026-11-08 (sesudah PRD disetujui) — bahan spec F2-2 ✅

Dibahas sesudah F2-1b tayang staging. **Wajib dibaca sebelum menulis spec F2-2**; mengubah §3 di atas
untuk bagian tunai.

1. **Brankas = muara semua uang tunai** ✅. Tempat Uang jenis Tunai, dipegang Finance. Usul agent: owner
   membuat "Brankas" (nama persis) di Back Office produksi sebelum HRIS rilis, supaya migrasi hris 0056
   memakainya dan tidak membuat dobel. "Rekening Kantor" (isi awal HRIS) dinonaktifkan bila tidak ada.
2. **Semua perpindahan uang setoran tercatat otomatis saat Finance menekan Verifikasi** ✅ — tidak ada
   catat manual terpisah. Tunai: Laci toko → Brankas atau → Rekening toko, sebesar yang **diketik**
   Finance. Non-tunai: → Rekening tautan metode bayar per cabang (F2-1a). Pindah Dana manual (F2-4)
   hanya untuk kejadian tidak rutin (Brankas → bank, tarik tunai, kas kecil, rekening → rekening).
3. **Beberapa cabang setor tunai ke bank** (contoh Toko Raja, Toko Markas), sesekali uangnya diantar ke
   kantor ✅. Setor bank biasanya **tiap 3–4 hari**, tergantung situasi.
4. Maka verifikasi dipisah dua ✅:
   - **Non-tunai per shift** (QRIS/transfer/EDC, per metode wajib diketik) — kapan saja, tidak menunggu tunai.
   - **Tunai per "Setoran Tunai"**: satu setoran boleh berisi **beberapa shift** satu cabang. Tujuan:
     **Rekening** (setor bank) atau **Brankas** (diantar ke kantor). Usul: tujuan bawaan per cabang
     diatur di Tempat Uang › Metode Bayar per Cabang (baris Tunai), bisa diganti saat melapor/verifikasi.
5. **Yang menyetor = tim cabang itu sendiri**, slip setoran dilaporkan ke Finance ✅. Alur usulan:
   - **POS** menu baru **"Setor Tunai"**: daftar shift tunai belum disetor (jumlah, total, umur) →
     **Laporkan Setoran**: centang shift (bawaan semua, tertua dulu), pilih setor bank / antar kantor,
     nominal, tanggal, **foto slip OPSIONAL** ✅ (owner: kerja di komputer, perlu sosialisasi dulu) →
     status "Menunggu verifikasi Finance", Finance diberi tahu.
   - **Back Office** grup Shift, menu baru **"Setoran"**, 4 tab: **Menunggu Verifikasi** (Finance cocokkan
     mutasi, ketik nominal yang masuk, pilih sebab selisih, Verifikasi) · **Non-tunai** (per shift per
     metode) · **Tunai belum disetor** (pantauan per cabang) · **Riwayat**.
   - Riwayat Shift: tombol verifikasi lama diganti tautan ke Setoran; Detail Shift menampilkan status
     tunai & non-tunai (belum disetor / menunggu verifikasi / terverifikasi).
6. **Satu shift tidak boleh terbagi** ke dua setoran ✅ — selalu utuh.
7. **Peringatan tunai belum disetor**: ikut usul agent ✅ — **5 hari atau Rp25 juta**, mana lebih dulu,
   angka di Pengaturan.
8. Selisih dicatat di tingkat Setoran ✅ (usul agent): sebab "biaya setor bank" → Biaya Bank (bukan Minus
   Kasir); sebab "kurang dari kasir" → Finance memilih shift & kasir yang kurang → masuk Minus Kasir.
9. Finance libur: setoran menunggu di tab Menunggu Verifikasi, atau diverifikasi GM/Owner; shift tidak
   terkunci (spec F2-1 §9 no.7). Verifikasi mencatat **siapa** yang memverifikasi + salinan "dipegang
   oleh" Tempat Uang tujuan (spec F2-1 §2.3).
10. Pelunasan otomatis utang antar cabang (F2-3, PRD 04) dijalankan dari Setoran yang terverifikasi.

Masih terbuka untuk spec F2-2: §7 di atas (batas dana belum cair; ketik dua kali untuk non-tunai?), dan
apakah toko yang **tidak** pernah setor bank juga melapor lewat "Setor Tunai" di POS atau cukup Finance
yang membuat setorannya saat uang diterima di kantor.
