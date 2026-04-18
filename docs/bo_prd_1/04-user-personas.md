# 4. USER PERSONAS

## 👤 Persona 1: Owner

| Aspek | Detail |
|-------|--------|
| **Role** | Business owner, decision maker |
| **Akses** | Full access semua fitur |
| **Kebutuhan** | Real-time monitoring, approval final, laporan lengkap |
| **Pain Points** | Tidak bisa monitor 20 toko bersamaan, laporan lambat |
| **Permissions** | CRUD all, approve all, view all |
| **Restrictions** | None (God mode) |
| **Daily Tasks** | Cek dashboard (pagi), approve PO (harian), review laporan (mingguan) |

## 👤 Persona 2: Finance

| Aspek | Detail |
|-------|--------|
| **Role** | Financial controller |
| **Akses** | Finance module, approval module |
| **Kebutuhan** | Cash flow akurat, P&L real-time, approve void/PO |
| **Pain Points** | Data finansial tidak real-time, piutang sulit track |
| **Permissions** | View all finance, approve void/PO, input expenses |
| **Restrictions** | Tidak bisa edit master data produk, tidak bisa manage user |
| **Daily Tasks** | Approve void (harian), check cash flow (harian), rekonsiliasi (mingguan) |

## 👤 Persona 3: Manager Backoffice

| Aspek | Detail |
|-------|--------|
| **Role** | Operations manager |
| **Akses** | Master data, inventory, approval module |
| **Kebutuhan** | Kelola produk/harga, approve SO, monitor stock |
| **Pain Points** | Update harga 1000 produk manual, SO approval lambat |
| **Permissions** | CRUD products/categories/brands, approve SO, view reports |
| **Restrictions** | Tidak bisa approve PO >5 juta, tidak bisa delete user |
| **Daily Tasks** | Update harga (as needed), approve SO (harian), check stock alert (harian) |

## 👤 Persona 4: Super Admin (IT Team)

| Aspek | Detail |
|-------|--------|
| **Role** | System administrator |
| **Akses** | User management, system settings, audit log |
| **Kebutuhan** | Kelola user, permission, troubleshoot, system health |
| **Pain Points** | User lupa password, permission setup kompleks |
| **Permissions** | CRUD users, view audit log, configure settings |
| **Restrictions** | Tidak bisa approve PO/void (bukan finance role) |
| **Daily Tasks** | Monitor system health, respond to support tickets |
