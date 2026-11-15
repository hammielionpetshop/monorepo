# 📘 MVP OVERVIEW - POS & BACKOFFICE PETSHOP

## 🎯 PROJECT SUMMARY

**Nama Project**: Integrated POS & Backoffice System untuk Petshop Multi-Cabang  
**Tujuan MVP**: Sistem operasional untuk 20 cabang dengan 3 fitur utama:
1. ✅ Bisa berjualan (POS)
2. ✅ Bisa check stock barang (Real-time)
3. ✅ Bisa check laporan keuangan (Omset, Laba Rugi, Pengeluaran)

**Timeline**: 4 bulan (16 minggu, 8 sprint @ 2 minggu)  
**Team Size**: 2-3 developers  
**Technology Stack**: Next.js 15 (PWA) + PostgreSQL + Electron (POS)

---

## 📋 FITUR MVP (17 FITUR TOTAL)

### **POS FEATURES (11 fitur)**

| No | Fitur | Sprint | Priority |
|----|-------|--------|----------|
| 1 | Login User | Sprint 1 | P0 |
| 2 | Penjualan (Multi-UOM, Multi-Harga, FIFO) | Sprint 4-5 | P0 |
| 3 | Stock Opname Harian | Sprint 7 | P0 |
| 4 | Input Barang Rusak | Sprint 7 | P0 |
| 5 | Settlement Multi-Kasir | Sprint 6 | P0 |
| 6 | Pengeluaran Harian | Sprint 6 | P0 |
| 7 | Pemesanan Barang ke Supplier (PO Request) | Sprint 8 | P0 |
| 8 | Open Bill (Pending Transaction) | Sprint 5 | P1 |
| 9 | Shift Management | Sprint 6 | P0 |
| 10 | Multi-Kasir per Shift (2-3 kasir) | Sprint 6 | P0 |
| 11 | Tampilan Berat Pesanan | Sprint 5 | P1 |

### **BACKOFFICE FEATURES (6 fitur)**

| No | Fitur | Sprint | Priority |
|----|-------|--------|----------|
| 1 | Login & User Role (4 roles) | Sprint 1 | P0 |
| 2 | Dashboard KPI | Sprint 3 | P1 |
| 3 | Master Data (Produk, Supplier, Cabang, User, Kategori, UOM, Multi-Harga) | Sprint 2-3 | P0 |
| 4 | Inventory per Cabang | Sprint 3 | P0 |
| 5 | Stock Opname Bulanan | Sprint 7 | P0 |
| 6 | Laporan Keuangan (Omset, Laba Rugi, Pengeluaran) | Sprint 8 | P0 |

---

## 🗓️ SPRINT TIMELINE

| Sprint | Week | Focus Area | Story Points | Status |
|--------|------|------------|--------------|--------|
| Sprint 1 | 1-2 | Foundation & Authentication | 25 | 🔴 Not Started |
| Sprint 2 | 3-4 | Master Data Foundation | 26 | 🔴 Not Started |
| Sprint 3 | 5-6 | Multi-Harga & Inventory Setup | 26 | 🔴 Not Started |
| Sprint 4 | 7-8 | POS Penjualan + FIFO ⭐ | 26 | 🔴 Not Started |
| Sprint 5 | 9-10 | Payment, Receipt & DO | 30 | 🔴 Not Started |
| Sprint 6 | 11-12 | Shift & Settlement | 27 | 🔴 Not Started |
| Sprint 7 | 13-14 | Stock Opname & Barang Rusak | 25 | 🔴 Not Started |
| Sprint 8 | 15-16 | PO, Hutang & Laporan | 30 | 🔴 Not Started |
| **TOTAL** | **16 weeks** | **MVP Complete** | **215 points** | |

---

## 🎯 KEY TECHNICAL REQUIREMENTS

### **1. Multi-UOM (5 Satuan)**
- Pcs, Sak, Dus, Box, Pack
- Conversion ratio per produk (tidak fixed)
- Auto-break logic (Sak → Pcs jika Sak habis)

### **2. Multi-Harga (4 Tier)**
- Tier 1: Retail (harga normal)
- Tier 2: Grosir (untuk reseller)
- Tier 3: Member (untuk member card)
- Tier 4: Owner Manual Input (owner bisa override harga saat transaksi)

### **3. FIFO (First In First Out)** ⭐ CRITICAL
- Batch tracking per PO received
- COGS calculation dari batch terlama
- Auto-break batch (Sak → Pcs maintain parent batch link)
- Implementation di Sprint 4 (MOST CRITICAL SPRINT)

### **4. Multi-Kasir per Shift**
- 1 shift = 2-3 kasir bisa checkout bersamaan
- Modal shared Rp 200k
- Settlement breakdown per kasir
- Variance tracking per kasir

### **5. Hutang Supplier Tracking** (NEW - ditambahkan dari feedback)
- Auto-create hutang saat PO received
- Partial payment support (bayar sebagian)
- Aging tracking
- Payment history per supplier

### **6. Surat Jalan (DO)**
- Manual trigger setelah checkout & print receipt
- Tampilkan pilihan "Cetak Surat Jalan?"
- Include total berat pesanan
- Print A4 format

---

## 📊 DATABASE OVERVIEW

**Total Tables**: ~24 tables untuk MVP

### **Core Tables**
1. users (4 roles)
2. branches (cabang)
3. categories (1 level)
4. products
5. product_uoms (5 UOM, conversion ratio)
6. product_pricing (4 tier per UOM)
7. suppliers (master supplier)
8. customers (basic info)

### **Transaction Tables**
9. shifts
10. transactions (sales)
11. transaction_items
12. settlements
13. settlement_kasir_breakdown
14. daily_expenses

### **Inventory Tables**
15. inventory_stock
16. inventory_batches (FIFO tracking)
17. stock_opname_headers
18. stock_opname_details
19. damaged_goods

### **Purchasing Tables**
20. purchase_orders
21. purchase_order_items
22. supplier_payables (hutang tracking) ← NEW
23. supplier_payments (payment history) ← NEW

### **Operational Tables**
24. delivery_orders (surat jalan)

---

## 🎯 MILESTONE CHECKLIST

### ✅ After Sprint 2 (Week 4): Master Data Ready
- [ ] User bisa login (POS & Backoffice)
- [ ] Master data complete (Produk, Supplier, Cabang, User, Kategori)
- [ ] Multi-UOM setup working (5 UOM)
- [ ] Multi-Harga setup working (4 tier)

### ✅ After Sprint 4 (Week 8): POS Penjualan Working
- [ ] POS checkout complete
- [ ] FIFO COGS calculation working ⭐
- [ ] Auto-break working (Sak → Pcs)
- [ ] Multi-UOM & Multi-Harga selection working

### ✅ After Sprint 6 (Week 12): Settlement Working
- [ ] Payment flow complete
- [ ] Receipt printing working
- [ ] Surat Jalan (DO) working
- [ ] Shift & Multi-kasir settlement working

### ✅ After Sprint 8 (Week 16): MVP COMPLETE 🎉
- [ ] Stock Opname (Harian & Bulanan) working
- [ ] Barang rusak write-off working
- [ ] PO workflow complete (Request → Approve → Receive)
- [ ] Hutang supplier tracking working
- [ ] Payment hutang working (partial support)
- [ ] Laporan keuangan (3 laporan) working
- [ ] **SYSTEM READY FOR PRODUCTION!**

---

## 📁 FILE STRUCTURE

Dokumentasi MVP terbagi dalam 10 files:

```
1. MVP_OVERVIEW.md (THIS FILE)
   └── Ringkasan project, timeline, milestone

2. MVP_PRD_MAPPING.md
   └── Mapping 17 fitur ke PRD reference detail

3. MVP_SPRINT_1_FOUNDATION.md
   └── Sprint 1: Foundation & Authentication (Week 1-2)

4. MVP_SPRINT_2_MASTER_DATA.md
   └── Sprint 2: Master Data Foundation (Week 3-4)

5. MVP_SPRINT_3_MULTI_HARGA_INVENTORY.md
   └── Sprint 3: Multi-Harga & Inventory Setup (Week 5-6)

6. MVP_SPRINT_4_POS_PENJUALAN_FIFO.md
   └── Sprint 4: POS Penjualan + FIFO ⭐ CRITICAL (Week 7-8)

7. MVP_SPRINT_5_PAYMENT_RECEIPT.md
   └── Sprint 5: Payment, Receipt & DO (Week 9-10)

8. MVP_SPRINT_6_SHIFT_SETTLEMENT.md
   └── Sprint 6: Shift & Settlement Multi-Kasir (Week 11-12)

9. MVP_SPRINT_7_SO_BARANG_RUSAK.md
   └── Sprint 7: Stock Opname & Barang Rusak (Week 13-14)

10. MVP_SPRINT_8_PO_LAPORAN_HUTANG.md
    └── Sprint 8: PO, Hutang Supplier & Laporan (Week 15-16)
```

---

## ⚠️ CRITICAL SUCCESS FACTORS

### **1. FIFO Implementation (Sprint 4)** ⭐⭐⭐
- **Most complex technical requirement**
- **Allocate 2 developers**
- **Extra testing required**
- **If this fails, everything delays!**

### **2. Multi-Kasir Settlement (Sprint 6)**
- Complex variance calculation per kasir
- Need extensive testing with dummy data
- Edge cases: negative variance, force close scenarios

### **3. Hutang Supplier Partial Payment (Sprint 8)**
- Payment history tracking
- Running balance calculation
- Aging report accuracy

---

## 🚀 NEXT STEPS

1. ✅ Read this overview
2. ✅ Read MVP_PRD_MAPPING.md (for PRD reference)
3. ✅ Start Sprint 1: Read MVP_SPRINT_1_FOUNDATION.md
4. ✅ Setup development environment
5. ✅ Begin development!

---

## 📞 SUPPORT

Untuk pertanyaan atau klarifikasi, refer ke:
- **Full PRD**: 8-part Backoffice PRD + POS PRD v1.1
- **Sprint Details**: MVP_SPRINT_X_*.md files
- **PRD Mapping**: MVP_PRD_MAPPING.md

---

**Last Updated**: 18 April 2026  
**Version**: 1.0  
**Status**: Ready for Development 🚀
