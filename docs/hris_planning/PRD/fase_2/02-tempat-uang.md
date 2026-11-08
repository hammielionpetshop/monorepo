# 02 — Tempat Uang (Langkah F2-1)

Sumber v3: `06-keuangan.md` bagian 3.1 (Buku Kas dan tempat uang), 3.6 (Brankas, Kas Pegangan),
3.18 (pengaturan & angka awal).

## 1. Tujuan

Satu daftar **Tempat Uang** untuk semua web, sehingga setiap uang masuk dan keluar bisa menyebut
"dari mana" dan "ke mana" ✅ (owner: "ok saya setuju, untuk uang masuk juga sebaiknya ditetapkan").

## 2. Keadaan sekarang (2026-11-08)

| Tempat | Yang ada | Kurangnya |
|---|---|---|
| HRIS | `hris.payment_sources` (Sumber Uang: nama, tunai/transfer) dipakai bayar gaji, kasbon, bongkaran | Hanya untuk HRIS |
| Back Office | `payment_methods` (nama, jenis: tunai/transfer/e-wallet/QRIS/utang) | Cara bayar, bukan tempat uang; tidak tahu rekening mana |
| Back Office | Bayar hutang supplier: `method` tunai/transfer/cek | Tidak tahu dibayar dari mana |
| Back Office | Arus Kas: kategori + cabang | Tidak tahu dari/ke mana |

## 3. Isi

- Pengaturan di **Back Office › Pengaturan › Tempat Uang** 💡→✅ (owner: "sebaiknya ini dibuat dulu
  pengaturannya, karena bisa saya isi nanti").
- Setiap Tempat Uang: **nama**, **jenis** (tunai / rekening), **bank & nomor rekening** (untuk
  rekening), **cabang**, **dipegang oleh** (Finance / toko / lainnya), aktif/nonaktif (tidak
  dihapus).
- Tiga kelompok contoh:

| Kelompok | Contoh | Catatan |
|---|---|---|
| Di toko | Laci kasir Toko A/B/C/D | Gerak uangnya sudah tercatat lewat shift POS |
| Rekening toko | Rekening Toko A, B, C, D | Owner: **semua toko punya rekening sendiri** ✅ |
| Di kantor/gudang | Kas tunai Finance, brankas, rekening utama, uang pegangan driver | Owner: uang tunai cabang ada yang dibawa ke kantor, ada yang disetor sendiri; **dipegang Finance, diawasi Owner** ✅ |

- **Aturan "sampai di Finance"** 💡→✅: uang dianggap sudah diterima kantor saat masuk ke Tempat Uang
  yang **dipegang Finance** — tunai ke kantor maupun transfer ke rekening toko (yang dipegang
  Finance). Rekening yang suatu saat dipegang toko ditandai "dipegang toko"; setoran ke sana
  belum dihitung diterima kantor (dipakai di 04).
- **Metode bayar non-tunai ditautkan ke Tempat Uang** per cabang (mis. "QRIS" di Toko B → Rekening
  Toko B), dipakai di verifikasi (03).
- **HRIS Sumber Uang** 💡 berubah menjadi membaca Tempat Uang Back Office (HRIS belum produksi,
  jadi perubahannya murah). Data Sumber Uang staging dipetakan sekali.

## 4. Kasus yang harus tertangani

- **Toko setor ke rekening sendiri, lalu rekening itu dipakai bayar supplier luar** ✅ (kasus
  owner): tercatat `Laci Toko B → Rekening Toko B → Supplier X`, asalkan bayar supplier menyebut
  "dibayar dari: Rekening Toko B" (05).

## 5. Dibahas sambil jalan 🗣️

- **Pindah Dana** antar Tempat Uang (setor tunai ke bank, tarik ATM, isi uang pegangan): dicatat
  di mana dan oleh siapa.
- **Saldo awal** tiap Tempat Uang dan tanggal mulainya.
- **Finance libur**: siapa yang menerima uang dan memverifikasi.

## 6. Kriteria selesai

- Owner/GM bisa menambah, mengubah, menonaktifkan Tempat Uang; tidak bisa menghapus yang pernah
  dipakai.
- Metode bayar non-tunai tiap cabang bisa ditautkan ke satu Tempat Uang.
- Layar bayar di HRIS memilih dari Tempat Uang yang sama.

## 7. Pertanyaan terbuka

- ❓ Siapa yang boleh mengubah daftar Tempat Uang: Owner/GM saja, atau Finance juga?
