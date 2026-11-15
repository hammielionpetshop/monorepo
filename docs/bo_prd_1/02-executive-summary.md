# 2. EXECUTIVE SUMMARY

## 🎯 Business Context

Business owner memiliki **20 toko petshop** dengan:
- **>1000 SKU** per toko
- **2-4 kasir** per toko (multi-shift)
- **Multi-UOM** untuk produk
- **6 tier harga + 1 owner override**
- **Offline-capable POS** (sudah defined di docs/pos_prd_1/)

**Backoffice adalah command center** untuk:
- Monitoring real-time semua cabang
- Approval workflow (void, SO, PO)
- Financial management & reporting
- Master data management (produk, harga, supplier, dll)
- User & permission management

## ❌ Problem Statement

Owner menghadapi masalah:
1. **Tidak bisa monitoring real-time** semua cabang
2. **Approval lambat** (void, SO, PO harus via WA/manual)
3. **Laporan tidak akurat** karena data tidak sinkron
4. **Kontrol harga sulit** (20 toko, ribuan produk)
5. **Stock opname manual** (error-prone)
6. **Cash flow tidak transparan** per cabang

## ✅ Solution Overview

**Backoffice Web App (Next.js 15)** dengan:
- **Real-time dashboard** (sales, stock, alerts)
- **Centralized approval** (1-click approve/reject)
- **Accurate reporting** (sales, stock, finance)
- **Master data management** (products, pricing, suppliers)
- **User & RBAC** (granular permission)
- **PWA** (bisa buka di desktop & mobile)
