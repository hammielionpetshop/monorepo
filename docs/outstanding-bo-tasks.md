# 🏢 OUTSTANDING BACKOFFICE (BO) TASKS

Dokumen ini mencatat seluruh fitur dan fungsionalitas Backend/Admin Dashboard (Backoffice) yang perlu diimplementasikan seiring berjalannya fase pengembangan. 

> [!NOTE]
> Fitur-fitur ini akan dikerjakan secara bertahap sesuai dengan prioritas fase yang sedang berjalan.

---

## 🔐 Phase 1 — Foundation (Admin & User Management)
- [ ] **User Management**: UI untuk mengelola pengguna (Tambah/Edit/Hapus) dan penempatan cabang.
- [ ] **RBAC Editor**: UI untuk mengkonfigurasi Permission pada setiap Role (Manager, Owner, Kasir, Admin).
- [ ] **Branch Settings**: Management data cabang (Alamat, Kode Cabang, Kontak).

## 📦 Phase 2 — Core POS Sales (Master Data)
- [ ] **Product Master (CRUD)**: Input produk, upload foto, SKU, dan barcode.
- [ ] **Multi-UOM Config**: UI untuk mengatur konversi satuan (misal: 1 Karton = 24 Pcs) per produk.
- [ ] **Price Tier Manager**: Pengaturan 6 tingkat harga per produk per cabang.
- [ ] **Brand & Category Management**: Pengelompokan produk.
- [ ] **Inventory Dashboard**: View stok agregat dan per batch (FIFO) lintas cabang.

## 💰 Phase 3 — Settlement & Expenses
- [ ] **Settlement Review Dashboard**: View hasil tutup shift dari cabang, pantau selisih cash (variance), dan status setoran.
- [ ] **Expense Audit**: Review bukti foto pengeluaran harian dan kategori biaya.
- [ ] **Shift History**: Rekapitulasi durasi shift dan performa kasir.

## 📊 Phase 4 — Stock Opname
- [ ] **FULL SO Initiator**: Form untuk memulai Stock Opname Besar (Pilih Kategori/Cabang/Petugas).
- [ ] **SO Approval Dashboard**: Review selisih (variance) dari hasil input kasir, lihat estimasi kerugian (FIFO cost), dan tombol **Setujui/Tolak**.
- [ ] **Notification Center**: Dashboard khusus untuk alert (misal: Kasir men-skip SO harian).
- [ ] **Adjustment Logs**: Riwayat penyesuaian stok otomatis yang dipicu oleh SO.

## 🛒 Phase 5 — Purchase Order (PO) & Receiving
- [ ] **Supplier Management**: Database supplier dan kontak.
- [ ] **PO Workflow**: Form pembuatan PO dan alur persetujuan internal (Draft -> Approved).
- [ ] **Receiving Goods**: Form input barang datang, pencatatan expired date, dan harga modal actual (auto-update FIFO batch).
- [ ] **Supplier Payables**: Tracking hutang dagang ke supplier.

## 🚫 Phase 6 — Void, Debt, & Discount
- [ ] **Void Approval**: Dashboard untuk menyetujui request penghapusan transaksi dari kasir.
- [ ] **Customer Credit Management**: Pengaturan limit piutang per customer member.
- [ ] **Discount Engine UI**: Konfigurasi promo (Beli X Gratis Y, Diskon %, Bundle, dll) untuk di-push ke semua POS.

## 📈 Phase 8 — Reports & Analytics
- [ ] **Sales Report**: Filter by date, branch, payment method.
- [ ] **Profit & Loss**: Laporan laba kotor berdasarkan HPP FIFO.
- [ ] **Slow Moving / Fast Moving Products**: Analisa perputaran stok.
- [ ] **Stock Movement Ledger**: Histori lengkap kartu stok untuk audit.
