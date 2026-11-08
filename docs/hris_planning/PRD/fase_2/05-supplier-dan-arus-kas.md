# 05 — Bayar Supplier & Arus Kas (Langkah F2-4)

Sumber v3: `06-keuangan.md` bagian 3.3 (kejadian, kategori, yang bukan biaya), 3.9 & 3.24
(supplier dan utang supplier). Dasar POS: hutang supplier (`supplier_payables`,
`supplier_payable_payments`), retur & kredit supplier, Arus Kas (`cash_flow_categories`,
`cash_flow_entries`), Pengeluaran Kasir saat shift (`shift_expenses`, `expense_categories`).

## 1. Tujuan

- **Bayar hutang supplier dituntaskan di Back Office** ✅ — Finance cukup membaca.
- **Arus Kas Back Office = satu-satunya tempat input** biaya seperti listrik, air, internet,
  perbaikan, dll. ✅ ("tempat kerjanya hanya satu saja / inputnya").

## 2. Bayar hutang supplier

- Ditambah **"dibayar dari"** (Tempat Uang, 02) di setiap pembayaran; cara bayar lama
  (tunai/transfer/cek) tetap.
- Pembayaran lama tanpa "dibayar dari" ditandai "belum diketahui" — tidak diisi tebakan.

## 3. Arus Kas

- **Kategori** ditambah lewat Back Office (pengaturan kategori **sudah ada**: Arus Kas ›
  Kategori) ✅; agent menyiapkan **daftar kategori bawaan** — **isinya dibahas dulu dengan owner**
  ✅ ("tapi ini harus kita bahas").
- Ditambah pada setiap catatan 💡→✅ ("saya setuju, tapi harus dikembangkan lagi"):
  - **Dibayar dari / masuk ke** (Tempat Uang)
  - **Cabang yang menanggung** (kolom sudah ada)
  - **Foto bukti**
  - **Untuk bulan apa** (terpisah dari tanggal bayar)
- **Pencatat**: Finance, GM, Owner, dan Kepala Toko untuk tokonya sendiri bila posisinya sudah ada ✅.
- Listrik dicatat tiap bulan sesuai tagihan (angkanya berubah-ubah, **bukan** Biaya Rutin) ✅.

## 4. Dibahas sambil jalan 🗣️

- **Dua daftar kategori** (Pengeluaran Kasir dari laci vs Arus Kas) disatukan agar satu biaya
  tidak punya dua nama.
- **Uang diambil Owner** (pribadi) — bukan biaya.
- **Modal masuk & pinjaman** (+ cicilan) — uang masuk bukan penjualan.
- Kategori yang "bukan biaya" (v3 3.3: pindah dana, bayar supplier, kasbon, pribadi, dll.) supaya
  tidak mengurangi laba.

## 5. Kriteria selesai

- Setiap pembayaran supplier baru menyebut Tempat Uang asalnya.
- Satu biaya listrik bisa dicatat dengan cabang, bukti, "untuk bulan", dan Tempat Uang; tampil
  benar di Arus Kas dan kelak di Finance.

## 6. Pertanyaan terbuka

- ❓ Daftar kategori bawaan (dibahas saat spec F2-4).
- ❓ Apakah catatan Arus Kas boleh diubah sesudah disimpan, atau koreksi lewat catatan pembalik
  (prinsip "tidak ada edit/hapus" Fase 1)?
