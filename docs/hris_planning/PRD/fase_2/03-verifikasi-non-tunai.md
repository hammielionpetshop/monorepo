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
