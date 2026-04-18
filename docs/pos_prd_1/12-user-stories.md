# 12. USER STORIES & ACCEPTANCE CRITERIA

## Epic 1: Multi-UOM Sales

### US-001: Jual dalam UOM Kecil (Stock Cukup)
```
As a Kasir,
I want to menjual produk per Pcs ketika stock Pcs cukup,
So that saya bisa melayani customer yang beli eceran.

Acceptance Criteria:
✅ Kasir bisa pilih UOM "Pcs" di checkout
✅ Jika stock Pcs >= qty, transaksi berhasil
✅ Stock Pcs berkurang sesuai qty
✅ Stock Sak TIDAK berubah
✅ Struk menampilkan UOM "Pcs" dengan harga per Pcs
```

### US-002: Jual dalam UOM Kecil (Auto-Break Triggered)
```
As a Kasir,
I want to sistem otomatis pecah kemasan saat stock Pcs kurang,
So that saya tidak perlu manual pecah kemasan di tengah transaksi.

Acceptance Criteria:
✅ Jika stock Pcs < qty, sistem otomatis pecah UOM besar
✅ Sistem hitung jumlah sak yang perlu dipecah (CEIL(deficit/ratio))
✅ Sistem validasi stock UOM besar cukup untuk dipecah
✅ Stock Sak berkurang, Stock Pcs bertambah (sesuai ratio)
✅ Lalu stock Pcs berkurang sesuai qty dijual
✅ Auto-break tercatat di log stock_auto_breaks
✅ Notifikasi ke kasir: "Sistem pecah X Sak → Y Pcs"
```

### US-003: Jual dalam UOM Besar
```
As a Kasir,
I want to menjual produk per Sak langsung,
So that saya bisa melayani customer grosir dengan cepat.

Acceptance Criteria:
✅ Jika stock Sak >= qty, transaksi berhasil
✅ Stock Sak berkurang, Stock Pcs TIDAK berubah
✅ Harga menggunakan harga Sak (bukan hitungan Pcs)
```

---

## Epic 2: Pricing

### US-010: Pilih Tier Harga
```
As a Kasir,
I want to memilih tier harga (Retail/Grosir/Member/dll) saat checkout,
So that saya bisa apply harga sesuai kondisi customer.

Acceptance Criteria:
✅ Setiap produk tampilkan 6 tier harga
✅ Kasir bisa pilih salah satu tier
✅ Harga transaksi menggunakan tier yang dipilih
✅ Tidak ada auto-trigger (manual selection)
```

### US-011: Manual Override Harga
```
As a Kasir,
I want to override harga secara manual untuk nego khusus,
So that saya bisa fleksibel untuk customer VIP.

Acceptance Criteria:
✅ Kasir bisa input harga manual
✅ Jika override > 10% dari Retail, butuh PIN manager
✅ Override tercatat di audit log
```

---

## Epic 3: Settlement

### US-020: Settlement Shift
```
As a Kasir,
I want to menutup shift dengan settlement yang akurat,
So that accountability terjaga.

Acceptance Criteria:
✅ Kasir input Real Cash
✅ Sistem hitung Expected Cash otomatis
✅ Sistem tampilkan Variance
✅ Print settlement report berisi: total penjualan, pengeluaran, selisih, TTD
✅ Sekali settle, tidak bisa dibuka ulang
✅ Shift status: CLOSED
```

---

## Epic 4: Void

### US-030: Request Void
```
As a Kasir,
I want to request hapus nota yang salah,
So that data transaksi akurat.

Acceptance Criteria:
✅ Kasir bisa pilih nota (termasuk lama, no time limit)
✅ Kasir input alasan
✅ Submit request → status PENDING_APPROVAL
✅ Menunggu approval backoffice
✅ Jika APPROVED: stock return otomatis, refund cash, audit log
```

---

## Epic 5: Stock Opname

### US-040: SO Harian
```
As a Kasir,
I want to melakukan SO harian dengan cepat,
So that selisih stock bisa terdeteksi dini.

Acceptance Criteria:
✅ Kasir pilih metode: Suggest / Keluar Hari Ini / Manual
✅ Kasir checklist 20-30 item
✅ Input stock fisik per UOM
✅ Sistem hitung selisih per UOM
✅ Submit untuk approval
✅ Target waktu < 1 jam
✅ Bisa skip dengan alasan (tercatat di log)
```

---

## Epic 6: Purchase Order

### US-050: Buat PO
```
As a Kasir,
I want to membuat request PO ke supplier,
So that stock barang bisa di-restock.

Acceptance Criteria:
✅ Kasir buka "Buat PO"
✅ Sistem suggest produk (stock rendah / forecast)
✅ Kasir tambah produk, qty
✅ Sistem auto-fill harga beli terakhir
✅ Submit → PENDING_APPROVAL (menunggu owner)
```

### US-051: Terima Barang Tanpa Invoice
```
As a Petugas Gudang,
I want to terima barang meski invoice belum datang,
So that perputaran barang lancar.

Acceptance Criteria:
✅ Gudang input qty terima (tanpa harga)
✅ Sistem pakai "harga beli terakhir" sementara
✅ Stock tetap masuk, bisa dijual
✅ Flag: invoice_received = false
✅ Nanti invoice datang → update harga actual
```

---

## Epic 7: Multi-Kasir Settlement (NEW in v1.1)

### US-070: Manager Buka Shift Multi-Kasir
```
As a Manager Toko,
I want to membuka shift dan assign multiple kasir,
So that shift bisa dijalankan oleh 2-3 kasir secara bersamaan.

Acceptance Criteria:
✅ Manager login ke POS
✅ Manager klik "Buka Shift Baru"
✅ Set shift number, waktu, modal awal (Rp 200k shared)
✅ Assign 2-3 kasir ke shift tersebut
✅ Shift status: OPEN
✅ Assigned kasir bisa login dan mulai transaksi
```

### US-071: Kasir Join Shift Aktif
```
As a Kasir,
I want to join shift yang sudah dibuka oleh manager,
So that saya bisa mulai melayani customer.

Acceptance Criteria:
✅ Kasir login ke POS
✅ Sistem tampilkan shift yang sudah dibuka
✅ Kasir klik "Mulai Kerja" atau "Join Shift"
✅ Kasir bisa mulai transaksi
✅ Modal awal shared dengan kasir lain di shift yang sama
```

### US-072: Settlement Multi-Kasir dengan Cash Terpisah
```
As a Manager Toko,
I want to melakukan settlement per kasir dengan cash terpisah,
So that setiap kasir tanggung jawab atas selisih mereka masing-masing.

Acceptance Criteria:
✅ Manager klik "Tutup Shift & Settlement"
✅ Sistem generate breakdown per kasir otomatis:
  - Total penjualan per kasir (per payment method)
  - Total pengeluaran per kasir
  - Expected cash per kasir
✅ Manager minta setiap kasir hitung cash MEREKA sendiri
✅ Manager input real cash per kasir ke sistem
✅ Sistem hitung selisih PER KASIR otomatis (auto-split responsibility)
✅ Print settlement report dengan breakdown per kasir
✅ Kasir A lebih Rp 50k = tanggung jawab Kasir A
✅ Kasir B kurang Rp 50k = tanggung jawab Kasir B
✅ Total shift bisa 0 selisih meski per kasir ada selisih
```

---

## Epic 8: Owner Price Override (NEW in v1.1)

### US-080: Owner Override Harga untuk Deal Khusus
```
As an Owner,
I want to input harga manual (tier 7) yang tidak visible untuk kasir,
So that saya bisa handle deal khusus tanpa kasir tahu harga special.

Acceptance Criteria:
✅ HANYA Owner yang bisa akses fitur ini (role-based)
✅ Owner login ke POS dengan akun Owner
✅ Saat checkout, Owner klik "Owner Price Override"
✅ Sistem minta re-authenticate (PIN Owner)
✅ Owner input harga manual (contoh: Rp 90k, meski retail Rp 100k)
✅ Sistem validasi: tidak boleh Rp 0
✅ Boleh lebih rendah dari harga terendah (no block)
✅ Warning jika override < 50% dari retail (confirm lagi)
✅ Harga di keranjang: Rp 90k dengan label "Owner Override"
✅ Label tidak tampil di struk customer (hanya harga final)
✅ Tercatat di audit log:
  - Product, UOM, original price, override price
  - Override by (Owner user_id), timestamp, customer_id
✅ Kasir/Manager TIDAK bisa lihat harga override di history
✅ Backoffice: Owner bisa filter transaksi dengan "Owner Override"
```
