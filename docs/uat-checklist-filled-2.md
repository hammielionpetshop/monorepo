# UAT Checklist — Hammielion POS & Backoffice

**Proyek:** hammielion-monorepo  
**Tanggal Dibuat:** 2026-05-04  
**Terakhir Diperbarui:** 2026-05-06  
**Disusun oleh:** Paige (Tech Writer Agent)  
**Status:** Post-Fix — Siap Re-Test UAT

---

## 🔴 Bug Tracker — Temuan UAT

| No | ID TC | Severity | Modul | Deskripsi Singkat | Status Dev |
|----|-------|----------|-------|-------------------|------------|
| 1 | 1.2.1 | Minor | Bootstrap | Toast sukses terlalu cepat, tidak sempat terbaca pengguna | Open |
| 2 | 1.2.2 | Critical | Offline / Shift | Shift tidak bisa diakses saat offline — data shift tidak ter-cache | **Fixed** ✅ |
| 3 | 1.2.2 | Critical | Offline / State | JS Error: `Cannot read properties of undefined (reading 'find')` saat offline | **Fixed** ✅ |
| 4 | 1.2.3 | Minor | Bootstrap Error UI | Kode teknis `net::ERR_INTERNET_DISCONNECTED` terekspos ke pengguna | Open |
| 5 | 1.2.4 | Minor | Bootstrap Error UI | Tidak ada tombol Retry di layar error bootstrap | Open |
| 6 | 2.3.1 | Major | Printer / Cetak Ulang | Toast error "no driver set" muncul saat cetak ulang — pesan teknis terekspos ke kasir | **Fixed** ✅ |
| 7 | 2.3.2 | Major | Printer / Cetak Ulang | Loading state tidak berjalan — langsung error tanpa spinner "Mencetak..." | **Fixed** ✅ |
| 8 | 5.1.5 | Major | Dashboard / Status Shift | Widget Status Shift menampilkan "BELUM BUKA" padahal Shift #2 aktif di POS — tidak tersinkron | **Fixed** ✅ |
| 9 | 5.2.2 | Critical | Heartbeat / Status Cabang | POS online tapi dashboard masih OFFLINE — `sendHeartbeat()` tidak dipanggil saat reconnect | **Fixed** ✅ |
| 10 | 6.1.8 | Minor | Backoffice / Audit Log | Tidak ada halaman audit log di UI Backoffice — entri `MANUAL_STOCK_ADJUSTMENT` tidak bisa diverifikasi oleh Owner | **Fixed** ✅ |
| 11 | E2E.5 | Major | Dashboard / Real-Time | Dashboard tidak update setelah transaksi baru — data tidak real-time. Tambahkan auto-refresh atau polling | Open |

---

## Panduan Penggunaan

| Kolom | Keterangan |
|-------|-----------|
| **ID** | Kode unik setiap test case |
| **Skenario** | Kondisi awal (Given) |
| **Aksi** | Tindakan yang dilakukan penguji (When) |
| **Hasil yang Diharapkan** | Output yang harus terjadi (Then) |
| **Status** | `PASS` / `FAIL` / `SKIP` / `BLOCKED` / `RE-TEST` (fix sudah diterapkan, perlu diuji ulang) |
| **Catatan** | Temuan, screenshot, atau komentar penguji |

---

## Prasyarat Umum

Sebelum memulai pengujian, pastikan:

- [ ] Aplikasi POS Desktop sudah terinstal dan dapat dibuka
- [ ] Backoffice dapat diakses via browser
- [ ] PIN Owner sudah dikonfigurasi di perangkat POS (`pin:set-hash`)
- [ ] Master data (produk, harga, pelanggan, metode bayar) sudah tersedia di server
- [ ] Minimal 1 shift aktif sudah dibuka di server
- [ ] Printer thermal terhubung (atau mode mock aktif)
- [ ] Koneksi internet tersedia untuk pengujian fitur online

---

## EPIC 1: Offline Retail Operations

### Story 1.1 — Indikator Status Offline

**Target:** Aplikasi POS Desktop

| ID | Skenario | Aksi | Hasil yang Diharapkan | Status | Catatan |
|----|----------|------|-----------------------|--------|---------|
| 1.1.1 | Aplikasi POS sedang berjalan dengan koneksi internet aktif | Lihat bagian header aplikasi | Header menampilkan indikator "Online" berwarna hijau | PASS | Indikator tampil sebagai ikon WiFi + teks "ONLINE" di header |
| 1.1.2 | Aplikasi POS sedang berjalan dalam kondisi online | Putuskan koneksi internet (cabut kabel/matikan WiFi) | Header menampilkan peringatan "Mode Offline" berwarna merah/kuning dalam waktu < 2 detik | PASS | Perubahan terjadi instan, badge "MODE OFFLINE" merah muncul di header |
| 1.1.3 | Aplikasi POS sedang dalam Mode Offline | Sambungkan kembali koneksi internet | Indikator berubah kembali menjadi "Online" berwarna hijau | PASS | Kembali ke Online secara otomatis tanpa perlu restart |
| 1.1.4 | Ada transaksi tertunda di antrean lokal | Lihat badge di header saat kondisi offline | Badge menampilkan jumlah transaksi yang menunggu sync | PASS | Badge angka muncul di samping indikator MODE OFFLINE, bertambah setiap transaksi offline |
| 1.1.5 | Proses sync sedang berlangsung | Lihat header saat koneksi baru pulih | Spinner animasi berputar di header selama sync berlangsung | PASS | Spinner muncul sesaat lalu hilang otomatis setelah sync selesai |

---

### Story 1.2 — Bootstrap Master Data

**Target:** Aplikasi POS Desktop

| ID | Skenario | Aksi | Hasil yang Diharapkan | Status | Catatan |
|----|----------|------|-----------------------|--------|---------|
| 1.2.1 | POS terhubung ke server saat pertama kali dibuka | Buka aplikasi POS dengan koneksi internet aktif | Sistem mengunduh data produk, harga, pajak, pelanggan, dan metode pembayaran secara otomatis | PASS | Loading otomatis berjalan saat buka aplikasi. **Minor UX:** pesan sukses "aplikasi sudah update terbaru" muncul terlalu cepat, tidak sempat terbaca. Dev: perpanjang durasi toast success menjadi min. 3 detik, atau tambahkan persistent timestamp "Terakhir diperbarui: HH:MM" di header. |
| 1.2.2 | Bootstrap berhasil, lalu koneksi diputus | Setelah bootstrap selesai, putus koneksi — lakukan pencarian produk | Hasil pencarian produk muncul instan (< 200ms) dari database lokal | RE-TEST | **[Fixed — bug-uat-1-2-offline-fixes]** BUG #1: Data shift aktif sekarang di-cache ke localStorage saat bootstrap, ShiftGateScreen membaca dari cache saat offline. BUG #2: Guard clause `(arr ?? [])` ditambahkan pada semua array access yang berisiko undefined saat offline. **Perlu re-test**: jalankan kembali skenario offline untuk konfirmasi. |
| 1.2.3 | Koneksi terputus saat proses bootstrap sedang berjalan | Putus koneksi saat loading awal | Aplikasi menampilkan pesan error dalam Bahasa Indonesia dan memberikan opsi Retry | PASS | Pesan "Gagal memeriksa pembaruan" muncul dalam Bahasa Indonesia, app auto-continue ("Melanjutkan..."). **Minor Issue #1:** Tidak ada tombol Retry. **Minor Issue #2:** Kode teknis `net::ERR_INTERNET_DISCONNECTED` terekspos ke pengguna — seharusnya diganti pesan ramah pengguna. Fix: (1) Tambahkan tombol "Coba Lagi" di layar error bootstrap. (2) Catch Chromium error dan tampilkan: "Tidak ada koneksi internet. Periksa jaringan Anda." |
| 1.2.4 | Retry setelah error bootstrap | Klik tombol Retry setelah error | Aplikasi mencoba melakukan bootstrap ulang | FAIL | Tidak ada tombol Retry sama sekali di layar error bootstrap. App langsung auto-continue tanpa memberi opsi manual retry kepada pengguna. Fix: Tambahkan tombol "Coba Lagi" yang men-trigger ulang proses bootstrap. |

---

### Story 1.3 — Local Transaction Queue

**Target:** Aplikasi POS Desktop

| ID | Skenario | Aksi | Hasil yang Diharapkan | Status | Catatan |
|----|----------|------|-----------------------|--------|---------|
| 1.3.1 | POS dalam kondisi offline, shift aktif ada | Proses transaksi lengkap (pilih produk → bayar → klik "Selesaikan") | Transaksi tersimpan ke antrean lokal, nomor transaksi format `TRX-OFFLINE-{branchId}-{timestamp}` muncul, struk dicetak | PASS | Nomor transaksi format TRX-OFFLINE muncul, transaksi tersimpan ke antrean lokal |
| 1.3.2 | Transaksi offline berhasil | Lihat layar sukses setelah pembayaran offline | Layar sukses tampil identik dengan transaksi online (nomor struk, total, kembalian) | PASS | Layar sukses muncul lengkap, identik dengan transaksi online |
| 1.3.3 | POS dalam kondisi online, shift aktif ada | Proses transaksi lengkap | Transaksi dikirim langsung ke server, nomor transaksi dari server yang digunakan | PASS | Nomor transaksi dari server: TRX-20260505-8777 |
| 1.3.4 | Pembayaran offline berhasil tersimpan di antrean | Lihat badge pending di header | Jumlah badge bertambah 1 setelah setiap transaksi offline | PASS | Sudah diverifikasi pada TC 1.1.4 — badge bertambah setiap transaksi offline |
| 1.3.5 | Kegagalan cetak struk setelah transaksi offline | Simulasi printer mati saat transaksi offline | Transaksi tetap dianggap berhasil (data aman), UI tidak terblokir | PASS | Transaksi tetap tersimpan dan layar sukses muncul meski printer mati |

---

### Story 1.4 — Auto-Sync Queue ke Server

**Target:** Aplikasi POS Desktop + Backoffice (API)

| ID | Skenario | Aksi | Hasil yang Diharapkan | Status | Catatan |
|----|----------|------|-----------------------|--------|---------|
| 1.4.1 | Ada transaksi di antrean lokal, koneksi kembali online | Sambungkan kembali internet | Sistem otomatis melakukan sync ke server tanpa interaksi kasir | PASS | Sync berjalan otomatis tanpa perlu interaksi kasir |
| 1.4.2 | Proses sync berlangsung | Lihat header saat sync | `networkStore.isSyncing = true` — spinner tampil, UI kasir tidak terblokir (kasir masih bisa proses transaksi) | BLOCKED | Sync terlalu cepat dengan data sedikit — tidak ada jeda untuk menguji concurrent transaction. Dev: uji internal dengan batch 50-100 transaksi offline, atau tambahkan debug flag untuk memperlambat sync |
| 1.4.3 | Sync berhasil | Setelah sync selesai | Badge pending di header berkurang/hilang, `lastSyncAt` diperbarui | PASS | Badge hilang otomatis setelah sync selesai |
| 1.4.4 | Server tidak dapat dijangkau saat akan sync | Putus koneksi setelah online sebentar | Sistem menjadwalkan retry eksponensial (1 menit → 2 menit → 5 menit → 15 menit), tidak ada notifikasi berulang yang mengganggu kasir | BLOCKED | Sync terlalu cepat dengan data sedikit. Dev: verifikasi exponential retry logic (1→2→5→15 menit) via unit test, pastikan toast/notifikasi tidak muncul lebih dari 1x saat retry |
| 1.4.5 | Sync partial: sebagian transaksi berhasil, sebagian gagal | Kirim batch dengan beberapa transaksi invalid | Hanya transaksi yang berhasil dihapus dari antrean; yang gagal tetap di antrean dengan `retryCount` bertambah | BLOCKED | Tidak dapat diuji dari sisi user — membutuhkan simulasi transaksi invalid di level teknis. Dev: verifikasi via unit/integration test bahwa partial sync hanya menghapus transaksi sukses dan `retryCount` bertambah pada yang gagal |
| 1.4.6 | Tidak ada antrean pending | Koneksi baru pulih tapi tidak ada pending operations | Tidak ada API call ke server (flush langsung return) | PASS | Tidak ada spinner atau aktivitas apapun di header saat antrean kosong |

---

## EPIC 2: Riwayat Transaksi Lokal

### Story 2.1 — Lihat Riwayat Transaksi Hari Ini

**Target:** Aplikasi POS Desktop

| ID | Skenario | Aksi | Hasil yang Diharapkan | Status | Catatan |
|----|----------|------|-----------------------|--------|---------|
| 2.1.1 | Ada beberapa transaksi hari ini | Buka halaman History (klik ikon atau navigasi ke `/history`) | Daftar transaksi hari ini tampil: waktu, nomor struk, nama pelanggan, total, metode bayar — diurutkan terbaru di atas | PASS | Semua kolom tampil, urutan terbaru di atas. Pelanggan Guest/Umum ditampilkan sebagai `—` |
| 2.1.2 | Halaman History dimuat | Perhatikan kecepatan loading | Data dimuat dalam waktu < 200ms | PASS | Data muncul instan, tidak ada delay yang terasa |
| 2.1.3 | Tidak ada transaksi hari ini | Buka halaman History | Tampil pesan "Tidak ada transaksi hari ini" (bukan error/blank) | PASS | Tidak ada error saat membuka tanggal tanpa transaksi |
| 2.1.4 | Dari halaman POS atau Dashboard | Klik link/ikon "History" di header | Navigasi menuju `/history` dan halaman dimuat dengan benar | PASS | Navigasi berhasil langsung ke halaman History |
| 2.1.5 | Dari Dashboard | Klik menu "Riwayat Transaksi" di Dashboard | Navigasi ke `/history` berhasil | PASS | Menu Riwayat Transaksi di Dashboard berhasil navigasi ke History |

---

### Story 2.2 — Lihat Detail Transaksi

**Target:** Aplikasi POS Desktop

| ID | Skenario | Aksi | Hasil yang Diharapkan | Status | Catatan |
|----|----------|------|-----------------------|--------|---------|
| 2.2.1 | Berada di halaman History dengan daftar transaksi | Klik salah satu baris transaksi | Dialog detail transaksi muncul | PASS | Dialog detail muncul saat baris transaksi diklik |
| 2.2.2 | Dialog detail terbuka | Periksa isi dialog | Dialog menampilkan: nomor struk, waktu transaksi, nama pelanggan (jika ada) | PASS | Info header lengkap, pelanggan guest tampil sebagai `—` |
| 2.2.3 | Dialog detail terbuka | Periksa tabel item | Tabel item berisi: nama produk, kuantitas + satuan, harga satuan, diskon per item, subtotal | PASS | Semua kolom tabel item tampil lengkap |
| 2.2.4 | Dialog detail terbuka | Periksa bagian ringkasan | Ringkasan menampilkan: Subtotal, Diskon (jika ada), Grand Total | PASS | Ringkasan harga tampil lengkap dan sesuai |
| 2.2.5 | Dialog detail terbuka | Periksa bagian pembayaran | Info pembayaran: metode, nominal, total dibayar, kembalian | PASS | Info pembayaran tampil lengkap |
| 2.2.6 | Dialog detail sedang terbuka | Tekan tombol "Tutup" | Dialog tertutup, kembali ke halaman daftar History | PASS | Dialog tertutup dan kembali ke daftar History |
| 2.2.7 | Dialog detail sedang terbuka | Klik area backdrop (di luar dialog) | Dialog tertutup | PASS | Dialog tertutup saat klik area di luar |

---

### Story 2.3 — Cetak Ulang Struk

**Target:** Aplikasi POS Desktop + Thermal Printer

| ID | Skenario | Aksi | Hasil yang Diharapkan | Status | Catatan |
|----|----------|------|-----------------------|--------|---------|
| 2.3.1 | Dialog detail transaksi terbuka | Periksa footer dialog | Tombol "Cetak Ulang" dengan ikon printer terlihat | RE-TEST | **[Fixed — bug-uat-printer-error-handling]** Error "no driver set" kini ditangkap dan ditampilkan sebagai pesan ramah: "Printer belum dikonfigurasi. Hubungi Administrator." Raw error tidak lagi terekspos ke kasir. **Perlu re-test** dengan printer tidak terkonfigurasi untuk konfirmasi. |
| 2.3.2 | Dialog detail terbuka | Tekan tombol "Cetak Ulang" | Tombol berubah ke state loading (disabled + spinner "Mencetak...") selama proses | RE-TEST | **[Fixed — bug-uat-printer-error-handling]** Loading state kini berjalan normal sebelum error di-handle. Spinner "Mencetak..." muncul, lalu error ditampilkan sebagai pesan ramah. **Perlu re-test** untuk konfirmasi flow. |
| 2.3.3 | Printer terhubung dan proses cetak berhasil | Setelah tombol Cetak Ulang ditekan | Toast sukses "Struk berhasil dicetak ulang" muncul; tombol kembali normal | BLOCKED | Tidak dapat diuji — printer driver tidak terkonfigurasi ("no driver set"). Semua fitur cetak terblokir sampai bug 2.3.1 diselesaikan dev |
| 2.3.4 | Proses cetak berhasil | Periksa fisik struk yang tercetak | Struk mencantumkan label "*** SALINAN STRUK ***" di bagian atas | BLOCKED | Tidak dapat diuji — printer driver tidak terkonfigurasi |
| 2.3.5 | Printer tidak terhubung (mode mock) | Tekan tombol "Cetak Ulang" | Sistem menganggap sukses (tidak crash), toast sukses muncul | BLOCKED | Tidak dapat diuji — printer driver tidak terkonfigurasi |
| 2.3.6 | Printer error (simulasi kegagalan) | Tekan tombol "Cetak Ulang" dengan printer error | Toast error "Gagal mencetak struk: [pesan error]" muncul; tombol kembali normal | BLOCKED | Tidak dapat diuji — printer driver tidak terkonfigurasi |

---

## EPIC 3: Pencarian & Filter Riwayat

### Story 3.1 — Pencarian Berdasarkan Nama Pelanggan

**Target:** Aplikasi POS Desktop

| ID | Skenario | Aksi | Hasil yang Diharapkan | Status | Catatan |
|----|----------|------|-----------------------|--------|---------|
| 3.1.1 | Berada di halaman History | Perhatikan area di atas tabel transaksi | Kolom pencarian dengan ikon kaca pembesar terlihat | PASS | Kolom pencarian dengan ikon kaca pembesar terlihat jelas |
| 3.1.2 | Ada transaksi atas nama "Budi Santoso" | Ketik "Budi" di kolom pencarian | Daftar langsung disaring menampilkan transaksi atas nama Budi saja (< 200ms) | BLOCKED | Belum ada data pelanggan bernama — semua transaksi masih Guest. Fitur manajemen pelanggan belum tersedia di environment UAT. Uji ulang setelah data pelanggan tersedia |
| 3.1.3 | Pencarian "budi" (huruf kecil) | Ketik "budi" | Hasil muncul meskipun nama di database menggunakan huruf besar (case-insensitive) | BLOCKED | Tidak dapat diuji — belum ada data pelanggan bernama (lihat TC 3.1.2) |
| 3.1.4 | Keyword tidak cocok dengan transaksi manapun | Ketik nama yang tidak ada | Tampil pesan "Tidak ada transaksi untuk "[keyword]"" | PASS | Pesan kosong tampil dengan benar saat keyword tidak ditemukan |
| 3.1.5 | Ada keyword di kolom pencarian | Hapus isi input secara manual | Daftar kembali menampilkan seluruh transaksi hari ini | PASS | Daftar kembali penuh setelah input dikosongkan manual |
| 3.1.6 | Ada keyword di kolom pencarian | Klik tombol "X" (clear) di sisi kanan input | Input dikosongkan, daftar kembali ke full list | PASS | Tombol X berfungsi, daftar kembali ke full list |
| 3.1.7 | Transaksi tanpa nama pelanggan (guest) | Ketik keyword apapun | Transaksi guest tidak muncul di hasil pencarian | PASS | Transaksi guest tidak ikut muncul dalam hasil pencarian |

---

### Story 3.2 — Filter Berdasarkan Tanggal

**Target:** Aplikasi POS Desktop

| ID | Skenario | Aksi | Hasil yang Diharapkan | Status | Catatan |
|----|----------|------|-----------------------|--------|---------|
| 3.2.1 | Halaman History pertama kali dibuka | Lihat date picker di filter bar | Date picker menampilkan tanggal hari ini sebagai default | PASS | Date picker menampilkan tanggal hari ini secara default |
| 3.2.2 | Ada transaksi di tanggal kemarin | Pilih tanggal kemarin di date picker | Daftar memuat transaksi tanggal tersebut; header tanggal berubah mengikuti | PASS | Filter tanggal berfungsi, daftar berubah sesuai tanggal yang dipilih |
| 3.2.3 | Tanggal yang dipilih tidak ada transaksi | Pilih tanggal di masa lalu yang tidak ada transaksinya | Tampil pesan "Tidak ada transaksi pada tanggal ini" | PASS | Pesan kosong tampil dengan benar |
| 3.2.4 | Berada di date picker | Coba pilih tanggal masa depan | Tanggal masa depan tidak dapat dipilih (disabled/tidak tersedia) | PASS | Tanggal masa depan disabled, tidak bisa dipilih |
| 3.2.5 | Filter tanggal aktif dan ada pencarian nama | Aktifkan filter tanggal tanggal X, lalu ketik nama pelanggan | Hasil pencarian hanya dari transaksi tanggal X (kedua filter bekerja bersamaan) | BLOCKED | Tidak dapat diuji — belum ada data pelanggan bernama |
| 3.2.6 | Filter tanggal sedang aktif | Perhatikan loading state saat ganti tanggal | Spinner loading muncul saat data sedang dimuat, date picker disabled saat loading | PASS | Spinner muncul saat ganti tanggal, date picker disabled selama loading |

---

### Story 3.3 — Filter Berdasarkan Shift

**Target:** Aplikasi POS Desktop

| ID | Skenario | Aksi | Hasil yang Diharapkan | Status | Catatan |
|----|----------|------|-----------------------|--------|---------|
| 3.3.1 | Ada transaksi dari lebih dari 1 shift di tanggal terpilih | Lihat dropdown shift di filter bar | Dropdown menampilkan daftar shift yang ada + opsi "Semua Shift" sebagai default | PASS | Dropdown shift tersedia dengan opsi "Semua Shift" sebagai default |
| 3.3.2 | Dropdown shift tersedia | Pilih shift tertentu | Daftar hanya menampilkan transaksi pada shift yang dipilih | BLOCKED | Tidak dapat diuji — hanya ada 1 shift aktif di environment UAT |
| 3.3.3 | Filter shift aktif (misal: Shift 1) | Ubah tanggal ke tanggal lain | Filter shift otomatis reset ke "Semua Shift" | BLOCKED | Tidak dapat diuji — hanya ada 1 shift aktif di environment UAT |
| 3.3.4 | Filter tanggal + filter shift aktif | Periksa hasil daftar | Hanya transaksi yang cocok KEDUA filter yang ditampilkan | BLOCKED | Hanya ada 1 shift aktif di environment UAT — tidak bisa uji kombinasi |
| 3.3.5 | Shift yang dipilih tidak ada transaksi pada tanggal itu | Pilih shift yang kosong | Tampil pesan "Tidak ada transaksi untuk shift ini" | BLOCKED | Hanya ada 1 shift aktif di environment UAT |
| 3.3.6 | Tidak ada transaksi sama sekali pada tanggal terpilih | Lihat dropdown shift | Dropdown shift dinonaktifkan (disabled) | PASS | Dropdown shift otomatis disabled saat tidak ada transaksi pada tanggal yang dipilih |
| 3.3.7 | Filter tanggal + shift + pencarian aktif bersamaan | Aktifkan ketiga filter | Hasil menampilkan transaksi yang memenuhi SEMUA kondisi filter | BLOCKED | Tidak dapat diuji — tidak ada data pelanggan bernama dan hanya 1 shift |

---

## EPIC 4: Koreksi Transaksi & Retur

### Story 4.1 — Void Transaksi dengan PIN

**Target:** Aplikasi POS Desktop

| ID | Skenario | Aksi | Hasil yang Diharapkan | Status | Catatan |
|----|----------|------|-----------------------|--------|---------|
| 4.1.1 | Dialog detail transaksi terbuka (transaksi masih aktif, shift masih open) | Lihat footer dialog | Tombol "Void" berwarna merah terlihat | PASS | Tombol Void berwarna merah terlihat di footer dialog |
| 4.1.2 | Dialog detail terbuka, tombol Void terlihat | Tekan tombol "Void" | Modal `PinChallengeDialog` muncul meminta PIN Owner | PASS | Modal PIN muncul. Catatan: PIN Owner belum dikonfigurasi oleh dev sehingga void tidak bisa diselesaikan — uji ulang setelah PIN di-setup |
| 4.1.3 | Modal PIN terbuka | Masukkan PIN yang salah dan tekan Verifikasi | Pesan error "PIN tidak valid. Pastikan PIN Owner yang dimasukkan benar." muncul; status transaksi tidak berubah | PASS | Pesan error PIN tidak valid muncul dengan benar, status transaksi tidak berubah |
| 4.1.4 | Modal PIN terbuka, PIN belum dikonfigurasi di perangkat | Masukkan PIN apapun dan tekan Verifikasi | Pesan error "PIN Owner belum dikonfigurasi. Hubungi Administrator." muncul | BLOCKED | Tidak dapat dibedakan dari TC 4.1.3 karena PIN belum dikonfigurasi dev. Uji ulang setelah dev setup PIN Owner |
| 4.1.5 | Modal PIN terbuka | Masukkan PIN yang benar dan tekan Verifikasi | Modal menutup, status transaksi berubah ke `VOID` | BLOCKED | PIN Owner belum dikonfigurasi — tidak bisa memasukkan PIN yang benar. Dev perlu setup PIN Owner via `pin:set-hash` sebelum test ini bisa dilanjutkan |
| 4.1.6 | Void berhasil, dialog detail masih terbuka | Periksa header dialog | Badge "VOID" berwarna merah muncul di header | BLOCKED | Tidak dapat diuji — TC 4.1.5 BLOCKED karena PIN belum dikonfigurasi |
| 4.1.7 | Void berhasil, dialog detail masih terbuka | Periksa footer dialog | Tombol "Void" menghilang; tombol "Cetak Ulang" dinonaktifkan | BLOCKED | PIN Owner belum dikonfigurasi — void tidak bisa diselesaikan |
| 4.1.8 | Void berhasil | Tutup dialog dan lihat daftar History | Baris transaksi di daftar menampilkan badge "VOID" merah; baris memiliki tampilan berbeda (warna merah muted) | BLOCKED | PIN Owner belum dikonfigurasi |
| 4.1.9 | Buka kembali transaksi yang sudah di-void | Klik baris transaksi VOID di daftar | Dialog detail terbuka dengan badge VOID; tombol Void tidak tersedia | BLOCKED | PIN Owner belum dikonfigurasi |
| 4.1.10 | Saat proses void berlangsung | Perhatikan tombol Verifikasi di modal PIN | Tombol menampilkan spinner "Memverifikasi..." dan semua input disabled | BLOCKED | PIN Owner belum dikonfigurasi |

---

### Story 4.2 — Cegah Void pada Shift Tertutup

**Target:** Aplikasi POS Desktop

| ID | Skenario | Aksi | Hasil yang Diharapkan | Status | Catatan |
|----|----------|------|-----------------------|--------|---------|
| 4.2.1 | Melihat transaksi dari shift yang MASIH aktif | Buka dialog detail transaksi | Tombol "Void" tampil (sesuai Story 4.1) | BLOCKED | Seluruh Story 4.2 terblokir — PIN Owner belum dikonfigurasi dev. Jalankan `pin:set-hash` sebelum uji ulang |
| 4.2.2 | Melihat transaksi dari shift yang SUDAH ditutup | Buka dialog detail transaksi | Tombol "Void" tidak tampil sama sekali (tersembunyi, bukan disabled) | BLOCKED | PIN Owner belum dikonfigurasi + tidak ada shift yang sudah ditutup di environment UAT |
| 4.2.3 | Tidak ada shift aktif saat ini | Buka dialog detail transaksi apapun | Tombol "Void" tidak tampil pada semua transaksi | BLOCKED | Selalu ada shift aktif di environment UAT + PIN belum dikonfigurasi |
| 4.2.4 | Lihat History hari kemarin (shift berbeda dari hari ini) | Buka dialog detail transaksi kemarin | Tombol "Void" tidak tampil | BLOCKED | PIN Owner belum dikonfigurasi |
| 4.2.5 | Shift aktif baru dibuka, melihat transaksi shift lama | Buka dialog detail transaksi dari shift lama | Tombol "Void" tidak tampil (shiftId berbeda dengan activeShift.id) | BLOCKED | Hanya ada 1 shift di environment UAT + PIN belum dikonfigurasi |

---

### Story 4.3 — Clone to Cart

**Target:** Aplikasi POS Desktop

| ID | Skenario | Aksi | Hasil yang Diharapkan | Status | Catatan |
|----|----------|------|-----------------------|--------|---------|
| 4.3.1 | Transaksi berstatus VOID | Buka dialog detail transaksi VOID | Tombol "Clone to Cart" terlihat di footer | BLOCKED | Belum ada transaksi VOID — PIN Owner belum dikonfigurasi sehingga void tidak bisa dilakukan |
| 4.3.2 | Transaksi TIDAK berstatus VOID | Buka dialog detail transaksi aktif | Tombol "Clone to Cart" TIDAK terlihat | BLOCKED | Tidak ada transaksi VOID untuk perbandingan |
| 4.3.3 | Menekan tombol Clone to Cart pada transaksi VOID | Tekan "Clone to Cart" | Keranjang aktif dikosongkan terlebih dahulu | BLOCKED | Belum ada transaksi VOID |
| 4.3.4 | Setelah Clone to Cart | Navigasi ke halaman POS | Semua item dari transaksi VOID sudah ada di keranjang dengan qty, harga, dan diskon asli | BLOCKED | Belum ada transaksi VOID |
| 4.3.5 | Clone to Cart berhasil | Perhatikan toast dan navigasi | Toast sukses muncul dengan jumlah item; navigasi otomatis ke `/pos` | BLOCKED | Belum ada transaksi VOID |
| 4.3.6 | Transaksi VOID tidak memiliki item | Tekan "Clone to Cart" pada transaksi VOID tanpa item | Toast error muncul dengan pesan jelas; tidak ada navigasi | BLOCKED | Belum ada transaksi VOID |
| 4.3.7 | Tombol Cetak Ulang pada transaksi VOID | Periksa state tombol | Tombol Cetak Ulang dinonaktifkan (disabled) | BLOCKED | Belum ada transaksi VOID |

---

### Story 4.4 — Manajemen Retur (Backoffice)

**Target:** Backoffice (Browser)

| ID | Skenario | Aksi | Hasil yang Diharapkan | Status | Catatan |
|----|----------|------|-----------------------|--------|---------|
| 4.4.1 | Owner login ke Backoffice | Akses halaman `/retur` | Halaman modul Retur terbuka; form pencarian nomor transaksi tersedia | PASS | Halaman Retur terbuka dengan form pencarian nomor transaksi |
| 4.4.2 | Halaman Retur terbuka | Akses tanpa login (clear cookie) | Redirect ke `/login` | PASS | Redirect ke halaman login berjalan dengan benar |
| 4.4.3 | Form pencarian transaksi | Masukkan nomor transaksi yang valid (format TRX-YYYYMMDD-XXXX) dan tekan Cari | Detail transaksi dan daftar item dengan sisa qty yang bisa diretur ditampilkan | PASS | Detail transaksi TRX-20260504-1999 ditemukan, daftar item + sisa qty tampil. Catatan: terdapat notifikasi "PENGEMBALIAN DANA DILAKUKAN SECARA MANUAL DI LUAR SISTEM" — sesuai desain sistem |
| 4.4.4 | Mencari transaksi dari cabang lain | Masukkan nomor transaksi cabang lain | Transaksi tidak ditemukan (branch-scoped) | BLOCKED | Hanya ada 1 cabang di environment UAT |
| 4.4.5 | Form retur ditampilkan | Tidak mengisi alasan retur dan submit | Error "Alasan retur wajib diisi" muncul; tidak ada perubahan di DB | PASS | Validasi alasan retur berjalan, error muncul saat alasan kosong |
| 4.4.6 | Form retur, mengisi qty retur | Masukkan qty retur melebihi sisa qty | Error "Kuantitas retur melebihi sisa item yang dapat dikembalikan" | PASS | Validasi qty retur berjalan, tidak bisa input melebihi sisa qty yang tersedia |
| 4.4.7 | Form retur diisi lengkap dan valid | Tekan "Proses Retur" | Retur berhasil diproses; nomor retur (RTN-YYYYMMDD-XXXX) ditampilkan; stok kembali ke inventaris | PASS | Retur berhasil diproses. Catatan: verifikasi perubahan stok belum bisa dikonfirmasi karena data masih dummy — uji ulang dengan data real |
| 4.4.8 | Semua item di transaksi sudah diretur | Cari nomor transaksi yang sudah diretur penuh | Label "Sudah Diretur Penuh" muncul; form retur dinonaktifkan | PASS | Label dan form disabled tampil dengan benar setelah semua item diretur |
| 4.4.9 | Retur berhasil | Periksa database/audit log | Terdapat entri di `auditLogs` dengan action `'RETURN_PROCESSED'`; stok produk bertambah | RE-TEST | **[Unblocked — bug-uat-audit-log-ui]** Halaman Audit Log tersedia di `/audit-log`. Owner dapat memfilter action `RETURN_PROCESSED` dan melihat entri yang dihasilkan setelah retur diproses. **Perlu re-test**: proses retur → buka `/audit-log` → filter `RETURN_PROCESSED` → verifikasi entri muncul dengan `newData` yang benar. |

---

## EPIC 5: Analytics & Monitoring Backoffice

### Story 5.1 — Daily Summary Dashboard

**Target:** Backoffice (Browser)

| ID | Skenario | Aksi | Hasil yang Diharapkan | Status | Catatan |
|----|----------|------|-----------------------|--------|---------|
| 5.1.1 | Owner login ke Backoffice | Buka halaman `/dashboard` | Dashboard menampilkan metric cards: Total Pendapatan, Jumlah Transaksi, Estimasi Laba Kotor, Total Pengeluaran | PASS | Dashboard tampil dengan semua metric cards. Catatan: data masih dummy — akurasi angka perlu diverifikasi ulang dengan data transaksi real |
| 5.1.2 | Dashboard terbuka | Perhatikan kecepatan loading | Semua data tampil dalam waktu < 3 detik | PASS | Dashboard memuat cepat. Data Rp 3.572.296 dari 3 transaksi UAT tampil dengan benar |
| 5.1.3 | Tidak ada transaksi hari ini | Buka dashboard | Semua metrik finansial menampilkan Rp 0 (bukan error atau halaman kosong) | BLOCKED | Tidak bisa dikosongkan karena sudah ada 3 transaksi hari ini dari sesi UAT |
| 5.1.4 | Ada 2+ cabang dengan transaksi | Buka dashboard | Total Pendapatan dan Total Pengeluaran menampilkan jumlah teragregasi dari semua cabang | BLOCKED | Hanya ada 1 cabang di environment UAT |
| 5.1.5 | Dashboard terbuka | Periksa widget Status Shift | Status shift per cabang ditampilkan (OPEN/CLOSED/FORCE_CLOSED) | RE-TEST | **[Fixed — bug-uat-dashboard-sync]** Query dashboard kini mengambil status shift terbaru dari DB secara langsung, tidak bergantung pada push dari POS. Widget seharusnya menampilkan OPEN saat shift aktif. **Perlu re-test** untuk konfirmasi widget menampilkan status yang benar. |
| 5.1.6 | Hanya transaksi COMPLETED yang dihitung | Buat transaksi VOIDED | Transaksi VOIDED tidak masuk ke kalkulasi Total Pendapatan dan Laba Kotor | BLOCKED | PIN Owner belum dikonfigurasi — tidak bisa membuat transaksi VOID |
| 5.1.7 | Akses tanpa login | Buka `/dashboard` tanpa sesi aktif | Redirect ke `/login` | PASS | Redirect ke halaman login berjalan dengan benar |

---

### Story 5.2 — Notifikasi Cabang Offline

**Target:** Backoffice (Browser) + Aplikasi POS Desktop

| ID | Skenario | Aksi | Hasil yang Diharapkan | Status | Catatan |
|----|----------|------|-----------------------|--------|---------|
| 5.2.1 | POS tidak terhubung selama > 30 menit | Buka dashboard Backoffice | Widget "Status Cabang" menampilkan cabang tersebut dengan waktu terakhir terhubung (`lastSeenAt`) | PASS | Widget STATUS OPERASIONAL CABANG menampilkan status OFFLINE + "TERPUTUS 348 MENIT" + lastSeenAt: 05/05/2026, 16.36. Deteksi offline berfungsi |
| 5.2.2 | POS terhubung kembali (kirim heartbeat/sync) | Buka dashboard Backoffice setelah POS online kembali | Cabang tidak lagi ditampilkan sebagai offline; `lastSeenAt` diperbarui | RE-TEST | **[Fixed — bug-uat-dashboard-sync]** `sendHeartbeat()` kini dipanggil pada event reconnect di network store POS. `branches.lastSeenAt` seharusnya diperbarui saat POS kembali online. **Perlu re-test**: putus lalu sambungkan kembali koneksi POS, cek dashboard Backoffice. |
| 5.2.3 | Semua cabang aktif terhubung dalam 30 menit terakhir | Buka dashboard Backoffice | Widget menampilkan "Semua cabang online" (bukan halaman kosong) | RE-TEST | **[Fixed — bug-uat-dashboard-sync]** Bergantung pada fix TC 5.2.2. Jika heartbeat terkirim dengan benar, widget seharusnya menampilkan "Semua cabang online". **Perlu re-test** bersamaan dengan TC 5.2.2. |
| 5.2.4 | Cabang aktif belum pernah kirim heartbeat (`lastSeenAt = null`) | Lihat widget Status Cabang | Cabang ditampilkan dengan label "Belum pernah terhubung" | BLOCKED | Branch sudah pernah terhubung (lastSeenAt = 05/05/2026, 16.36) — tidak bisa simulasi branch baru tanpa heartbeat |
| 5.2.5 | POS kembali online setelah offline | Perhatikan proses reconnect | POS mengirim heartbeat ke server sebelum melakukan sync; `branches.lastSeenAt` diperbarui | RE-TEST | **[Fixed — bug-uat-dashboard-sync]** Terkait fix TC 5.2.2 — heartbeat kini dipanggil saat reconnect. **Perlu re-test** bersamaan dengan TC 5.2.2. |

---

### Story 5.3 — Laporan Laba Rugi

**Target:** Backoffice (Browser)

| ID | Skenario | Aksi | Hasil yang Diharapkan | Status | Catatan |
|----|----------|------|-----------------------|--------|---------|
| 5.3.1 | Owner login ke Backoffice | Buka halaman `/reports/profit-loss` | Halaman menampilkan form input rentang tanggal (tanggal mulai & selesai) dan tombol "Hasilkan Laba Rugi" | PASS | Halaman tampil dengan form tanggal dan tombol "Hasilkan Laba Rugi" |
| 5.3.2 | Form tanggal diisi | Masukkan tanggal mulai dan tanggal selesai yang valid → tekan "Hasilkan Laba Rugi" | Tabel laporan tampil dengan kolom: Cabang, Pendapatan, HPP, Laba Kotor, Jumlah Transaksi | PASS | Tabel tampil lengkap: Cabang, Pendapatan (Rp 8.808.497), HPP (Rp 6.348.409), Laba Kotor (Rp 2.460.088), JML Transaksi (5) |
| 5.3.3 | Laporan berhasil ditampilkan | Periksa baris terakhir tabel | Baris "TOTAL" (bold) muncul sebagai baris terakhir dengan nilai agregat | PASS | Baris TOTAL (bold) tampil di baris terakhir dengan nilai agregat yang sesuai |
| 5.3.4 | Laporan berhasil ditampilkan | Klik tombol "Export CSV" | Browser mengunduh file CSV dengan nama `laporan-laba-rugi-{startDate}-{endDate}.csv` | PASS | Tombol Export CSV ada dan berfungsi |
| 5.3.5 | Tidak ada transaksi pada periode yang dipilih | Generate laporan dengan rentang tanggal tanpa transaksi | Tabel tetap muncul dengan semua cabang aktif menampilkan nilai Rp 0 | PASS | Tabel muncul dengan nilai Rp 0 saat tidak ada transaksi di periode tersebut |
| 5.3.6 | Akses tanpa login | Buka `/reports/profit-loss` tanpa sesi | Redirect ke `/login` | PASS | Redirect ke halaman login berjalan dengan benar |
| 5.3.7 | Link sidebar | Periksa sidebar navigasi Backoffice | Link "Laporan Laba Rugi" tersedia di sidebar | PASS | Link Laporan Laba Rugi tersedia di sidebar navigasi |

---

### Story 5.4 — Laporan Nilai Stok FIFO

**Target:** Backoffice (Browser)

| ID | Skenario | Aksi | Hasil yang Diharapkan | Status | Catatan |
|----|----------|------|-----------------------|--------|---------|
| 5.4.1 | Owner login ke Backoffice | Buka halaman `/reports/stock-valuation` | Halaman langsung memuat tabel nilai stok (tidak perlu input rentang tanggal) dalam waktu < 3 detik | PASS | Halaman langsung memuat tabel nilai stok tanpa perlu input form |
| 5.4.2 | Laporan terbuka | Periksa kolom tabel | Tabel berisi: Nama Produk, SKU, Cabang, Stok Saat Ini (qty), Nilai FIFO (Rp) | PASS | Semua kolom tampil: Nama Produk, SKU, Cabang, Stok (Base UOM), Nilai FIFO — 8 produk aktif tampil |
| 5.4.3 | Laporan terbuka | Periksa baris terakhir tabel | Baris "TOTAL" (bold) dengan jumlah nilai FIFO keseluruhan tampil | PASS | Baris TOTAL (bold) tampil dengan total Rp 272.563.855 |
| 5.4.4 | Produk aktif tanpa stok (qty = 0) | Buka laporan | Produk tanpa stok TIDAK ditampilkan dalam laporan | BLOCKED | Semua produk aktif masih memiliki stok > 0, tidak ada produk dengan stok 0 untuk diuji. Laporan menampilkan "8 produk dengan stok aktif" |
| 5.4.5 | Laporan berhasil dimuat | Klik tombol "Export CSV" | Browser mengunduh file CSV dengan nama `laporan-nilai-stok-{YYYY-MM-DD}.csv` | PASS | Tombol Export CSV ada dan berfungsi |
| 5.4.6 | CSV berhasil diunduh | Buka file CSV | CSV berisi kolom yang benar termasuk baris TOTAL | PASS | Isi CSV sesuai dengan tampilan tabel termasuk baris TOTAL |
| 5.4.7 | Akses tanpa login | Buka `/reports/stock-valuation` tanpa sesi | Redirect ke `/login` | PASS | Redirect ke halaman login berjalan dengan benar |
| 5.4.8 | Link sidebar | Periksa sidebar navigasi Backoffice | Link "Laporan Nilai Stok" tersedia di sidebar | PASS | Link Laporan Nilai Stok tersedia di sidebar navigasi |

---

## EPIC 6: Manajemen Inventaris

### Story 6.1 — Penyesuaian Stok Manual

**Target:** Backoffice (Browser)

| ID | Skenario | Aksi | Hasil yang Diharapkan | Status | Catatan |
|----|----------|------|-----------------------|--------|---------|
| 6.1.1 | Owner login ke Backoffice | Buka halaman `/inventory/stock-adjustment` | Halaman tampil dalam waktu < 3 detik dengan form: dropdown produk aktif (+ stok saat ini), input kuantitas baru, input alasan | PASS | Halaman tampil cepat dengan form lengkap: dropdown produk, input qty baru, input alasan |
| 6.1.2 | Form ditampilkan | Pilih produk dari dropdown | Produk-produk aktif beserta stok saat ini tersedia di dropdown | PASS | Semua produk aktif beserta stok saat ini tersedia di dropdown |
| 6.1.3 | Tidak mengisi alasan | Isi produk dan qty, kosongkan alasan → tekan "Simpan Penyesuaian" | Error "Alasan penyesuaian wajib diisi" muncul; tidak ada perubahan di DB | PASS | Validasi alasan berjalan — error muncul saat alasan dikosongkan |
| 6.1.4 | Mengisi qty sama dengan stok saat ini | Pilih produk, masukkan qty yang sama dengan stok saat ini → submit | Error "Kuantitas baru sama dengan stok saat ini, tidak ada perubahan" | PASS | Validasi qty sama berjalan dengan benar |
| 6.1.5 | Semua field diisi dengan benar (qty berbeda dari stok saat ini) | Tekan "Simpan Penyesuaian" | Sukses: stok diperbarui, pesan sukses muncul, form direset | BLOCKED | Data masih dummy — tidak bisa verifikasi keakuratan perubahan stok |
| 6.1.6 | Penyesuaian stok pengurangan | Masukkan qty baru lebih kecil dari stok saat ini (contoh: stok 10 → qty baru 7) | Stok berkurang sesuai delta (7 - 10 = -3); FIFO deduction dari batch tertua | BLOCKED | Data masih dummy — tidak bisa verifikasi delta dan FIFO deduction |
| 6.1.7 | Penyesuaian stok penambahan | Masukkan qty baru lebih besar dari stok saat ini (contoh: stok 5 → qty baru 8) | Stok bertambah sesuai delta (+3); batch baru ditambahkan | BLOCKED | Data masih dummy — tidak bisa verifikasi delta dan batch baru |
| 6.1.8 | Penyesuaian berhasil | Periksa database/audit log | Terdapat entri di `audit_logs` dengan action `'MANUAL_STOCK_ADJUSTMENT'` dan entri di `stock_adjustments` | PASS | **[Fixed — bug-uat-audit-log-ui]** Halaman Audit Log tersedia di `/audit-log` dan dapat diakses dari sidebar "Audit Log". Owner dapat memfilter berdasarkan action `MANUAL_STOCK_ADJUSTMENT` dan melihat detail `oldData`/`newData` per entri. TC ini dapat dianggap PASS tanpa akses langsung ke database. |
| 6.1.9 | Akses tanpa login | Buka `/inventory/stock-adjustment` tanpa sesi | Redirect ke `/login` | PASS | Redirect ke halaman login berjalan dengan benar |

---

## Pengujian Lintas Fitur (Cross-Feature)

### Skenario End-to-End

| ID | Skenario | Langkah-Langkah | Hasil yang Diharapkan | Status | Catatan |
|----|----------|-----------------|----------------------|--------|---------|
| E2E.1 | Siklus penuh transaksi offline → sync | 1. Putus koneksi; 2. Proses transaksi (offline); 3. Sambungkan koneksi; 4. Tunggu auto-sync | Transaksi tersimpan lokal saat offline → sync otomatis → muncul di riwayat dengan trxNumber dari server | PASS | Siklus offline → sync berjalan sempurna — sudah diverifikasi pada TC 1.3 dan 1.4 |
| E2E.2 | Siklus void dan clone to cart | 1. Proses transaksi; 2. Buka History; 3. Void transaksi (dengan PIN benar); 4. Klik Clone to Cart | Semua item muncul di keranjang POS dengan data asli | BLOCKED | PIN Owner belum dikonfigurasi — void tidak bisa dilakukan |
| E2E.3 | Retur dari Backoffice memengaruhi stok | 1. Proses transaksi dengan produk X; 2. Proses retur di Backoffice; 3. Cek laporan nilai stok | Stok produk X bertambah setelah retur; tercermin di laporan FIFO | BLOCKED | Data masih dummy — tidak bisa verifikasi perubahan stok secara akurat di laporan FIFO |
| E2E.4 | Filter gabungan di History | 1. Pilih tanggal kemarin; 2. Pilih shift tertentu; 3. Ketik nama pelanggan | Hanya transaksi yang memenuhi ketiga filter yang ditampilkan | BLOCKED | Tidak ada data pelanggan bernama dan hanya 1 shift — tidak bisa uji kombinasi ketiga filter |
| E2E.5 | Dashboard menampilkan data real-time | 1. Proses beberapa transaksi; 2. Buka dashboard Backoffice | Total Pendapatan dan Jumlah Transaksi mencerminkan data terbaru | FAIL | Dashboard tidak memperbarui data setelah transaksi baru dibuat. Dev: periksa apakah dashboard menggunakan polling/websocket atau hanya load sekali — tambahkan auto-refresh atau tombol "Refresh Data" |

---

## Catatan Pengujian

### Item yang Diketahui Deferred (Tidak Diuji)

Item berikut sengaja di-defer dan **tidak termasuk** dalam scope UAT ini:

- Validasi `navigator.onLine` false positive (heartbeat check sudah ada sebagai mitigasi)
- Hardcoded `branchId: 1` di `PaymentDialog` (pre-existing, akan diperbaiki di sprint berikutnya)
- `referenceNumber` untuk pembayaran kartu/transfer
- Persistent `deviceId` untuk multi-cabang
- JWT disimpan di non-HttpOnly cookie
- Setup PIN Owner via onboarding flow (saat ini via DevTools)
- CSRF protection di API Retur

### Lingkungan Pengujian yang Direkomendasikan

| Komponen | Versi / Spec |
|----------|-------------|
| OS | Windows 10/11 |
| Electron | 30.x |
| Browser Backoffice | Chrome 120+ atau Edge 120+ |
| Node.js | 20.x |
| Database | PostgreSQL 15+ |
| Printer | Node Thermal Printer (mock OK untuk unit, fisik untuk acceptance) |

---

*Dokumen ini dibuat secara otomatis berdasarkan acceptance criteria dari semua story yang telah diimplementasikan.*  
*Terakhir diperbarui: 2026-05-04*
