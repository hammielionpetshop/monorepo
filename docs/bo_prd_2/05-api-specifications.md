# 5. API SPECIFICATIONS — PART 2

## 5.1 Product APIs

### GET /api/products
```
Query params:
- page, limit (pagination)
- category_id, brand_id (filter)
- status (active/inactive/discontinued)
- search (SKU/name/barcode)
- branch_id (untuk lihat stock & harga per cabang)
- tag_id (filter by tag)

Response:
{
  data: [
    {
      product_id, sku, name, category, brand,
      status, primary_image, stock, pricing: {...}
    }
  ],
  pagination: { total, page, limit }
}
```

### POST /api/products
```
Body: {
  sku, name, category_id, brand_id, description,
  supplier_ids: [],
  uoms: [
    { uom_name, is_base, conversion_to_base }
  ],
  pricing: {
    branch_id, uom_id,
    tier_1_retail, tier_2_grosir, ...
  },
  images: []
}

Response: { product_id, message: "Product created" }
```

### PUT /api/products/:id
```
Body: (same as POST, partial update allowed)
Response: { message: "Product updated" }

Side effects:
- Audit log recorded
- Approval workflow triggered if price change > 10%
```

### DELETE /api/products/:id
```
Validation:
- Check stock > 0? → 400 Block
- Check pernah terjual? → 400 Block
- Require Owner approval

Response: { message: "Product deleted" }
```

## 5.2 Pricing APIs

### GET /api/pricing
```
Query: ?product_id=X&branch_id=Y

Response: {
  product_id, branch_id, uom_id,
  tier_1_retail, tier_2_grosir, tier_3_member,
  tier_4_distributor, tier_5_reseller, tier_6_promo,
  minimum_price
}
```

### POST /api/pricing/bulk-update
```
Body: {
  filter: { category_id, brand_id, tag_id },
  branch_id,
  action: "increase_percent" | "decrease_percent" | "increase_amount" | "decrease_amount",
  value: 10
}

Response: { affected_count: 100 }
```

### POST /api/pricing/copy-branch
```
Body: {
  source_branch_id,
  target_branch_id,
  filter: { category_id? },
  adjustment_percent: 5
}

Response: { copied_count: 500 }
```

### POST /api/pricing/import
```
Body: multipart/form-data (Excel file)

Response: {
  preview: [ { sku, uom, old_price, new_price } ],
  error_count: 0,
  success_count: 500
}
```

## 5.3 Category APIs

```
GET    /api/categories          → Tree structure
POST   /api/categories          → Create
PUT    /api/categories/:id      → Update
DELETE /api/categories/:id      → Delete (with validation)
```

## 5.4 Brand APIs

```
GET    /api/brands              → List
POST   /api/brands              → Create
PUT    /api/brands/:id          → Update
DELETE /api/brands/:id          → Delete (with validation)
```

## 5.5 Tag APIs

```
GET    /api/tags                → List all tags
POST   /api/tags                → Create tag
PUT    /api/products/:id/tags   → Assign/remove tags to product
```
