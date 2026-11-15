# 📘 MVP SPRINT 4 - POS PENJUALAN + FIFO ⭐ CRITICAL

**Sprint Duration**: 2 weeks (Week 7-8)  
**Sprint Goal**: POS checkout complete dengan FIFO COGS calculation  
**Story Points**: 26 points  
**Team**: 2-3 developers (RECOMMENDED: 2 developers dedicated)

---

## 🎯 SPRINT OBJECTIVES

By end of Sprint 4, system harus bisa:
1. ✅ POS checkout UI working (scan barcode, select product)
2. ✅ Multi-UOM selection (5 UOM) per item
3. ✅ Multi-tier harga selection (4 tier) per item
4. ✅ Auto-break logic (Sak → Pcs jika Sak habis)
5. ✅ **FIFO COGS calculation** (ambil dari batch terlama)
6. ✅ Calculate subtotal & total
7. ✅ Stock validation (prevent negative stock)

---

## ⚠️ CRITICAL SPRINT WARNING

**This is THE MOST CRITICAL SPRINT in entire MVP!**

- FIFO logic = Core business requirement
- Complexity: HIGH
- Risk: HIGH (if FIFO fails, everything delays)
- Recommendation:
  - ✅ Allocate 2 developers minimum
  - ✅ Extra testing time (unit tests + integration tests)
  - ✅ Daily standup fokus ke FIFO progress
  - ✅ Owner/Finance review FIFO calculation result

**If Sprint 4 delays → Sprint 5, 6, 7, 8 ALL delay!**

---

## 📋 USER STORIES

### **Story 4.1: POS Checkout UI (Product Selection)**

**As a** Kasir  
**I want to** select produk untuk checkout  
**So that** saya bisa mulai transaksi penjualan

**Story Points**: 5

#### Acceptance Criteria
```
✅ POS checkout page accessible di `/pos/checkout`
✅ Product selection methods:
   1. Scan barcode (auto-add to cart)
   2. Search by product name (dropdown/autocomplete)
   3. Browse by category (grid view)

✅ Cart display (right side):
   - Product name
   - Selected UOM
   - Selected price tier
   - Qty
   - Subtotal (Qty × Price)
   - Action: Edit qty, Change UOM, Change tier, Remove item

✅ Cart operations:
   - Add item to cart
   - Update qty
   - Remove item from cart
   - Clear cart (remove all)

✅ Empty cart state:
   - Show message: "Cart kosong. Scan barcode atau pilih produk."

✅ Keyboard shortcuts:
   - F1: Focus to barcode input
   - F2: Search product
   - F3: Clear cart
   - Enter: Confirm item add
   - Esc: Cancel operation
```

#### Technical Tasks
- [ ] Create `/app/pos/checkout/page.tsx`
- [ ] Create CheckoutLayout component:
  - Left panel: Product selection
  - Right panel: Cart
- [ ] Create ProductSearch component (autocomplete)
- [ ] Create CategoryGrid component
- [ ] Create Cart component
- [ ] Create CartItem component
- [ ] Implement barcode scan handling
- [ ] Implement cart state management (useState or Context)
- [ ] Test product selection methods

#### Component Structure
```tsx
// app/pos/checkout/page.tsx
'use client'
import { useState, useEffect, useRef } from 'react'

interface CartItem {
  id: string // unique cart item ID
  product_id: number
  product_name: string
  sku: string
  uom_id: number
  uom_name: string
  conversion_to_pcs: number
  tier_name: string
  price: number
  qty: number
  subtotal: number
}

export default function POSCheckoutPage() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const barcodeInputRef = useRef<HTMLInputElement>(null)

  // Focus barcode input on load
  useEffect(() => {
    barcodeInputRef.current?.focus()
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault()
        barcodeInputRef.current?.focus()
      } else if (e.key === 'F3') {
        e.preventDefault()
        handleClearCart()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  const handleBarcodeScanned = async (barcode: string) => {
    if (!barcode.trim()) return

    try {
      // Find product by barcode
      const res = await fetch(`/api/pos/products/by-barcode?barcode=${barcode}`)
      
      if (!res.ok) {
        alert('Produk tidak ditemukan')
        return
      }

      const product = await res.json()
      
      // Show UOM & tier selection modal
      // (will implement in Story 4.2 & 4.3)
      
    } catch (error) {
      alert('Error scanning barcode')
    }

    // Clear barcode input
    if (barcodeInputRef.current) {
      barcodeInputRef.current.value = ''
    }
  }

  const handleAddToCart = (item: Omit<CartItem, 'id' | 'subtotal'>) => {
    const cartItem: CartItem = {
      ...item,
      id: `${item.product_id}-${item.uom_id}-${item.tier_name}-${Date.now()}`,
      subtotal: item.qty * item.price
    }

    setCart([...cart, cartItem])
  }

  const handleUpdateQty = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(itemId)
      return
    }

    setCart(cart.map(item => 
      item.id === itemId
        ? { ...item, qty: newQty, subtotal: newQty * item.price }
        : item
    ))
  }

  const handleRemoveItem = (itemId: string) => {
    setCart(cart.filter(item => item.id !== itemId))
  }

  const handleClearCart = () => {
    if (cart.length === 0) return
    if (!confirm('Yakin hapus semua item di cart?')) return
    setCart([])
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0)

  return (
    <div className="h-screen flex">
      {/* Left Panel - Product Selection */}
      <div className="flex-1 bg-gray-100 p-4 overflow-y-auto">
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Scan Barcode (F1)</label>
          <input
            ref={barcodeInputRef}
            type="text"
            placeholder="Scan barcode or enter manually..."
            className="w-full p-3 border rounded text-lg"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleBarcodeScanned(e.currentTarget.value)
              }
            }}
          />
        </div>

        <ProductSearch onSelect={(product) => {
          // Show UOM & tier selection
        }} />

        <CategoryGrid 
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        <ProductGrid 
          categoryId={selectedCategory}
          onSelectProduct={(product) => {
            // Show UOM & tier selection
          }}
        />
      </div>

      {/* Right Panel - Cart */}
      <div className="w-96 bg-white border-l p-4 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Cart</h2>
          {cart.length > 0 && (
            <button
              onClick={handleClearCart}
              className="text-red-600 text-sm hover:underline"
            >
              Clear All (F3)
            </button>
          )}
        </div>

        {cart.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <p className="text-lg mb-2">🛒</p>
              <p>Cart kosong</p>
              <p className="text-sm">Scan barcode atau pilih produk</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto mb-4 space-y-2">
              {cart.map(item => (
                <CartItemCard
                  key={item.id}
                  item={item}
                  onUpdateQty={(newQty) => handleUpdateQty(item.id, newQty)}
                  onRemove={() => handleRemoveItem(item.id)}
                />
              ))}
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg font-semibold">TOTAL:</span>
                <span className="text-2xl font-bold text-blue-600">
                  {formatCurrency(cartTotal)}
                </span>
              </div>

              <button className="w-full bg-blue-600 text-white py-4 rounded-lg text-lg font-semibold hover:bg-blue-700">
                Checkout ({cart.length} items)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

#### PRD Reference
- **POS_PRD.md** Section 5.1 Product Selection

---

### **Story 4.2: Multi-UOM Selection**

**As a** Kasir  
**I want to** pilih UOM saat add item ke cart  
**So that** customer bisa beli dalam satuan yang berbeda (Sak, Pcs, dll)

**Story Points**: 3

#### Acceptance Criteria
```
✅ Setelah select product, show UOM selection modal:
   - Display available UOMs untuk product ini (dari product_uoms)
   - Show conversion info:
     Example: "1 Sak = 30 Pcs"
   - Show price per UOM per tier (preview)

✅ Select UOM:
   - Click UOM button → Select & proceed to qty input
   - Default: Base UOM (Pcs)

✅ UOM validation:
   - Only show UOM yang ada di product_uoms
   - Only show UOM yang ada pricing-nya

✅ UOM change in cart:
   - Cart item bisa change UOM (show modal lagi)
   - Price auto-update sesuai UOM baru
```

#### Technical Tasks
- [ ] Create UOMSelectionModal component
- [ ] Fetch available UOMs untuk product
- [ ] Display conversion info
- [ ] Implement UOM selection
- [ ] Test UOM change in cart

#### Component Example
```tsx
// components/pos/UOMSelectionModal.tsx
export default function UOMSelectionModal({
  product,
  onSelect,
  onClose
}: {
  product: any
  onSelect: (uom: any) => void
  onClose: () => void
}) {
  const [uoms, setUoms] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUOMs()
  }, [product.product_id])

  const fetchUOMs = async () => {
    // Get UOMs dengan pricing
    const res = await fetch(`/api/pos/products/${product.product_id}/uoms-with-pricing`)
    const data = await res.json()
    setUoms(data)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full">
        <h2 className="text-xl font-bold mb-4">Pilih Satuan (UOM)</h2>
        <p className="text-gray-600 mb-4">{product.product_name}</p>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {uoms.map(uom => (
              <button
                key={uom.id}
                onClick={() => onSelect(uom)}
                className="border-2 border-gray-200 hover:border-blue-500 p-4 rounded-lg text-left transition"
              >
                <div className="text-lg font-bold mb-1">{uom.uom_name}</div>
                <div className="text-sm text-gray-600 mb-2">
                  {uom.is_base_uom 
                    ? '(Base unit)' 
                    : `1 ${uom.uom_name} = ${uom.conversion_to_pcs} Pcs`
                  }
                </div>
                <div className="text-xs text-gray-500">
                  Retail: {formatCurrency(uom.price_retail || 0)}
                </div>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full border py-2 rounded hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
```

#### PRD Reference
- **POS_PRD.md** Section 5.1.2 UOM Selection

---

### **Story 4.3: Multi-Tier Harga Selection**

**As a** Kasir  
**I want to** pilih tier harga saat add item  
**So that** harga sesuai dengan tipe customer (Retail/Grosir/Member/Owner Manual)

**Story Points**: 3

#### Acceptance Criteria
```
✅ Setelah select UOM, show tier selection modal:
   - Display 4 tier pricing untuk UOM yang dipilih:
     * Tier 1 - Retail: Rp X
     * Tier 2 - Grosir: Rp Y
     * Tier 3 - Member: Rp Z
     * Tier 4 - Owner Manual: (Input harga manual)

✅ Select tier:
   - Tier 1, 2, 3: Click → Auto-fill price → Proceed to qty input
   - Tier 4: Show input field → Owner input harga manual → Proceed

✅ Owner Manual Input (Tier 4):
   - Require owner/manager re-authentication (password/PIN)
   - Input custom price (must be > 0)
   - Save custom price to transaction (not update master)

✅ Tier change in cart:
   - Cart item bisa change tier
   - Price auto-update

✅ Default tier:
   - Auto-select Tier 1 (Retail) jika tidak ada input
```

#### Technical Tasks
- [ ] Create TierSelectionModal component
- [ ] Fetch pricing untuk UOM yang dipilih
- [ ] Implement tier selection (Tier 1-3)
- [ ] Implement Owner Manual input (Tier 4) dengan re-auth
- [ ] Test tier selection & change

#### Component Example
```tsx
// components/pos/TierSelectionModal.tsx
export default function TierSelectionModal({
  product,
  uom,
  onSelect,
  onClose
}: {
  product: any
  uom: any
  onSelect: (tier: string, price: number) => void
  onClose: () => void
}) {
  const [pricing, setPricing] = useState<any[]>([])
  const [showOwnerInput, setShowOwnerInput] = useState(false)
  const [ownerPrice, setOwnerPrice] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')

  useEffect(() => {
    fetchPricing()
  }, [product.product_id, uom.id])

  const fetchPricing = async () => {
    const res = await fetch(
      `/api/pos/products/${product.product_id}/pricing?uom_id=${uom.id}`
    )
    const data = await res.json()
    setPricing(data)
  }

  const handleTierSelect = (tier: any) => {
    if (tier.tier_name === 'Owner_Manual') {
      setShowOwnerInput(true)
    } else {
      onSelect(tier.tier_name, tier.price)
    }
  }

  const handleOwnerManualSubmit = async () => {
    // Validate owner password
    const authRes = await fetch('/api/auth/verify-owner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: ownerPassword })
    })

    if (!authRes.ok) {
      alert('Password salah')
      return
    }

    const price = parseFloat(ownerPrice)
    if (!price || price <= 0) {
      alert('Harga harus > 0')
      return
    }

    onSelect('Owner_Manual', price)
  }

  const getTierLabel = (tierName: string) => {
    const labels: any = {
      'Retail': 'Tier 1 - Retail',
      'Grosir': 'Tier 2 - Grosir',
      'Member': 'Tier 3 - Member',
      'Owner_Manual': 'Tier 4 - Owner Manual'
    }
    return labels[tierName] || tierName
  }

  if (showOwnerInput) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
          <h2 className="text-xl font-bold mb-4">Owner Manual Price</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Owner Password</label>
            <input
              type="password"
              value={ownerPassword}
              onChange={(e) => setOwnerPassword(e.target.value)}
              className="w-full border p-2 rounded"
              placeholder="Enter owner password"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Custom Price</label>
            <input
              type="number"
              value={ownerPrice}
              onChange={(e) => setOwnerPrice(e.target.value)}
              className="w-full border p-2 rounded text-lg"
              placeholder="Rp 0"
              min="0"
              step="100"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowOwnerInput(false)}
              className="flex-1 border py-2 rounded"
            >
              Back
            </button>
            <button
              onClick={handleOwnerManualSubmit}
              className="flex-1 bg-blue-600 text-white py-2 rounded"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Pilih Tier Harga</h2>
        <p className="text-gray-600 mb-1">{product.product_name}</p>
        <p className="text-sm text-gray-500 mb-4">UOM: {uom.uom_name}</p>

        <div className="space-y-3">
          {pricing.map(tier => (
            <button
              key={tier.tier_name}
              onClick={() => handleTierSelect(tier)}
              className="w-full border-2 border-gray-200 hover:border-blue-500 p-4 rounded-lg text-left transition"
            >
              <div className="flex justify-between items-center">
                <span className="font-medium">{getTierLabel(tier.tier_name)}</span>
                <span className="text-lg font-bold text-blue-600">
                  {tier.tier_name === 'Owner_Manual' 
                    ? '(Input Manual)' 
                    : formatCurrency(tier.price)
                  }
                </span>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full border py-2 rounded hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
```

#### PRD Reference
- **POS_PRD.md** Section 5.2 Price Selection
- **BACKOFFICE_PRD_2_PRODUCTS.md** Section 3.2.4 Owner Manual Price

---

### **Story 4.4: Auto-Break Logic (Sak → Pcs)**

**As a** System  
**I want to** auto-break UOM besar ke UOM kecil jika stock habis  
**So that** penjualan tetap bisa jalan meski stock UOM besar habis

**Story Points**: 5

#### Acceptance Criteria
```
✅ Auto-break scenario:
   Customer beli: 1 Sak (= 30 Pcs)
   Stock Sak: 0 Sak (habis)
   Stock Pcs: 100 Pcs (tersedia)
   
   System:
   1. Detect stock Sak habis
   2. Auto-calculate: 1 Sak = 30 Pcs
   3. Check stock Pcs >= 30?
   4. IF yes → Deduct 30 Pcs dari stock
   5. IF no → Error: "Stock tidak cukup"

✅ FIFO batch auto-break:
   - Saat deduct 30 Pcs, ambil dari batch Pcs terlama
   - Create child batch record (link parent_batch_id ke Sak batch origin)
   - COGS from Pcs batch (bukan dari Sak batch)

✅ Stock validation:
   - Check total stock (Sak + Pcs in Pcs equivalent)
   - Prevent negative stock
   - Show error jika stock tidak cukup

✅ Display to kasir:
   - Show warning: "Stock Sak habis, auto-deduct dari Pcs"
   - Allow proceed or cancel

✅ Transaction record:
   - Transaction item tetap record sebagai "1 Sak" (bukan 30 Pcs)
   - Internal: Stock deducted dari Pcs
```

#### Technical Tasks
- [ ] Implement auto-break logic function
- [ ] Calculate total stock in base UOM (Pcs)
- [ ] Check stock availability before checkout
- [ ] Implement FIFO batch deduction untuk auto-break
- [ ] Show warning modal to kasir
- [ ] Test auto-break scenarios:
  - Sak habis, Pcs cukup → Success
  - Sak habis, Pcs tidak cukup → Error
  - Multiple UOM levels (Dus → Box → Pack → Pcs)
- [ ] Unit tests untuk auto-break logic

#### Auto-Break Logic
```typescript
// lib/pos/auto-break.ts
interface StockCheck {
  canFulfill: boolean
  breakdown: {
    uom: string
    qtyNeeded: number
    qtyAvailable: number
    willAutoBreak: boolean
    breakFrom?: string
  }[]
  totalPcsNeeded: number
  totalPcsAvailable: number
}

export async function checkStockWithAutoBreak(
  productId: number,
  uomId: number,
  qtyNeeded: number,
  branchId: number
): Promise<StockCheck> {
  // Get product UOM info
  const productUom = await prisma.product_uoms.findUnique({
    where: { id: uomId },
    include: { product: true }
  })

  if (!productUom) {
    throw new Error('UOM not found')
  }

  const pcsNeeded = qtyNeeded * productUom.conversion_to_pcs

  // Get stock untuk UOM yang diminta
  const directStock = await prisma.inventory_stock.findFirst({
    where: {
      product_id: productId,
      uom_id: uomId,
      branch_id: branchId
    }
  })

  const breakdown: any[] = []

  // Check direct stock
  if (directStock && directStock.qty_current >= qtyNeeded) {
    // Stock cukup, no auto-break needed
    return {
      canFulfill: true,
      breakdown: [{
        uom: productUom.uom_name,
        qtyNeeded,
        qtyAvailable: directStock.qty_current,
        willAutoBreak: false
      }],
      totalPcsNeeded: pcsNeeded,
      totalPcsAvailable: directStock.qty_current * productUom.conversion_to_pcs
    }
  }

  // Direct stock tidak cukup, check base UOM (Pcs)
  const pcsStock = await prisma.inventory_stock.findFirst({
    where: {
      product_id: productId,
      branch_id: branchId,
      product_uom: {
        is_base_uom: true
      }
    },
    include: {
      product_uom: true
    }
  })

  if (!pcsStock) {
    return {
      canFulfill: false,
      breakdown: [{
        uom: productUom.uom_name,
        qtyNeeded,
        qtyAvailable: directStock?.qty_current || 0,
        willAutoBreak: false
      }],
      totalPcsNeeded: pcsNeeded,
      totalPcsAvailable: 0
    }
  }

  const pcsAvailable = pcsStock.qty_current

  if (pcsAvailable >= pcsNeeded) {
    // Bisa fulfill dengan auto-break dari Pcs
    return {
      canFulfill: true,
      breakdown: [
        {
          uom: productUom.uom_name,
          qtyNeeded,
          qtyAvailable: directStock?.qty_current || 0,
          willAutoBreak: true,
          breakFrom: 'Pcs'
        },
        {
          uom: 'Pcs',
          qtyNeeded: pcsNeeded,
          qtyAvailable: pcsAvailable,
          willAutoBreak: false
        }
      ],
      totalPcsNeeded: pcsNeeded,
      totalPcsAvailable: pcsAvailable
    }
  }

  // Not enough stock even with auto-break
  return {
    canFulfill: false,
    breakdown: [
      {
        uom: productUom.uom_name,
        qtyNeeded,
        qtyAvailable: directStock?.qty_current || 0,
        willAutoBreak: false
      },
      {
        uom: 'Pcs',
        qtyNeeded: pcsNeeded,
        qtyAvailable: pcsAvailable,
        willAutoBreak: false
      }
    ],
    totalPcsNeeded: pcsNeeded,
    totalPcsAvailable: pcsAvailable
  }
}
```

#### PRD Reference
- **POS_PRD.md** Section 5.1.3 Auto-Break Logic
- **BACKOFFICE_PRD_3_INVENTORY.md** Section 3.2.3 Auto-Break Batch

---

### **Story 4.5: FIFO COGS Calculation ⭐ MOST CRITICAL**

**As a** System  
**I want to** calculate COGS menggunakan FIFO method  
**So that** cost of goods sold akurat sesuai batch yang dipakai

**Story Points**: 8

#### Acceptance Criteria
```
✅ FIFO logic implementation:
   Saat checkout item:
   1. Get all active batches untuk product + UOM + branch
   2. Sort batches by received_date ASC (terlama dulu)
   3. Deduct qty dari batch terlama:
      - IF batch qty_balance >= qty needed:
        → Deduct dari batch ini saja
        → COGS = qty × cogs_per_unit dari batch ini
      
      - IF batch qty_balance < qty needed:
        → Deduct semua qty_balance dari batch ini
        → COGS partial = qty_balance × cogs_per_unit
        → Lanjut ke batch berikutnya (next oldest)
        → Repeat until qty needed fulfilled
   
   4. Calculate total COGS = SUM(qty_from_batch × cogs_per_unit_batch)
   5. Update batch qty_balance (reduce)
   6. IF batch qty_balance = 0 → status = 'depleted'

✅ Example calculation:
   Customer beli: 100 Pcs
   
   Batches available (sorted by received_date):
   - Batch A (1 Mar): 80 Pcs @ Rp 3.000, qty_balance: 80
   - Batch B (15 Mar): 200 Pcs @ Rp 3.200, qty_balance: 200
   
   Calculation:
   1. Take 80 Pcs from Batch A
      COGS = 80 × 3.000 = Rp 240.000
      Batch A: qty_balance = 0 (depleted)
   
   2. Take 20 Pcs from Batch B (remaining needed)
      COGS = 20 × 3.200 = Rp 64.000
      Batch B: qty_balance = 180
   
   Total COGS = 240.000 + 64.000 = Rp 304.000
   Avg COGS per unit = 304.000 / 100 = Rp 3.040

✅ Edge cases handled:
   - No batch available → Error: "Stock not available"
   - Batch qty_balance < needed → Use multiple batches
   - Batch depleted mid-transaction → Auto-update status
   - Concurrent transactions → Use database transactions (lock)

✅ Performance:
   - FIFO calculation should complete < 500ms untuk 10 cart items
   - Use database transaction untuk atomic operation

✅ Audit trail:
   - Record which batches used untuk each transaction item
   - Store in transaction_batch_usage table (optional)
```

#### Technical Tasks
- [ ] Implement FIFO deduction function
- [ ] Implement batch qty_balance update
- [ ] Implement batch status update (depleted)
- [ ] Use database transaction untuk atomic operation
- [ ] Create transaction_batch_usage table (optional, for audit)
- [ ] Unit tests untuk FIFO scenarios:
  - Single batch sufficient
  - Multiple batches needed
  - Batch depleted mid-sale
  - Concurrent sales (race condition)
- [ ] Integration tests dengan real data
- [ ] Performance testing (10 items checkout < 500ms)

#### FIFO Implementation
```typescript
// lib/pos/fifo.ts
interface FIFOResult {
  totalCOGS: number
  avgCOGSPerUnit: number
  batchesUsed: {
    batch_id: number
    batch_number: string
    qty_taken: number
    cogs_per_unit: number
    cogs_total: number
  }[]
}

export async function calculateFIFOCOGS(
  productId: number,
  uomId: number,
  branchId: number,
  qtyNeeded: number,
  prismaClient: any // Use transaction client
): Promise<FIFOResult> {
  // Get active batches, sorted by FIFO (received_date ASC)
  const batches = await prismaClient.inventory_batches.findMany({
    where: {
      product_id: productId,
      uom_id: uomId,
      branch_id: branchId,
      status: 'active',
      qty_balance: { gt: 0 }
    },
    orderBy: {
      received_date: 'asc' // FIFO: oldest first
    }
  })

  if (batches.length === 0) {
    throw new Error('No batch available for this product')
  }

  let remainingQty = qtyNeeded
  let totalCOGS = 0
  const batchesUsed: any[] = []

  for (const batch of batches) {
    if (remainingQty <= 0) break

    const qtyToTake = Math.min(batch.qty_balance, remainingQty)
    const cogsForThisBatch = qtyToTake * batch.cogs_per_unit

    totalCOGS += cogsForThisBatch
    remainingQty -= qtyToTake

    batchesUsed.push({
      batch_id: batch.batch_id,
      batch_number: batch.batch_number,
      qty_taken: qtyToTake,
      cogs_per_unit: batch.cogs_per_unit,
      cogs_total: cogsForThisBatch
    })

    // Update batch qty_balance
    const newBalance = batch.qty_balance - qtyToTake
    await prismaClient.inventory_batches.update({
      where: { batch_id: batch.batch_id },
      data: {
        qty_balance: newBalance,
        status: newBalance === 0 ? 'depleted' : 'active'
      }
    })
  }

  if (remainingQty > 0) {
    throw new Error(`Insufficient stock. Short by ${remainingQty} units.`)
  }

  return {
    totalCOGS,
    avgCOGSPerUnit: totalCOGS / qtyNeeded,
    batchesUsed
  }
}
```

#### Checkout Flow dengan FIFO
```typescript
// app/api/pos/checkout/route.ts
export async function POST(req: NextRequest) {
  const { cart, branchId, kasirId } = await req.json()

  try {
    // Use Prisma transaction untuk atomic operation
    const result = await prisma.$transaction(async (tx) => {
      let totalCOGS = 0
      const transactionItems: any[] = []

      // Process each cart item
      for (const item of cart) {
        // Check stock dengan auto-break
        const stockCheck = await checkStockWithAutoBreak(
          item.product_id,
          item.uom_id,
          item.qty,
          branchId
        )

        if (!stockCheck.canFulfill) {
          throw new Error(`Stock not sufficient for ${item.product_name}`)
        }

        // Calculate FIFO COGS
        let fifoResult: FIFOResult

        if (stockCheck.breakdown[0].willAutoBreak) {
          // Auto-break: Deduct dari base UOM (Pcs)
          const pcsUOM = await tx.product_uoms.findFirst({
            where: {
              product_id: item.product_id,
              is_base_uom: true
            }
          })

          const pcsNeeded = item.qty * item.conversion_to_pcs

          fifoResult = await calculateFIFOCOGS(
            item.product_id,
            pcsUOM!.id,
            branchId,
            pcsNeeded,
            tx
          )

          // Update Pcs stock
          await tx.inventory_stock.update({
            where: {
              product_id_uom_id_branch_id: {
                product_id: item.product_id,
                uom_id: pcsUOM!.id,
                branch_id: branchId
              }
            },
            data: {
              qty_current: { decrement: pcsNeeded }
            }
          })
        } else {
          // Normal: Deduct dari UOM yang dipilih
          fifoResult = await calculateFIFOCOGS(
            item.product_id,
            item.uom_id,
            branchId,
            item.qty,
            tx
          )

          // Update stock
          await tx.inventory_stock.update({
            where: {
              product_id_uom_id_branch_id: {
                product_id: item.product_id,
                uom_id: item.uom_id,
                branch_id: branchId
              }
            },
            data: {
              qty_current: { decrement: item.qty }
            }
          })
        }

        totalCOGS += fifoResult.totalCOGS

        transactionItems.push({
          product_id: item.product_id,
          uom_id: item.uom_id,
          tier_name: item.tier_name,
          qty: item.qty,
          price: item.price,
          subtotal: item.subtotal,
          cogs_total: fifoResult.totalCOGS,
          batches_used: JSON.stringify(fifoResult.batchesUsed)
        })
      }

      // Create transaction (will do in Sprint 5)
      // For now, return FIFO calculation result
      
      return {
        success: true,
        totalCOGS,
        items: transactionItems
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    )
  }
}
```

#### PRD Reference
- **POS_PRD.md** Section 5.3 FIFO COGS Calculation
- **BACKOFFICE_PRD_3_INVENTORY.md** Section 3.2 FIFO Batch Tracking

---

### **Story 4.6: Calculate Total & Stock Validation**

**As a** Kasir  
**I want to** see total harga & validasi stock sebelum checkout  
**So that** saya tahu total yang harus dibayar & stock tersedia

**Story Points**: 2

#### Acceptance Criteria
```
✅ Cart total calculation:
   - Subtotal per item (Qty × Price)
   - Grand Total (SUM subtotal all items)
   - Display real-time update

✅ Stock validation before checkout:
   - Check semua items di cart
   - Validate stock available (dengan auto-break check)
   - Show error jika ada item stock tidak cukup
   - Block checkout button jika validation failed

✅ Display:
   - Total items count
   - Grand total (Rp)
   - Checkout button enabled/disabled based on validation
```

#### Technical Tasks
- [ ] Implement cart total calculation
- [ ] Implement stock validation before checkout
- [ ] Show validation errors
- [ ] Enable/disable checkout button
- [ ] Test edge cases (stock habis mid-session)

#### PRD Reference
- **POS_PRD.md** Section 5.4 Calculate Total

---

## 📊 SPRINT 4 SUMMARY

### Story Points Breakdown
| Story | Points | Assignee Suggestion |
|-------|--------|---------------------|
| 4.1 POS Checkout UI | 5 | Dev 1 |
| 4.2 Multi-UOM Selection | 3 | Dev 1 |
| 4.3 Multi-Tier Harga | 3 | Dev 1 |
| 4.4 Auto-Break Logic | 5 | Dev 2 |
| 4.5 **FIFO COGS** ⭐ | 8 | Dev 2 (+ Dev 1 support) |
| 4.6 Calculate Total | 2 | Dev 1 |
| **TOTAL** | **26** | |

### Definition of Done
```
✅ POS checkout UI working
✅ Multi-UOM & Multi-tier selection working
✅ Auto-break logic working (tested)
✅ **FIFO COGS calculation working** ⭐
✅ Stock validation working
✅ Unit tests written (especially FIFO)
✅ Integration tests passed
✅ Performance test passed (< 500ms checkout)
✅ Owner/Finance reviewed FIFO calculation
✅ Code reviewed & merged
✅ No critical bugs
```

### Sprint Deliverables
1. ✅ POS checkout UI complete
2. ✅ Product selection (barcode, search, browse)
3. ✅ Cart management (add, update, remove)
4. ✅ Multi-UOM selection working
5. ✅ Multi-tier pricing working
6. ✅ Auto-break logic implemented
7. ✅ **FIFO COGS calculation implemented** ⭐

---

## 🧪 TESTING CHECKLIST

### FIFO Unit Tests (CRITICAL)
```typescript
// __tests__/fifo.test.ts
describe('FIFO COGS Calculation', () => {
  test('Single batch sufficient', async () => {
    // Setup: 1 batch dengan 100 Pcs @ Rp 3.000
    // Test: Jual 50 Pcs
    // Expected: COGS = 50 × 3.000 = Rp 150.000
    // Batch qty_balance = 50
  })

  test('Multiple batches needed', async () => {
    // Setup: 
    // Batch A: 80 Pcs @ Rp 3.000 (1 Mar)
    // Batch B: 200 Pcs @ Rp 3.200 (15 Mar)
    // Test: Jual 100 Pcs
    // Expected:
    // - Take 80 from Batch A (COGS = 240k)
    // - Take 20 from Batch B (COGS = 64k)
    // - Total COGS = 304k
    // - Batch A depleted
    // - Batch B qty_balance = 180
  })

  test('Batch depleted exactly', async () => {
    // Setup: Batch A: 100 Pcs @ Rp 3.000
    // Test: Jual 100 Pcs
    // Expected: 
    // - COGS = 300k
    // - Batch A status = 'depleted'
    // - Batch A qty_balance = 0
  })

  test('Insufficient stock error', async () => {
    // Setup: Batch A: 50 Pcs @ Rp 3.000
    // Test: Jual 100 Pcs
    // Expected: Error "Insufficient stock. Short by 50 units."
  })

  test('Auto-break FIFO', async () => {
    // Setup:
    // Sak stock: 0
    // Pcs stock: Batch A: 50 Pcs @ Rp 3.000
    // Test: Jual 1 Sak (= 30 Pcs)
    // Expected:
    // - Auto-break from Pcs
    // - Take 30 Pcs from Batch A
    // - COGS = 30 × 3.000 = 90k
    // - Batch A qty_balance = 20
  })
})
```

### Integration Tests
- [ ] Full checkout flow: Scan → Select UOM → Select Tier → Add to cart → Checkout
- [ ] Auto-break scenario end-to-end
- [ ] Multiple items dengan different UOM
- [ ] Concurrent checkout (2 kasir checkout same item simultaneously)

### Performance Tests
- [ ] 10 items checkout < 500ms
- [ ] 50 items checkout < 2s
- [ ] FIFO calculation untuk 100 batches < 1s

---

## 🚨 RISKS & MITIGATIONS

| Risk | Impact | Mitigation |
|------|--------|------------|
| **FIFO logic bugs** | CRITICAL | Extensive unit tests, Owner review, Dry-run before launch |
| **Auto-break logic errors** | HIGH | Test all UOM combinations, Edge case testing |
| **Race condition (concurrent sales)** | HIGH | Use database transactions, Row-level locking |
| **Performance degradation** | MEDIUM | Database indexes, Query optimization, Performance testing |
| **Stock negative (validation bypass)** | HIGH | Double-check validation, Server-side enforcement |

---

## 📝 NOTES FOR NEXT SPRINT

**Sprint 5 Dependencies:**
- Cart dari Sprint 4 → Sprint 5 will add Payment
- FIFO COGS dari Sprint 4 → Sprint 5 record to transaction table
- Stock deduction dari Sprint 4 → Sprint 5 finalize transaction

**If Sprint 4 FIFO fails:**
- ❌ Sprint 5 cannot complete (no COGS to record)
- ❌ Sprint 6 settlement broken (no accurate COGS)
- ❌ Sprint 8 laporan keuangan broken (no accurate Laba Rugi)

**Owner/Finance MUST review Sprint 4 FIFO result before Sprint 5!**

---

**Last Updated**: 18 April 2026  
**Sprint Status**: 🔴 Not Started  
**Previous Sprint**: MVP_SPRINT_3_MULTI_HARGA_INVENTORY.md  
**Next Sprint**: MVP_SPRINT_5_PAYMENT_RECEIPT.md
