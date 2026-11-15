# 4. USER PERSONAS

## 👤 Persona 1: Kasir (Cashier)

| Aspek | Detail |
|-------|--------|
| **Role** | Operator kasir di toko |
| **Akses** | POS Desktop App |
| **Kebutuhan** | Input transaksi cepat, settlement akurat |
| **Pain Points** | POS lemot, offline tidak bisa transaksi, sulit cari produk |
| **Permissions** | Jual, SO harian (submit), void request, input pengeluaran, settlement |
| **Restrictions** | Tidak bisa hapus transaksi langsung, tidak bisa override diskon besar |

## 👤 Persona 2: Manager Toko

| Aspek | Detail |
|-------|--------|
| **Role** | Supervisor operasional toko |
| **Akses** | POS Desktop App + Backoffice (read) |
| **Kebutuhan** | Approve request, monitor kasir, edit PO |
| **Permissions** | Semua akses kasir + approve void + approve SO + edit PO (sebelum diterima) |
| **Restrictions** | Tidak bisa final approve PO, tidak bisa delete data master |

## 👤 Persona 3: Petugas Gudang

| Aspek | Detail |
|-------|--------|
| **Role** | Terima barang dari supplier |
| **Akses** | POS Desktop App (modul PO Receiving) |
| **Kebutuhan** | Input penerimaan barang cepat (qty saja) |
| **Permissions** | Scan barcode, input qty terima, foto bukti |
| **Restrictions** | Tidak bisa input harga (hanya backoffice yang approve harga) |

## 👤 Persona 4: Finance / Owner

| Aspek | Detail |
|-------|--------|
| **Role** | Kontrol finansial dan approval final |
| **Akses** | Backoffice (full) + POS (view only) |
| **Kebutuhan** | Approve void, approve SO, approve PO, lihat laporan |
| **Permissions** | Full CRUD semua modul |
| **Restrictions** | None |
