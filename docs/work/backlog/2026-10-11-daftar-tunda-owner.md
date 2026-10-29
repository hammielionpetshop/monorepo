# Daftar Tunda & Daftar Bahas — keputusan owner

**Terakhir diperbarui:** 2026-10-11
**Sumber:** tinjauan menyeluruh bersama owner 2026-10-11 (setelah rilis 1.107.64).
**Cara pakai:** baca berkas ini di awal sesi kerja. Yang berstatus **TUNDA** jangan dikerjakan atau
ditawarkan ulang kecuali owner memintanya; yang berstatus **BAHAS** wajib diangkat lagi ke owner
sebelum disentuh. Repo ini publik — urusan keamanan/akses server **tidak** dicatat di sini.

Aturan status (owner 2026-10-11): pekerjaan yang sudah tayang tetapi belum dicoba owner ditulis
**"tayang — menunggu uji coba owner"**, bukan "selesai".

## A. Menunggu uji coba owner di toko

| Versi | Isi |
|---|---|
| 1.107.52–54 | Utang stok dilunasi saat void; filter halaman Utang Stok; kolom Pelanggan/Pihak di Timeline Mutasi Stok |
| 1.107.55 | Hutang Supplier (halaman, catat bayar, jatuh tempo) |
| 1.107.57 | Estafet shift (struk shift 2 berisi rekap hari; Riwayat Shift digabung) |
| 1.107.58–61 | Retur ke Supplier; supplier nonaktif; alasan "barang tidak datang" |
| 1.107.62 | Retur Internal (Barang Dikembalikan, Saldo Internal otomatis, Revisi Harga Beli); Batalkan Retur Supplier |
| 1.107.63 | Baris "Batal Retur" di Mutasi Stok |
| 1.107.64 | Foto bukti transfer opsional (piutang pelanggan & hutang supplier, Back Office) |
| 1.107.66 | Tanda "Baru" di menu; daftar pilih kiriman di form Retur Internal |
| 1.107.67 | Tanda "Baru" juga di tambahan dalam halaman |
| 1.107.68 | Nomor transaksi kembar dicoba ulang otomatis — tanyakan kasir apakah pesan "Gagal menyimpan transaksi" sudah hilang |

Sudah dicoba owner dan dinyatakan cocok: 1.107.56 (alur PO baru).

Uji staging 2026-10-29: pagination Riwayat Shift (Detail, Estafet, Detail Hari) sudah dicoba owner dan dinyatakan cocok. Owner meminta merge main dan mengizinkan fondasi HRIS ikut masuk; kandidat rilis 1.107.100. Ini tidak menyatakan fitur HRIS L1–L9 sudah diuji atau diaktifkan di produksi.

## B. BAHAS — wajib dibahas dengan owner sebelum dikerjakan

1. *(DITUNDA owner 2026-10-11 sore — lihat D; jangan diangkat sampai owner membukanya)* **Catatan kas otomatis untuk pembayaran hutang internal antar cabang.** Sejak 1.107.48 setiap
   Catat Pembayaran hutang internal otomatis membuat pengeluaran di cabang yang membayar dan
   pemasukan di cabang penerima di Pendapatan & Pengeluaran. Owner pernah meminta ini **ditahan
   (jangan diubah)**; 2026-10-11 owner menyatakan **harus dibahas**. Pertanyaan yang belum dijawab:
   apakah perpindahan uang antar cabang sendiri memang mau tampil sebagai pendapatan/pengeluaran,
   dan bagaimana tampilnya di laporan gabungan semua cabang.
2. *(dipindah ke D)* Utang stok — owner memutuskan 2026-10-11: dibereskan lewat **stock opname besar**.

**Tiga hal baru dari owner (2026-10-11 malam) — owner minta DIBAHAS SAMPAI TUNTAS; belum ada yang
dikerjakan, baru dianalisa. Angkat lagi di setiap sesi sampai ketiganya diputuskan.**

3. **Kirim data penjualan ke sistem HRIS + laporan milik owner (otomatis).** Yang diminta: nomor
   transaksi, nama barang, qty, harga, nama toko, total belanja, dan nama pelanggan — semua cabang.
   Hasil analisa: semua data itu sudah tersimpan per transaksi; aplikasi kasir **belum punya** jalur
   kirim/ambil data untuk sistem luar. Usul: sistem HRIS **mengambil** data lewat satu pintu
   baca-saja berkunci di aplikasi kasir (kasir tidak ikut terganggu bila HRIS mati). Belum dijawab
   owner: seberapa cepat data harus sampai; transaksi yang dibatalkan/dikoreksi/diretur ikut atau
   tidak; penjualan antar cabang (Bulk Sale) ikut atau tidak; transaksi tanpa nama pelanggan;
   mulai tanggal berapa; alamat & jenis database HRIS.
4. **Grooming (dan penitipan) dijadikan JASA, bukan barang.** Hasil analisa: saat ini aplikasi tidak
   mengenal "jasa" — grooming & hotel kucing terdaftar sebagai barang biasa, sehingga setiap terjual
   stoknya menjadi minus dan menimbulkan catatan utang stok bernilai nol. Usul: tanda **"Jasa (tanpa
   stok)"** di data produk; produk bertanda itu tidak memotong stok, tidak membuat utang stok, dan
   tidak ikut stock opname / transfer / PO. Butuh migrasi dan menyentuh jalur transaksi kasir
   (risiko sedang–tinggi). Belum dijawab owner: produk mana saja yang jasa; apakah perlu modal
   (mis. upah groomer); nasib stok minus & utang stok lama; apakah jasa boleh ikut Bulk Sale / PO
   Internal; apakah perlu laporan jasa terpisah.
5. **Diskon/promo otomatis yang diatur kantor untuk beberapa cabang.** Hasil analisa: **bisa
   dibuat, tetapi belum ada** — tabel promosi dan tingkat harga "PROMO" sudah disiapkan developer
   tetapi tidak pernah dipakai (kosong, tanpa layar); diskon yang ada sekarang hanya diskon manual
   per nota yang diketik kasir. Usul bertahap: mulai dari promo **potongan per barang** dengan
   masa berlaku dan pilihan cabang, tampil sebagai baris diskon di struk; bentuk lain (minimal
   belanja, beli X gratis Y) menyusul. Menyentuh harga & uang (risiko tinggi). Belum dijawab owner:
   bentuk promo yang dimaksud; berlaku untuk semua pelanggan atau eceran saja; boleh digabung
   diskon manual kasir atau tidak; siapa yang boleh membuat; ikut berlaku di portal pesanan atau
   tidak.

**Jawaban owner untuk butir 3–5 (2026-10-11 malam, putaran kedua) — jangan ditanya ulang:**

- **Butir 3 (data ke HRIS):** diambil **sekali di awal**, lalu **otomatis tiap 1 menit**, plus tombol
  **"tarik sekarang"** di HRIS. Transaksi yang dibatalkan / dikoreksi / diretur **tidak ikut**.
  Bulk Sale dan kiriman internal **tidak ikut**. Transaksi tanpa nama pelanggan **ikut**, di HRIS
  ditulis **RETAIL**. Tanggal mulai dan database HRIS: **belum ada** (HRIS masih disusun) →
  butir ini **menunggu HRIS**; yang bisa disiapkan lebih dulu hanya pintu baca-saja di sisi kasir.
  Masih terbuka: (a) transaksi yang sudah terambil lalu **baru kemudian** dibatalkan/dikoreksi/
  diretur — usul: pintu ikut memberi tahu supaya HRIS menghapus/membetulkannya; (b) Bulk Sale ke
  **pelanggan luar** (bukan cabang sendiri) ikut atau tidak — menurut data jumlahnya banyak, dan
  pesanan dari portal juga menjadi Bulk Sale.
- **Butir 4 (jasa):** yang jasa = **4 produk grooming + Hotel Cat**. Tidak ada modal/upah; ada
  **bonus 10% dari harga jual, dihitung per 1 jasa** (bukan dari total nota). Stok minus & utang
  stok lama: **biarkan dulu**. Perlu **laporan khusus jasa**. Setiap jasa **wajib** mencatat
  **siapa yang mengerjakan, nama kucing, dan nama pemilik** (data kucing wajib). Masih terbuka:
  contoh angka bonus; pengerja dipilih dari daftar apa; data kucing apa saja; pemilik wajib
  terdaftar sebagai pelanggan atau cukup diketik; diisi kasir saat bayar atau boleh menyusul;
  bonus dihitung dari harga sebelum atau sesudah diskon; bonus tampil di kasir atau cukup di HRIS;
  Hotel Cat dihitung per hari atau per kunjungan.
- **Butir 5 (promo):** ketiga bentuk dipakai (potongan per barang, minimal belanja, beli X gratis
  Y). Promo **tidak boleh digabung** dengan diskon manual kasir. Yang membuat: **Owner/GM**.
  **Berlaku juga di portal pesanan.** Golongan pelanggan yang kena promo: **harus ditentukan**
  (tafsir: dipilih per promo — menunggu penegasan owner). Masih terbuka: bila dua promo kena
  barang yang sama; jasa boleh dipromo atau tidak; promo untuk pesanan portal (yang menjadi Bulk
  Sale) berarti promo juga berlaku di Bulk Sale hasil pesanan.

**Urutan kerja yang disarankan:** jasa (bertahap) → pintu data untuk HRIS → promo (bertahap).

**Pembaruan 2026-10-11 malam (putaran berikutnya) — keputusan akhir owner:**

- **Butir 4 (jasa) — DIPUTUSKAN & MULAI DIKERJAKAN bertahap (J1–J4).** Semua keputusan ada di
  [`../specs/2026-10-11-jasa-grooming-design.md`](../specs/2026-10-11-jasa-grooming-design.md),
  urutannya di [`2026-10-11-jasa-grooming.md`](2026-10-11-jasa-grooming.md). Ringkasnya: tab
  Grooming di POS (Terima Kucing / Sedang Dikerjakan / Hotel "Segera hadir" / Sudah Selesai), satu
  jasa satu groomer, bonus 10% dari harga sesudah diskon per jasa, data pemilik & kucing wajib,
  karcis dua lembar, bayar saat ambil lewat piutang yang sudah ada (tanpa DP), ganti groomer oleh
  Owner di Back Office. **Hotel Cat di-pending.** Stok minus & utang stok lama grooming dibiarkan.
- **Butir 3 (data ke HRIS) — DISIMPAN DULU atas permintaan owner ("nanti dibahas").** Keputusan
  yang sudah ada dan tidak perlu ditanya ulang: yang diambil **semua yang ada di tab Transaksi**,
  apa pun asalnya (ini meralat jawaban sebelumnya soal Bulk Sale/kiriman internal); transaksi yang
  belakangan dibatalkan/dikoreksi **diberitahukan otomatis** ke HRIS pada pengambilan berikutnya;
  ambil sekali di awal → tiap 1 menit → tombol "tarik sekarang"; tanpa nama pelanggan ditulis
  RETAIL. Bonus jasa kelak diurus HRIS. Jangan diangkat sampai owner membukanya.
  *Pembaruan 2026-10-29:* penerima data ini bukan lagi HRIS, melainkan **app Keuangan** (semua
  laporan keuangan pindah ke sana). Keputusan di atas tetap berlaku. Lihat
  [`../../hris_planning/BRAINSTORM.md`](../../hris_planning/BRAINSTORM.md).
- **Butir 5 (promo) — DIBUKA owner 2026-10-12**, dirancang bertahap P0–P4: spec
  [`../specs/2026-10-12-promo-otomatis-design.md`](../specs/2026-10-12-promo-otomatis-design.md),
  backlog [`2026-10-12-promo-otomatis.md`](2026-10-12-promo-otomatis.md). Masih dibahas terpisah:
  batas diskon kasir, daftar alasan diskon, promo minimal belanja, promo di portal pesanan.
  Catatan lama: Tambahan keputusan: promo hanya untuk
  golongan **Retail**; jasa **boleh** kena promo. Perlu dicek ulang saat dibahas: "berlaku juga di
  portal pesanan" padahal pesanan portal menjadi Bulk Sale dan pelanggannya bisa bukan Retail.

**HRIS — penanggung minus kas shift (PENDING, owner 2026-10-29).** POS hanya menghitung uang fisik
sekali per shift (selisih per kasir tidak ada), padahal 37% shift berisi lebih dari satu kasir.
Pilihan: (A) penutup shift, (B) dibagi ke kasir yang bertugas, (C) hitung uang per kasir di POS.
Owner menundanya karena tiap pilihan membawa aturan berbeda. Wajib diputuskan sebelum langkah Gaji
HRIS (L4) selesai. Rincian: [`../../hris_planning/PRD/fase_1/06-gaji-bulanan.md`](../../hris_planning/PRD/fase_1/06-gaji-bulanan.md) §3.1a.

## C. Disarankan, menunggu "ok" owner

1. ~~Tautan ke form Retur Internal~~ — **dikerjakan 2026-10-11** dalam bentuk yang diminta owner:
   **daftar pilih kiriman di dalam form Retur Internal, terbaru di atas** (tayang 1.107.66). Tombol "Retur" di baris layar Transfer Internal / Hutang
   Piutang Internal **belum** dibuat; tambahkan bila owner memintanya setelah mencoba.
2. ~~Papan klaim & dokumen basi~~ — **dikerjakan 2026-10-11** atas izin owner: baris klaim
   `docs/usulan-laporan` dihapus, dua dokumen status April diberi tanda BASI, dan aturan
   pencegahnya ditulis di `CLAUDE.md` (Aturan Wajib).

## D. TUNDA — keputusan owner, jangan ditawarkan ulang

| Hal | Keputusan owner |
|---|---|
| **Seluruh urusan Pendapatan & Pengeluaran** — termasuk catatan kas otomatis hutang internal dan pembayaran supplier masuk ke sana | **nanti saja** (owner 2026-10-11): "sangat kompleks"; pencatatan uang fisik masih **manual di sistem lain**, aplikasi difokuskan ke **transaksi dan stok** dulu. Lihat glosarium bagian Keuangan. |
| Bayar hutang internal banyak sekaligus | **tidak usah ada** (dicoret) |
| Nomor referensi wajib saat catat pembayaran | opsional dulu; diganti foto bukti transfer (1.107.64) |
| Foto bukti di hutang internal antar cabang & di layar kasir | tidak perlu; cukup pilih metode |
| Salin ulang data toko ke laptop untuk uji coba | tunda dulu |
| Stok ringkas ≠ rincian batch (audit 3 Okt) dan **utang stok** (termasuk yang tidak terlunasi oleh retur / terima transfer / koreksi) | akan dibereskan owner lewat **stock opname besar** — menyetujui stock opname menutup utang stok produk yang dihitung (`applySOStockAdjustment` → `closeOpenShortfallsForRecount`). Tidak perlu perubahan kode dulu. |
| 46 hutang supplier lama | dikerjakan sesuai alur biasa lewat layar Hutang Supplier — tidak perlu ditindaklanjuti |
| Tawaran catat bayar setelah Setujui Penerimaan PO | **sudah ada** (popup "Nanti (Tempo)" / "Catat Bayar" di detail PO) — dianggap selesai |

## D2. Permintaan baru owner 2026-10-11 sore

- **Tanda "Baru"** di menu/fitur yang baru rilis, tampil 7 hari sejak rilis — tayang 1.107.66
  (`apps/backoffice/lib/new-features.ts`). Setiap fitur baru bermenu wajib
  didaftarkan di berkas itu (aturan di `CLAUDE.md`).
- ~~Restart server~~ — **selesai 2026-10-11 malam** atas perintah owner, di luar jam ramai dan setelah backup:
  mati ±2 menit, semua layanan menyala sendiri, pembaruan keamanan sistem aktif. Catatan: `../../ops/README.md`.
- **WhatsApp belum tersambung** (temuan saat restart, bawaan lama): layanan WhatsApp meminta scan QR sejak
  dipasang awal Oktober, jadi OTP/notifikasi WhatsApp portal pesanan tidak terkirim. Kasir & Back Office tidak
  terpengaruh. **Menunggu keputusan owner**: scan nomor toko lewat Pengaturan → WhatsApp, atau biarkan dulu.

- **Nomor transaksi kembar** (temuan audit 2026-10-11, bawaan lama): nomor acak 4 angka per hari bertabrakan beberapa kali sehari → kasir melihat "Gagal menyimpan transaksi" lalu mengulang (dikonfirmasi owner). Owner memilih **cara A**: coba ulang otomatis dengan nomor baru, **format nomor tetap** (tayang 1.107.68). Nomor urut **tidak** dipilih: tetap butuh penanganan tabrakan, membuka jumlah transaksi harian di struk, dan perubahannya lebih besar di jalur kasir.

## E. Sudah beres (dicatat supaya tidak ditanyakan lagi)

- **Koreksi stok Gudang 1 DUS Whiskas (`docs/koreksi-ibt-20261006-0004.sql`)** — ternyata **sudah
  dijalankan** pada 2026-10-08 (retur `RTN-20261008-0001`); nota bersih = hutang. Tidak perlu
  dijalankan lagi; skripnya sendiri menolak dijalankan dua kali.
- **Izin akses (permission)** — diperiksa 2026-10-11: seluruh pasangan izin × role di katalog repo
  (`packages/db/src/seed/permissions.ts`) sudah terpasang di server; tidak ada yang kurang.
- **Folder kerja lama** di laptop (`wt-alasan`, `wt-hapus`, `wt-retur`, `wt-supplier`) — dihapus
  2026-10-11 atas izin owner; branch-nya tetap ada di remote.
- **Disk server** — dibersihkan 2026-10-11 (83% → 27%), lihat [`../../ops/README.md`](../../ops/README.md).

## F. Fitur lama yang tercatat belum tuntas (bukan pekerjaan Oktober)

**Keputusan owner 2026-10-11:** tiga butir bertanda **CEK NANTI** masuk daftar yang harus diperiksa
bersama owner di lain waktu; rencana kerja Juni **dilewati (skip)**.

Hasil menyisir `docs/work/backlog` dan `docs/work/plans`. **Tidak ada** kode yang sudah jadi tetapi
belum tayang: semua branch sudah masuk `main` dan tidak ada potongan changelog yang menggantung.

| Hal | Keadaan |
|---|---|
| Verifikasi manual izin per role (`plans/2026-07-13-rbac-manual-role-matrix-verification.md`) | belum pernah dijalankan — uji klik per role |
| Editor Role → Permission di Pengaturan | layarnya sudah ada; yang terbuka: verifikasi di atas + menandai izin "sensitif" |
| Portal pesanan pelanggan (`backlog/2026-07-08-customer-order-portal.md`) | tayang; terbuka: verifikasi OTP WhatsApp sungguhan & notifikasi WA konfirmasi pesanan |
| **CEK NANTI** — Pengetatan stock opname (`backlog/2026-07-16-stock-opname-concurrent-sales-hardening.md`) | sebagian besar selesai; sisa beberapa butir + "SO Besar per cabang" (terkait D) |
| **CEK NANTI** — Halaman Panduan | sebagian kartu masih "Segera hadir" |
| **CEK NANTI** — Foto produk untuk katalog | kolomnya ada, layar unggahnya belum |
| ~~Rencana Juni di `docs/work/plans/2026-06-*`~~ — **skip** (owner) | kotaknya tidak pernah dicentang walau banyak yang sudah tayang — statusnya **tidak bisa dipercaya dari dokumen**, perlu dicek per rencana bila diperlukan |

## Catatan utang stok

"Utang stok" terjadi bila kasir menjual barang saat stok di sistem 0 (barang fisiknya ada, tetapi
penerimaannya belum dicatat). Sistem mencatat utang itu dan melunasinya saat barang masuk.

Yang melunasi utang stok sekarang: **penerimaan PO**, **stock opname / penyesuaian**, dan sejak
1.107.52 **void transaksi**. Yang **belum** melunasi: barang masuk lewat **retur pelanggan**,
**terima transfer antar cabang**, dan **koreksi transaksi**. Akibatnya pada produk yang sedang
berutang, barang masuk lewat tiga jalur itu menambah rincian batch tanpa mengurangi utangnya —
angka "rincian batch" jadi lebih besar daripada stok ringkas (stok ringkasnya sendiri tetap benar).

Owner memilih (2026-10-10) memperbaiki void saja dulu. Penyelesaian datanya tetap lewat stock opname.
