# 2. EXECUTIVE SUMMARY

## 🎯 Business Context

Business owner memiliki jaringan **20 toko petshop** dengan karakteristik:
- **>1000 SKU** per toko (produk makanan hewan, aksesoris, obat-obatan, dll)
- **2-4 kasir** per toko dengan sistem shift
- **Multi-UOM** untuk sebagian besar produk (Sak, Dus, Box, Pcs, Kg, Gram)
- **Multi-pricing** (6 tier harga: Retail, Grosir, Member, Distributor, Reseller, Promo + manual override)
- **Offline operation** (POS harus tetap jalan saat internet mati)

## ❌ Problem Statement

Sistem POS lama (Electron monolitik) memiliki masalah:
1. Sinkronisasi dua arah SQLite ↔ PostgreSQL menyebabkan race condition
2. Laporan tidak akurat karena konflik data
3. Kompleksitas maintenance tinggi
4. Tidak efisien untuk scaling ke 20+ toko

## ✅ Solution Overview

Arsitektur baru dengan pemisahan:
- **Backoffice** (Next.js 15 web app) → manajemen, laporan, approval
- **POS Desktop** (Electron + React) → kasir, offline-capable
- **PostgreSQL** (Single Source of Truth) → semua data terpusat
- **API Layer** (REST/tRPC) → semua komunikasi melalui API
- **Write Queue** (IndexedDB + Dexie.js) → offline capability

## 🎯 Scope Dokumen Ini

PRD ini **FOKUS PADA APLIKASI POS** (bukan Backoffice). Modul yang dicakup:
1. Sistem Kasir dengan Multi-UOM & Auto-Break
2. Stock Opname (Harian & Bulanan)
3. Purchase Order (PO)
4. Settlement & Shift Management
5. Void Transaction
6. Customer Debt (Piutang)
7. Diskon Engine
8. Daily Expenses
