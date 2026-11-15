# 10. BUSINESS RULES (DECISION TABLES)

## 10.1 Decision Table: Auto-Break

| Stock UOM Besar | Stock UOM Kecil | Qty Jual (UOM Kecil) | Aksi |
|-----------------|-----------------|----------------------|------|
| 9 Sak | 20 Pcs | 1 Pcs | Kurangi Pcs saja |
| 9 Sak | 20 Pcs | 20 Pcs | Kurangi Pcs saja (habis) |
| 9 Sak | 20 Pcs | 25 Pcs | Auto-break 1 Sak → +30 Pcs, jual 25 |
| 9 Sak | 20 Pcs | 50 Pcs | Auto-break 1 Sak → +30 Pcs, jual 50 |
| 9 Sak | 20 Pcs | 51 Pcs | Auto-break 2 Sak → +60 Pcs, jual 51 |
| 2 Sak | 10 Pcs | 80 Pcs | ERROR: stock tidak cukup |
| 0 Sak | 0 Pcs | 1 Pcs | ERROR: stock kosong |

## 10.2 Decision Table: Diskon Conflict

| Produk Eligible | Stackable? | Hasil |
|-----------------|-----------|-------|
| Promo A (10%) | False | Apply 10% |
| Promo A (10%), Promo B (15%) | False | Apply 15% (terbesar) |
| Promo A (10%), Promo B (15%) | True | Apply 25% (stack) |
| Promo A (10% stackable), Promo B (15% non-stack) | - | Apply 15% (terbesar) |
| None | - | No discount |

## 10.3 Decision Table: Settlement Variance

| Variance | Aksi | Tanggung Jawab |
|----------|------|----------------|
| = 0 | Settlement OK | - |
| > 0 (lebih) | Investigate, catat di log | Kasir report |
| < 0 (kurang) | Catat di log, potong gaji? | Kasir |
| < -500.000 | Eskalasi ke owner | Kasir + Manager |

## 10.4 Decision Table: Piutang

| Setting Piutang | Customer Limit | Hutang Sekarang | Beli Baru | Hasil |
|-----------------|---------------|----------------|-----------|-------|
| OFF (global) | - | - | - | Tidak bisa hutang |
| ON | NULL (no limit) | Rp 500k | Rp 200k | OK |
| ON | Rp 1.000k | Rp 500k | Rp 200k | OK (total 700k) |
| ON | Rp 1.000k | Rp 900k | Rp 200k | REJECT (1.100k > 1.000k) |
| ON | Rp 1.000k | Rp 1.000k | Rp 1k | REJECT |

## 10.5 Decision Table: Void Request

| Kondisi Nota | Bisa Void? | Approval By |
|-------------|-----------|-------------|
| Hari ini | Ya | Manager/Finance/Owner |
| Kemarin | Ya | Manager/Finance/Owner |
| > 30 hari | Ya (no limit) | Owner only |
| Sudah di-void | Tidak | - |
| Sudah masuk settlement | Ya | Owner only (re-generate report) |

## 10.6 Decision Table: PO Edit

| Status PO | Bisa Edit? | Yang Bisa Edit |
|-----------|-----------|----------------|
| DRAFT | Ya | Kasir (creator) |
| PENDING_APPROVAL | Ya | Manager |
| APPROVED | Ya | Manager |
| IN_TRANSIT | Tidak | - |
| PARTIALLY_RECEIVED | Tidak | - |
| FULLY_RECEIVED | Tidak | - |
| COMPLETED | Tidak | - |
| CANCELLED | Tidak | - |
