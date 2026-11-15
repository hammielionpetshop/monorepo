# 6. BUSINESS RULES (DECISION TABLES)

## 6.1 Price Change Approval

| Condition | Action |
|-----------|--------|
| Price change ≤ 10% | Auto-approve, no workflow |
| Price change > 10% AND user = Owner | Auto-approve |
| Price change > 10% AND user ≠ Owner | Require Owner approval → PENDING_APPROVAL |

## 6.2 Product Delete Validation

| Condition | Result |
|-----------|--------|
| Stock > 0 di semua cabang | ❌ Block delete |
| Pernah ada transaksi dengan produk ini | ❌ Block delete |
| Stock = 0 AND tidak pernah terjual | ⚠️ Require Owner approval |

## 6.3 UOM Pricing Rules

| Condition | Rule |
|-----------|------|
| Harga UOM besar vs kecil | TIDAK harus proporsional |
| Harga Pcs vs Sak | Bisa lebih mahal per Pcs (normal) |
| Harga per cabang | Bisa berbeda antar cabang |
| Tier 7 (Owner Override) | Tidak di-set di Backoffice, hanya di POS |

## 6.4 Category Delete Validation

| Condition | Result |
|-----------|--------|
| Ada produk di kategori | ❌ Block delete |
| Ada child category | ❌ Block delete (hapus child dulu) |
| Kategori kosong | ✅ Allow soft delete |

## 6.5 Scheduled Price Change

| Condition | Behavior |
|-----------|----------|
| effective_date = today | Apply immediately |
| effective_date = future | Queue, apply at midnight |
| effective_date = past | Reject (cannot schedule in past) |
