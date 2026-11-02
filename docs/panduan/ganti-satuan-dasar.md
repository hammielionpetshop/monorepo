# Panduan: Mengganti Satuan Dasar Barang

Menu: **Back Office › Inventori › Migrasi Satuan Stok**
Yang boleh: **Owner** dan **GM** saja.

---

## Ini untuk apa?

Setiap barang punya **satuan dasar**, yaitu satuan **paling kecil** yang dipakai untuk
menghitung stok.

Kadang satuan dasarnya **salah**. Contoh:

> Pakan kucing "Whiskas" dijual per **PCS** dan per **SAK** (1 SAK isinya 25 PCS).
> Satuan dasarnya harusnya **PCS**, tapi tercatat **SAK**. ❌

Menu ini membetulkannya **dalam 1 klik**. Stok di semua cabang ikut dihitung ulang otomatis.

---

## Sebelum mulai, siapkan 1 angka saja

**1 satuan lama isinya berapa satuan baru?**

- 1 SAK = **25** PCS
- 1 DUS = **48** PCS
- 1 BAL = **10** PCS

> ⚠️ **Angka ini paling penting.** Kalau salah, stok ikut salah.
> Kalau ragu, **buka dan hitung barangnya langsung.** Jangan menebak.

---

## Langkah-langkah

### Langkah 1: Pilih barang
Ketik nama barang di kotak pencarian, lalu klik barangnya.
Di bawahnya muncul tulisan *"Satuan dasar sekarang: SAK"*.

### Langkah 2: Pilih satuan dasar baru
Pilih satuan **paling kecil**, misalnya **PCS**.

### Langkah 3: Isi angkanya
Di kotak `1 SAK = [ ] PCS`, ketik angkanya, misalnya **25**.

### Langkah 4: Klik "Lihat Pratinjau"
**Belum ada yang berubah.** Ini cuma contoh hasilnya. Periksa:

| Periksa ini | Contoh yang benar |
|---|---|
| Stok per cabang | 4 SAK → **100 PCS** (4 × 25) |
| Modal per batch | Rp 250.000/SAK → **Rp 10.000/PCS** (250.000 ÷ 25) |
| Nilai stok | Sebelum dan sesudah **sama** (tulisan ✓ sama persis) |

Kalau angkanya aneh, **jangan lanjut**. Betulkan angka di Langkah 3, lalu klik pratinjau lagi.

Kalau muncul kotak merah **⛔ Belum bisa dijalankan**, baca alasannya dan selesaikan dulu
(lihat bagian *"Kalau muncul pesan ⛔"* di bawah).

### Langkah 5: Ketik nama barang, lalu klik "Jalankan Migrasi"
Ketik nama barangnya persis. Ini supaya tidak salah barang.
Lalu klik tombol merah **Jalankan Migrasi**.

### Langkah 6: Isi harga jual satuan baru ← **JANGAN DILEWATI**
Setelah berhasil, muncul kotak kuning **"Tugas berikutnya"**. Isinya daftar cabang yang
**belum punya harga jual per PCS**.

1. Klik **Buka Manajemen Harga**.
2. Isi harga jual per **PCS** untuk setiap kelas harga (Retail, Reseller, Grosir, Member) di cabang yang disebut.
3. Simpan.

> Selama harga PCS belum diisi, **kasir tidak bisa menjual per PCS.**
> Harga per SAK tetap ada dan tetap bisa dipakai.

### Langkah 7: Beri tahu kasir
Minta kasir **menekan refresh / muat ulang** layar kasir supaya satuan baru terbaca.

---

## Yang diurus otomatis oleh sistem

Admin **tidak perlu** mengerjakan ini satu per satu:

- ✅ Stok di **semua cabang** dikali isinya
- ✅ Batch stok: sisa dikali, modal dibagi. **Tanggal kedaluwarsa dan urutan FIFO tetap.**
- ✅ Modal di Manajemen Harga untuk PCS diisi otomatis
- ✅ Harga jual per SAK **tetap**
- ✅ Konversi satuan ditata ulang (SAK jadi "1 SAK = 25 PCS"; DUS/BAL ikut menyesuaikan)
- ✅ Riwayat penyesuaian stok dan utang stok ikut dikonversi, jadi laporan lama tetap benar
- ✅ Tercatat di log: siapa, kapan, sebelum dan sesudah

**Tidak diubah:** nota penjualan lama. Nota yang dulu menjual 1 SAK tetap tertulis 1 SAK.

---

## Jangan pakai Penyesuaian Stok untuk ini

❌ **Salah:** kurangi stok jadi 0, ganti satuan, lalu tambah stok lagi lewat Penyesuaian Stok.

Kenapa salah?
- Tanggal kedaluwarsa **hilang**
- Modal tiap batch **jadi satu harga** (atau kosong kalau lupa diisi)
- Laporan mencatat seolah-olah ada barang **hilang lalu masuk lagi**
- Harus diulang di setiap cabang, jadi gampang terlewat

✅ **Benar:** pakai menu **Migrasi Satuan Stok** ini saja.

---

## Kalau muncul pesan ⛔

| Pesan | Artinya | Yang harus dilakukan |
|---|---|---|
| *Masih ada di Stock Opname yang belum selesai* | Barang ini sedang dihitung di SO | Selesaikan SO-nya dulu (setujui/tolak), lalu ulangi |
| *Perubahan modal yang menunggu ditinjau* | Ada modal baru yang belum disetujui | Buka Tinjauan Modal & Margin, setujui/tolak dulu |
| *Stok berubah sejak pratinjau dibuat* | Ada penjualan saat Anda sedang memeriksa | Klik **Lihat Pratinjau** lagi, periksa, lalu jalankan |
| *Data konversi aneh* / *Stok tercatat di satuan …* | Ada data lama yang rusak | Hubungi tim IT, jangan diakali sendiri |
| *Isi harus angka bulat, minimal 2* | Angkanya salah ketik | Ketik angka bulat, misalnya 25 |

---

## Pertanyaan yang sering muncul

**Bisa dibatalkan?**
Tidak bisa dengan 1 klik. Semua perubahan tercatat lengkap, jadi tim IT bisa menelusuri dan
membetulkannya. Karena itu **pastikan angka isinya benar** sebelum klik Jalankan.

**Nilai stok berubah sedikit, kenapa?**
Modal dibulatkan ke rupiah. Contoh: Rp 250.010 ÷ 25 = Rp 10.000,40, jadi tersimpan Rp 10.000.
Selisihnya ditampilkan di pratinjau dan biasanya hanya beberapa rupiah.

**Scan barcode jadi masuk PCS?**
Ya. Setelah diganti, scan barcode barang itu masuk sebagai **1 PCS**. Kalau pembeli membeli
1 SAK, kasir mengganti satuannya ke **SAK** di keranjang.

**Bisa dari PCS ke SAK (ke satuan lebih besar)?**
Tidak. Menu ini hanya untuk mengganti ke satuan **yang lebih kecil**.
