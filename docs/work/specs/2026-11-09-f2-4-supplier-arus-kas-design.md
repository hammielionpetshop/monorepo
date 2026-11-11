# F2-4 Bayar Supplier & Arus Kas — "Dibayar dari", Arus Kas dirapikan, Pindah Dana

PRD: `docs/hris_planning/PRD/fase_2/05-supplier-dan-arus-kas.md` (+ 02 Tempat Uang, 03 §8 Pindah Dana).
Status: **disetujui owner 2026-11-09** ("ok" atas isi lengkap, termasuk "Bersama" dan rentang Untuk bulan). Sudah diputuskan owner 2026-11-09: kategori
bawaan "sudah ok" (bisa ditambah/diganti nanti), kategori lama dipilih jenisnya oleh owner, pembatalan
"ikuti saran anda", urutan 4a → 4b → 4c "ok". Usul baru di draf ini: sewa sementara (§3.3), "Bersama" (§3.1).

## 1. Keadaan sekarang (diperiksa di kode `origin/main` `36d50827`)

- **Bayar hutang supplier** (`supplier_payable_payments`, `POST /api/bo/supplier-payables/[id]/pay`,
  hak `payable.pay`): cara bayar (tunai/transfer/cek), nomor referensi, catatan, foto bukti. Ada metode
  sistem tanpa uang (`RETUR`, `SALDO SUPPLIER`, `RETUR BATAL`). Belum ada asal uang.
- **Arus Kas** (`cash_flow_entries`, `POST /api/bo/cash-flow/entries`): jenis, kategori, jumlah, catatan.
  Tanggal = waktu simpan; cabang = cabang aktif login; tanpa cek hak (asal login). Tidak ada ubah/hapus.
  Daftar hanya cabang aktif, 200 baris terakhir.
- **Kategori Arus Kas** (`cash_flow_categories`, hak `cashflow.category.manage` Owner/GM/Manager): tambah,
  ganti nama, hapus (ditolak bila sudah dipakai). Dua kategori otomatis dari bayar utang internal manual:
  `Bayar Hutang Internal` (EXPENSE), `Terima Piutang Internal` (INCOME).
- **Pengeluaran Kasir** dari laci (`shift_expenses` + `expense_categories`) daftar kategorinya terpisah.
- **Laba Rugi** belum dikurangi biaya apa pun dari Arus Kas (laba bersih nanti di Finance, F2-6).

## 2. F2-4a — "Dibayar dari" di Bayar Supplier

- Setiap pembayaran **beruang** wajib memilih **Dibayar dari** (Tempat Uang aktif, bukan Laci):
  cara bayar Tunai → hanya tempat jenis Tunai; Transfer/Cek → hanya Rekening. Pilihan terakhir diingat
  di peramban sebagai bawaan.
- Metode sistem tanpa uang (Retur, Saldo Supplier, Retur Batal) tidak memakai Tempat Uang.
- Pembayaran lama: kolom kosong, tampil **"belum diketahui"**; tidak diisi tebakan.
- Riwayat pembayaran di layar Hutang Supplier menampilkan kolom "Dibayar dari".
- Data: `supplier_payable_payments.money_place_id` (nullable, FK `money_places`). Server menolak bila
  metode beruang tanpa tempat, tempat tidak aktif, Laci, atau jenisnya tidak cocok dengan cara bayar.

## 3. F2-4b — Arus Kas dirapikan

### 3.1 Isian catatan

| Isian | Aturan |
|---|---|
| Jenis | Uang masuk / Uang keluar (seperti sekarang) |
| Kategori | Dari daftar aktif; kategori sistem tidak bisa dipilih; kategori "hanya Owner" hanya untuk Owner |
| Jumlah | Bulat, > 0 |
| **Tanggal uang** | Bawaan hari ini (WIB). Tidak boleh masa depan; paling jauh 7 hari ke belakang, lebih dari itu hanya Owner |
| **Untuk bulan** | Bawaan bulan dari tanggal uang; boleh dipilih 12 bulan ke belakang s.d. 12 bulan ke depan (mis. sewa Oktober dibayar 1 November) |
| **Cabang yang menanggung** | Dipilih (bawaan cabang aktif) atau **"Bersama"** (biaya beberapa cabang; pembagiannya dibahas di Finance) |
| **Dibayar dari / Masuk ke** | Tempat Uang aktif jenis Tunai atau Rekening, wajib. Laci tidak ditawarkan (uang laci lewat Pengeluaran Kasir & Setoran) |
| **Foto bukti** | Dianjurkan, tidak wajib; tanpa foto bertanda "tanpa bukti" |
| Catatan | Wajib untuk kategori "… lain" |

Catatan lama: tanggal uang & untuk bulan diisi dari tanggal simpannya; Tempat Uang "belum diketahui".

### 3.2 Pencatat dan pembatalan

- Hak baru `cashflow.record`: **Owner, GM, Finance**. (Kepala Toko untuk tokonya menyusul saat
  jabatannya ada.)
- Catatan **tidak bisa diubah atau dihapus**. Yang salah **dibatalkan dengan alasan wajib**, tetap
  terlihat bertanda **Batal**, lalu dicatat ulang. Catatan otomatis (dari bayar utang internal) tidak
  bisa dibatalkan dari Arus Kas.
- Yang boleh membatalkan (usul agent, owner "ikuti saran anda"): **pencatatnya sendiri pada hari yang sama**
  (salah ketik langsung dibetulkan); **sesudah itu hanya Owner/GM** (hak baru `cashflow.cancel`).
- Daftar Arus Kas: saringan tanggal, cabang (termasuk Bersama), jenis, kategori, Tempat Uang, tampilkan
  Batal; tidak lagi terkunci ke cabang aktif bagi pemegang `cashflow.record`.

### 3.3 Kategori

- Tiap kategori punya **jenis laporan**: **Biaya** (mengurangi laba), **Bukan biaya** (tidak mengurangi
  laba, mis. diambil Owner, cicilan pinjaman), atau **Uang masuk** (pendapatan lain / bukan pendapatan,
  lihat tabel). Kategori lama di produksi mulai berstatus **"jenis belum dipilih"** dan owner memilihnya
  satu per satu di layar Kategori (keputusan owner no. 2); selama belum dipilih, kategori tetap bisa
  dipakai dan Finance menandainya.
- **Owner bisa menambah, mengganti nama, dan menonaktifkan** kategori kapan saja (jawaban pertanyaan
  owner "nanti bisa saya tambah/ganti?"):
  - **Tambah**: kapan saja.
  - **Ganti nama**: kapan saja; catatan lama ikut tampil dengan nama baru.
  - **Ganti jenis laporan**: hanya selama kategori belum pernah dipakai. Bila sudah dipakai, buat
    kategori baru lalu nonaktifkan yang lama, supaya laporan bulan lalu tidak berubah diam-diam.
  - **Hapus**: hanya bila belum pernah dipakai; selain itu **Nonaktif** (hilang dari pilihan, tetap di
    laporan).
- **Daftar bawaan** (disisipkan migrasi bila namanya belum ada; nama yang sama dengan kategori lama owner
  tidak digandakan):

| Jenis laporan | Arah | Kategori |
|---|---|---|
| Biaya | Keluar | Listrik · Air/PDAM · Internet & pulsa · Perbaikan & perawatan · Perlengkapan toko & kebersihan · Alat tulis & cetak · Konsumsi karyawan · Parkir, tol & ongkos jalan · Kebutuhan hewan & grooming · Biaya bank · Iuran & retribusi · Pajak · Bantuan karyawan · **Sewa (sementara)** · Pengeluaran lain (catatan wajib) |
| Bukan biaya | Keluar | Diambil Owner / pribadi (**hanya Owner**) · Bayar cicilan pinjaman |
| Uang masuk | Masuk | Rebate/cashback supplier · Jual barang bekas · Modal masuk dari Owner (bukan pendapatan) · Pinjaman masuk (bukan pendapatan) · Pemasukan lain (catatan wajib) |
| Sistem (bukan biaya, tidak bisa dipilih) | Keluar/Masuk | Bayar Hutang Internal · Terima Piutang Internal |

- **Sengaja tidak ada di Arus Kas** (supaya tidak tercatat dua kali): bensin (Logistik), gaji/bongkaran/
  kasbon (HRIS), bayar supplier (menu Hutang Supplier), sewa mobil per ritase (Logistik, F2-5).
- **Biaya sewa** (pertanyaan owner): sampai **Biaya Rutin (F2-5)** tayang, sewa toko/kendaraan dicatat di
  Arus Kas dengan kategori **"Sewa (sementara)"** + isian **Untuk bulan**. Saat F2-5 tayang, sewa dicatat
  lewat Biaya Rutin (angka tetap, pengingat, tombol Bayar), kategori ini dinonaktifkan untuk catatan baru,
  dan catatan lama tetap terbaca Finance — tidak ada catatan yang dipindah atau dihitung dua kali.

### 3.4 Pengeluaran Kasir disambungkan

- Tampilan kasir **tidak berubah**. Di Back Office (layar Kategori Arus Kas, tab "Pengeluaran Kasir"),
  tiap kategori Pengeluaran Kasir dipasangkan ke **satu kategori Arus Kas** (`expense_categories.
  cash_flow_category_id`), supaya Finance membaca satu nama untuk satu biaya. Yang belum dipasangkan
  ditandai. Pengeluaran Kasir tetap dicatat di shift, tidak disalin ke Arus Kas.

## 4. F2-4c — Pindah Dana

- Menu Arus Kas › **Pindah Dana**: dari Tempat Uang → ke Tempat Uang (Tunai/Rekening aktif, tidak sama,
  bukan Laci), jumlah, tanggal uang (aturan 3.1), catatan, foto bukti (dianjurkan). Contoh: Brankas →
  rekening (setor bank), rekening → Brankas (tarik tunai), Brankas → kas pegangan.
- Bukan biaya dan bukan pendapatan. Biaya transfer (bila ada) dicatat terpisah di Arus Kas kategori Biaya
  bank.
- Tercatat di `money_movements` sumber baru `TRANSFER` (asal wajib). Pencatat & pembatalan sama dengan
  3.2; batal = baris pembalikan negatif (aturan `money_movements` yang ada).
- Setoran toko tetap lewat Setoran (F2-2), bukan Pindah Dana.

## 5. Data (migrasi petshop, satu per langkah)

- **4a `0059`**: `supplier_payable_payments.money_place_id`.
- **4b `0060`**: `cash_flow_entries` + `occurred_on date`, `for_month date` (tanggal 1), `money_place_id`,
  `proof_photo_url`, `cancelled_at`, `cancelled_by`, `cancel_reason`; isi data lama dari `created_at` (WIB);
  trigger menolak perubahan selain kolom pembatalan, dan menolak hapus. `cash_flow_categories` +
  `report_kind` (`COST` · `NON_COST` · `INCOME` · NULL = belum dipilih), `is_active`, `is_system`,
  `owner_only`, `note_required`; dua kategori otomatis diberi `is_system`/`NON_COST`; sisipkan daftar
  bawaan. `expense_categories.cash_flow_category_id`. Hak `cashflow.record`, `cashflow.cancel`.
- **4c `0061`**: `money_movements` sumber `TRANSFER` + tabel `money_transfers` (pencatat, catatan, foto,
  pembatalan) bila diperlukan; diputuskan di rencana kerja 4c.
- Saldo per Tempat Uang belum dihitung di F2-4 (Finance, F2-6).

## 6. Tes (non-UI)

- 4a: metode beruang tanpa tempat ditolak; Tunai ↔ Rekening tidak cocok ditolak; Laci/nonaktif ditolak;
  Retur/Saldo tanpa tempat diterima.
- 4b: batas tanggal (masa depan, > 7 hari non-Owner); kategori sistem/nonaktif/hanya-Owner; pembatalan
  (pencatat hari sama boleh, besok ditolak, Owner/GM boleh, alasan wajib, otomatis ditolak); trigger
  menolak ubah jumlah & hapus; ganti jenis kategori yang sudah dipakai ditolak; isi data lama migrasi.
- 4c: asal = tujuan ditolak; batal membuat pembalikan.

## 7. Langkah uji owner (staging)

1. 4a: bayar hutang supplier tunai dari Brankas, transfer dari rekening; coba tunai dari rekening (ditolak);
   lihat kolom "Dibayar dari" dan "belum diketahui" di pembayaran lama.
2. 4b: catat listrik Oktober dibayar hari ini dari rekening, cabang Toko Pusat, dengan foto → tampil di
   daftar dengan untuk bulan Oktober. Catat sewa (sementara) untuk bulan lalu. Batalkan catatan sendiri
   hari ini; coba batalkan catatan kemarin sebagai Finance (ditolak), lalu sebagai Owner (boleh).
   Pilih jenis laporan kategori lama; pasangkan kategori Pengeluaran Kasir.
3. 4c: pindah Brankas → rekening, lalu batalkan.

## 8. Urutan kerja

4a → 4b → 4c, masing-masing klaim sendiri, tayang staging, uji owner; rilis produksi boleh digabung
sesuai keputusan owner saat itu. Sesudah F2-4: F2-5 Biaya Rutin + sewa mobil per ritase (bahas dulu).
