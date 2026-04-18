# 6. NON-FUNCTIONAL REQUIREMENTS

## 6.1 Performance

| Metric | Target |
|--------|--------|
| POS startup time | < 3 detik |
| Transaction checkout | < 2 detik |
| Search produk | < 500ms |
| Barcode scan response | < 200ms |
| Sync offline data (100 trx) | < 10 detik |

## 6.2 Security

```
Authentication:
├── Login: Email/PIN (4-6 digit)
├── Session: JWT token di Electron safeStorage
└── Auto-logout: 30 menit idle (configurable)

Authorization:
├── Role-Based Access Control (RBAC)
├── Permission granular per fitur
└── Audit log untuk semua action kritikal

Data Protection:
├── Encryption at rest (database)
├── Encryption in transit (HTTPS)
├── Secure storage untuk JWT (Electron safeStorage)
└── No password in plain text (bcrypt/argon2)

Roles:
├── Kasir
├── Manager Toko
├── Petugas Gudang
├── Finance
├── General Manager
└── Owner
```

## 6.3 Scalability

```
├── Support 20 toko simultan
├── 2-4 kasir per toko = max 80 kasir concurrent
├── >1000 SKU per toko
├── ~1000 transaksi/hari per toko
└── Database size: plan for 5 tahun growth
```

## 6.4 Offline Capability

```
Offline Storage:
├── IndexedDB via Dexie.js
├── Cache: produk, harga, customer, metode pembayaran
└── Write Queue: transaksi yang belum sync

Sync Strategy:
├── Auto-detect online status
├── Background sync (non-blocking)
├── Conflict resolution: last-write-wins (kecuali kasus khusus)
└── Retry mechanism dengan exponential backoff

Duration:
├── TANPA BATAS WAKTU
└── Sampai koneksi internet kembali
```

## 6.5 Hardware Integration

```
Printer:
├── Thermal 58mm (struk kasir)
├── Thermal 80mm (struk panjang)
├── Dot Matrix A4 (laporan formal)
└── Library: node-thermal-printer

Barcode Scanner:
├── USB HID
└── Otomatis terdeteksi sebagai keyboard input

Cash Drawer (optional):
└── Kick via RJ11 dari printer thermal
```
