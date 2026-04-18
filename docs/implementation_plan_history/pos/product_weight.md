# Implementation Plan: Berat Produk & Total Berat di Keranjang

**Tanggal:** 2026-04-18  
**Scope:** POS Desktop + Bootstrap API + Shared Types

---

## Latar Belakang

Setiap produk harus memiliki data berat. Ketika produk ditambahkan ke keranjang, total berat seluruh item harus ditampilkan di ringkasan keranjang. Total berat harus ikut berubah ketika satuan (UOM) produk diganti.

---

## Gap Analysis

### Yang sudah ada ✅

- Kolom `weight_gram` sudah ada di tabel `product_uom_conversions` (DB schema)
- `CartItem.weightGram?: number` sudah ada di `packages/shared/src/types/cart.ts`
- `CartTotals.totalWeightGram: number` sudah ada di `packages/shared/src/types/cart.ts`
- `getTotals()` di `cart-store.ts` sudah menghitung `totalWeightGram = Σ(weightGram × qty)`

### Yang belum ada / perlu diubah ❌

- Tabel `products` belum punya kolom `weight_gram` untuk berat satuan dasar (base UOM)
- `ProductUomConversion` type di shared belum expose field `weightGram`
- `Product` type di shared belum punya field `weightGram`
- Bootstrap API tidak mengembalikan `weightGram` di data products maupun conversions
- `ProductGrid.tsx` tidak meneruskan `weightGram` ke cart saat produk ditambahkan
- `CartItem.tsx` tidak update `weightGram` saat UOM diganti
- `CartPanel.tsx` tidak menampilkan `totalWeightGram` di ringkasan

---

## Arsitektur Data Flow

```
DB: products.weight_gram            → berat per base UOM
DB: product_uom_conversions.weight_gram → berat per non-base UOM
              ↓
Bootstrap API — kirim weightGram di products[] & conversions[]
              ↓
POS Store (pos-store.ts) — data ter-load otomatis via setBootstrapData()
              ↓
ProductGrid  — saat klik produk → addItem({ weightGram: product.weightGram })
CartItem     — saat ganti UOM  → replaceItem({ weightGram: conv.weightGram })
              ↓
CartStore.getTotals() — totalWeightGram = Σ(weightGram × qty)
              ↓
CartPanel — tampilkan totalWeightGram di summary
```

---

## File yang Terdampak

| No | File | Jenis Perubahan |
|----|------|-----------------|
| 1 | `packages/db/src/schema/products.ts` | Tambah kolom `weightGram` di tabel `products` |
| 2 | `packages/db/migrations/XXXX_add_weight_to_products.sql` | Migration baru |
| 3 | `packages/shared/src/types/product.ts` | Tambah `weightGram` ke interface `Product` & `ProductUomConversion` |
| 4 | `apps/backoffice/app/api/pos/bootstrap/route.ts` | Include `weightGram` di query products & conversions |
| 5 | `apps/pos-desktop/src/components/pos/ProductGrid.tsx` | Pass `weightGram` saat `addItem` |
| 6 | `apps/pos-desktop/src/components/pos/CartItem.tsx` | Update `weightGram` saat UOM berubah |
| 7 | `apps/pos-desktop/src/components/pos/CartPanel.tsx` | Tampilkan `totalWeightGram` di summary |

---

## Detail Perubahan Per File

### 1. DB Schema — `packages/db/src/schema/products.ts`

Tambah kolom `weightGram` ke tabel `products` untuk berat per satuan base UOM. Kolom ini nullable — produk yang tidak memerlukan tracking berat tidak wajib diisi.

```typescript
// Tambahkan setelah field baseUomId:
weightGram: decimal('weight_gram', { precision: 10, scale: 2 }),
```

### 2. Migration — `packages/db/migrations/XXXX_add_weight_to_products.sql`

```sql
ALTER TABLE petshop.products ADD COLUMN weight_gram DECIMAL(10,2);
```

### 3. Shared Types — `packages/shared/src/types/product.ts`

```typescript
export interface Product {
  id: number;
  sku: string | null;
  barcode: string | null;
  name: string;
  categoryId: number | null;
  brandId: number | null;
  baseUomId: number;
  weightGram?: number | null;  // ← tambahkan
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductUomConversion {
  id: number;
  productId: number;
  uomId: number;
  uomCode: string;
  ratio: number;
  weightGram?: number | null;  // ← tambahkan (sudah ada di DB, expose ke type)
}
```

### 4. Bootstrap API — `apps/backoffice/app/api/pos/bootstrap/route.ts`

**Products query** — tambah `weightGram` ke select:

```typescript
const allProducts = await db
  .select({
    id: products.id,
    sku: products.sku,
    barcode: products.barcode,
    name: products.name,
    categoryId: products.categoryId,
    brandId: products.brandId,
    baseUomId: products.baseUomId,
    weightGram: products.weightGram,  // ← tambahkan
    stock: sql<number>`COALESCE(${productStocks.qty}, 0)`,
  })
  // ...
```

**Conversions query** — tambah `weightGram` ke select:

```typescript
const conversions = await db
  .select({
    id: productUomConversions.id,
    productId: productUomConversions.productId,
    uomId: productUomConversions.uomId,
    ratio: productUomConversions.ratio,
    uomCode: unitsOfMeasure.code,
    weightGram: productUomConversions.weightGram,  // ← tambahkan
  })
  // ...
```

### 5. ProductGrid — `apps/pos-desktop/src/components/pos/ProductGrid.tsx`

Fungsi `handleAddProduct` mengambil `weightGram` dari data product (sudah ter-load via bootstrap).

```typescript
const handleAddProduct = (product: any) => {
  const uomCode = getBaseUomCode(product.baseUomId);
  const unitPrice = getRetailPrice(product.id, product.baseUomId);

  addItem({
    productId: product.id,
    productName: product.name,
    uomId: product.baseUomId,
    uomCode,
    qty: 1,
    unitPrice,
    priceTier: 'RETAIL',
    discountAmount: 0,
    subtotal: unitPrice,
    isOwnerOverride: false,
    weightGram: product.weightGram ?? null,  // ← tambahkan
  });
};
```

### 6. CartItem — `apps/pos-desktop/src/components/pos/CartItem.tsx`

Fungsi `handleUomChange` mencari `weightGram` untuk UOM baru. Logic:
- UOM yang dipilih adalah **base UOM** → pakai `product.weightGram`
- UOM yang dipilih adalah **non-base UOM** → pakai `conversion.weightGram`

Tambahkan `products` dan `conversions` ke destructure dari `usePOSStore`, lalu update `handleUomChange`:

```typescript
const { prices, conversions, products, setOverrideItem, setShowPinChallenge } = usePOSStore();

const handleUomChange = (uomId: number, uomCode: string) => {
  const branchId = 1;
  const foundPrice = prices.find((p: any) =>
    p.productId === item.productId &&
    p.branchId === branchId &&
    p.uomId === uomId &&
    p.tierType === item.priceTier
  );
  const newPrice = foundPrice ? parseFloat(foundPrice.price) : 0;

  // Lookup weightGram untuk UOM baru
  const product = products.find((p: any) => p.id === item.productId);
  let newWeightGram: number | null = null;
  if (uomId === product?.baseUomId) {
    newWeightGram = product?.weightGram ?? null;
  } else {
    const conv = conversions.find((c: any) =>
      c.productId === item.productId && c.uomId === uomId
    );
    newWeightGram = conv?.weightGram ?? null;
  }

  replaceItem(item.productId, item.uomId, {
    ...item,
    uomId,
    uomCode,
    unitPrice: newPrice,
    subtotal: (newPrice * item.qty) - item.discountAmount,
    weightGram: newWeightGram,  // ← tambahkan
  });
};
```

### 7. CartPanel — `apps/pos-desktop/src/components/pos/CartPanel.tsx`

Tambahkan baris total berat di summary. Ditampilkan hanya jika `totalWeightGram > 0`. Format: gram (g) jika < 1.000g, kilogram (kg) jika ≥ 1.000g.

Tambahkan import `Weight` dari `lucide-react`, lalu sisipkan setelah baris Subtotal:

```tsx
{totals.totalWeightGram > 0 && (
  <div className="flex justify-between text-sm">
    <span className="text-neutral-500 font-medium flex items-center gap-1">
      <Weight className="w-3.5 h-3.5" />
      Total Berat
    </span>
    <span className="text-neutral-400 font-mono">
      {totals.totalWeightGram >= 1000
        ? `${(totals.totalWeightGram / 1000).toFixed(2)} kg`
        : `${totals.totalWeightGram.toFixed(0)} g`}
    </span>
  </div>
)}
```

---

## Perilaku Saat UOM Diganti

Total berat **otomatis berubah** ketika satuan produk diganti di keranjang. `weightGram` per unit bukan dihitung dari ratio × base weight, melainkan diambil langsung dari nilai yang diisi per UOM — sehingga berat kemasan dapat diinput secara mandiri (misal: 1 Box tidak harus persis 24 × berat 1 PCS karena ada berat kardus, dll).

**Contoh:**

| Kondisi | UOM | Qty | Berat/unit | Total Berat |
|---------|-----|-----|------------|-------------|
| Sebelum ganti | PCS | 2 | 500g | 1.000g = 1 kg |
| Setelah ganti ke Box | Box | 2 | 12.000g | 24.000g = 24 kg |

---

## Edge Cases

- Produk tanpa `weightGram` → `weightGram = null` → tidak ikut dihitung di total (sudah di-handle di `getTotals()`)
- `totalWeightGram = 0` → baris "Total Berat" tidak muncul di CartPanel (tidak ada visual clutter)
- Saat qty berubah (+/-) → tidak perlu perubahan tambahan, `getTotals()` sudah reactive via Zustand

---

## Out of Scope (dapat dibahas terpisah)

- Input `weightGram` di backoffice product form (backoffice UI belum ada, baru API)
- Kolom berat di halaman product list backoffice
