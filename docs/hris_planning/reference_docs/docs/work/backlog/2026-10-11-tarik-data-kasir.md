# Tarik data dari sistem kasir

Tanggal: 11 Oktober 2026

## Masalah

Banyak data yang dibutuhkan HRIS sebenarnya sudah ada di sistem kasir
(admin.hammielion.com): transaksi, toko, dan lainnya. Banyak laporan di HRIS
bergantung pada data itu. Kalau diketik ulang di HRIS, pekerjaan menjadi dua kali
dan angkanya bisa berbeda.

Contoh dari pemilik: saat membuat rencana kirim, kepala gudang seharusnya cukup
menentukan mobil mana yang berangkat dan memilih tokonya. Data transaksinya sudah
tersedia, tidak perlu diatur lagi.

## Yang diinginkan

V3 menyiapkan satu tempat khusus untuk menarik data dari sistem kasir.

- **Satu arah.** HRIS hanya mengambil. HRIS tidak pernah menulis ke sistem kasir.
- **Satu pintu.** Hanya satu modul ("Tarik Data Kasir") yang berhubungan dengan
  sistem kasir. Modul lain membaca dari modul ini, tidak menarik sendiri-sendiri.
- **Tercatat.** Setiap data hasil tarikan mencatat kapan ditarik dan dari mana.
- **Bisa bertambah.** Jenis data yang ditarik akan bertambah seiring kebutuhan
  laporan, jadi tempatnya dirancang untuk banyak jenis data, bukan satu.

## Rancangan awal (belum disetujui)

Dari pembicaraan sebelumnya:

1. Sistem kasir menyediakan satu pintu baca saja, dilindungi kunci.
   Saat ini sistem kasir belum punya pintu seperti itu; harus dibuat di sana.
2. Server HRIS menarik data secara berkala.
3. Toko di kasir dipasangkan dengan toko di HRIS lewat satu kode.
   Sistem lama sudah menyiapkan kolom untuk ini (migrasi 090).
4. Transaksi yang dibatalkan di kasir ikut membatalkan datanya di HRIS.

## Pertanyaan yang belum terjawab

1. Jenis transaksi mana yang ditarik? Grosir saja, atau juga pindah stok antar cabang?
2. Bagaimana pelanggan di kasir dipasangkan dengan toko tujuan pengiriman?
3. Data lama ditarik sejak kapan?
4. Laporan apa saja yang membutuhkan data kasir? Daftar ini menentukan data apa
   yang perlu ditarik.

## Kapan dikerjakan

Tempatnya dirancang di Tahap 3 (rancangan lintas modul).

Diubah pemilik 12 Oktober 2026 (Bab 4, bagian 4A.10 aturan 8): di tahap awal
surat jalan **diketik manual**. Modul ini disiapkan sejak modul Logistik dibangun
(kode kasir di toko, nomor surat jalan, tanda sumber), tetapi penarikan otomatis
dinyalakan belakangan sebagai fitur tambahan, supaya saat itu tinggal berjalan.

Sudah terjawab di 4A: satu penjualan grosir Gudang ke toko di kasir = satu surat
jalan (pertanyaan 1), dan nama toko milik kasir; HRIS hanya menambah data
pengiriman (pertanyaan 2).

Ditambah pemilik 12 Oktober 2026 (Bab 5, bagian 5B.10 aturan 21 dan 22):

- **Daftar produk** (kode, nama, satuan) masuk lewat **file export dari sistem
  kasir yang diunggah** di modul ini; pemilik yang mengambil filenya. Dipakai
  Laporan Bongkaran untuk mencari barang. Bentuk filenya (kolom apa saja) belum
  ditentukan.
- **Purchase order** kasir disiapkan sebagai jenis data berikutnya: Laporan
  Bongkaran memilih purchase order, lalu Kepala Gudang hanya mencocokkan
  jumlah. Dinyalakan belakangan.

Ditambah pemilik 12 Oktober 2026 (Bab 6, bagian 6B.10 aturan 5, 11, dan 19):

- **Settlement per shift** (cash, non-tunai per metode, piutang): sistem kasir
  sudah mencatatnya saat settle. Kelak mengisi Laporan Kasir sendiri; kasir
  tinggal menghitung uang fisik.
- **Uraian QRIS per transaksi**: dipakai finance untuk mencocokkan non-tunai
  dengan mutasi satu per satu.
- **Shift** di sistem kasir dicocokkan dengan shift di Laporan Kasir.

Pekerjaan ini menyentuh dua sistem. Perubahan di sistem kasir mengikuti aturan
project kasir (push ke main berarti langsung tayang ke toko) dan dikerjakan
terpisah dari folder ini.

**Ditetapkan 13 Oktober 2026 (Tahap 3F)** di
`../specs/2026-10-13-tarik-data-kasir-desain.md` dan PRI-39: jadwal per jenis
data, kasir mati, perubahan setelah dipakai, ditarik sejak hari mulai, hak.
Pertanyaan 3 dan 4 di atas terjawab di sana. **Arah sebaliknya ditiadakan**
(pemilik: "cukup tarik dari kasir saja ke HRIS, biar tak pusing"); kiriman ke
kasir tetap dicatat tangan (LOG-65). **Order grooming milik kasir** (LOG-89):
modul ini juga menarik jasa grooming yang selesai untuk bonus grooming
(GAJ-61), serta baris ongkir dan pengantarnya untuk bonus ongkir (LOG-76;
Tahap 3G).
