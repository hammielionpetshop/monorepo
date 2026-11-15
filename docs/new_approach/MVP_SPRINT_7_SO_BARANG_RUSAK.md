# 📘 MVP SPRINT 7 - STOCK OPNAME & BARANG RUSAK

**Sprint Duration**: 2 weeks (Week 13-14)  
**Sprint Goal**: SO Harian (POS) + SO Bulanan (Backoffice) + Barang Rusak write-off  
**Story Points**: 25 points  
**Team**: 2-3 developers

---

## 🎯 SPRINT OBJECTIVES

By end of Sprint 7, system harus bisa:
1. ✅ Stock Opname Harian (POS) - 20-30 item count
2. ✅ Stock Opname Bulanan (Backoffice) - semua SKU
3. ✅ Input Barang Rusak (POS) - auto write-off
4. ✅ Variance tracking (surplus/shrinkage)
5. ✅ Stock adjustment automatic

---

## 📋 USER STORIES

### **Story 7.1: Stock Opname Harian (POS)**

**As a** Kasir  
**I want to** hitung stock 20-30 item fast-moving setiap hari  
**So that** stock accuracy terjaga untuk produk penting

**Story Points**: 8

#### Acceptance Criteria
```
✅ SO Harian page accessible di `/pos/stock-opname`
✅ Create SO Harian:
   - Pilih 20-30 produk (fast-moving items)
   - Search & add product to SO list
   - Display: Product name, UOM, System Qty, Actual Qty (input), Variance

✅ Count process:
   - Kasir count stock fisik
   - Input actual qty per product
   - System calculate variance = actual_qty - system_qty
   - Show variance indicator:
     * Green (+): Surplus (actual > system)
     * Red (-): Shrinkage (actual < system)
     * Gray (0): Match (actual = system)

✅ Submit SO:
   - Validation: All selected products must have actual qty input
   - Create SO header record
   - Create SO detail records (per product)
   - Auto-adjust stock (direct adjust di MVP):
     * Update inventory_stock.qty_current = actual_qty
   - Record variance as shrinkage/surplus

✅ SO validation:
   - Cannot create SO if shift not open
   - Max 30 items per SO Harian
   - Min 1 item per SO

✅ SO history:
   - View list SO Harian untuk cabang ini
   - Filter by date
   - View SO detail & variance
```

#### Technical Tasks
- [ ] Create `/app/pos/stock-opname/page.tsx`
- [ ] Create SOHarianForm component
- [ ] Create ProductSelector for SO (search & add)
- [ ] Create CountingTable component (input actual qty)
- [ ] Create API endpoints:
  - `POST /api/pos/stock-opname` (submit SO)
  - `GET /api/pos/stock-opname/history` (view history)
- [ ] Implement stock adjustment logic
- [ ] Implement variance calculation
- [ ] Test SO process end-to-end

#### Component Example
```tsx
// app/pos/stock-opname/page.tsx
'use client'
import { useState } from 'react'

interface SOItem {
  product_id: number
  product_name: string
  sku: string
  uom_id: number
  uom_name: string
  system_qty: number
  actual_qty: number
  variance: number
}

export default function StockOpnameHarianPage() {
  const [soItems, setSoItems] = useState<SOItem[]>([])
  const [showProductSelector, setShowProductSelector] = useState(false)

  const addProduct = (product: any) => {
    // Check if already added
    if (soItems.find(item => 
      item.product_id === product.product_id && item.uom_id === product.uom_id
    )) {
      alert('Produk sudah ada di list')
      return
    }

    // Check max 30 items
    if (soItems.length >= 30) {
      alert('Maksimal 30 produk untuk SO Harian')
      return
    }

    const newItem: SOItem = {
      product_id: product.product_id,
      product_name: product.product_name,
      sku: product.sku,
      uom_id: product.uom_id,
      uom_name: product.uom_name,
      system_qty: product.current_stock || 0,
      actual_qty: 0,
      variance: 0
    }

    setSoItems([...soItems, newItem])
    setShowProductSelector(false)
  }

  const updateActualQty = (index: number, actualQty: number) => {
    const updated = [...soItems]
    updated[index].actual_qty = actualQty
    updated[index].variance = actualQty - updated[index].system_qty
    setSoItems(updated)
  }

  const removeProduct = (index: number) => {
    setSoItems(soItems.filter((_, i) => i !== index))
  }

  const handleSubmitSO = async () => {
    // Validation
    if (soItems.length === 0) {
      alert('Tambah minimal 1 produk')
      return
    }

    const notCounted = soItems.filter(item => item.actual_qty === 0)
    if (notCounted.length > 0) {
      if (!confirm(`${notCounted.length} produk belum di-count. Lanjut submit dengan qty 0?`)) {
        return
      }
    }

    if (!confirm(`Submit SO Harian untuk ${soItems.length} produk?`)) {
      return
    }

    try {
      const res = await fetch('/api/pos/stock-opname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'harian',
          items: soItems
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message)
      }

      alert('SO Harian berhasil disimpan & stock adjusted!')
      setSoItems([])
    } catch (error) {
      alert(error.message)
    }
  }

  const totalVariance = soItems.reduce((sum, item) => sum + item.variance, 0)
  const surplusCount = soItems.filter(item => item.variance > 0).length
  const shrinkageCount = soItems.filter(item => item.variance < 0).length

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Stock Opname Harian</h1>
          <button
            onClick={() => window.location.href = '/pos/stock-opname/history'}
            className="text-blue-600 hover:underline"
          >
            View History
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600 mb-1">Total Items</p>
            <p className="text-2xl font-bold">{soItems.length}/30</p>
          </div>

          <div className="bg-green-50 p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600 mb-1">Surplus</p>
            <p className="text-2xl font-bold text-green-600">{surplusCount}</p>
          </div>

          <div className="bg-red-50 p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600 mb-1">Shrinkage</p>
            <p className="text-2xl font-bold text-red-600">{shrinkageCount}</p>
          </div>

          <div className={`p-4 rounded-lg shadow ${
            totalVariance > 0 ? 'bg-green-50' : totalVariance < 0 ? 'bg-red-50' : 'bg-gray-50'
          }`}>
            <p className="text-sm text-gray-600 mb-1">Total Variance</p>
            <p className={`text-2xl font-bold ${
              totalVariance > 0 ? 'text-green-600' : totalVariance < 0 ? 'text-red-600' : 'text-gray-600'
            }`}>
              {totalVariance > 0 && '+'}{totalVariance}
            </p>
          </div>
        </div>

        {/* Add Product Button */}
        <div className="mb-4">
          <button
            onClick={() => setShowProductSelector(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            + Tambah Produk ke SO
          </button>
        </div>

        {/* Counting Table */}
        {soItems.length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left">No</th>
                  <th className="p-3 text-left">Product</th>
                  <th className="p-3 text-left">SKU</th>
                  <th className="p-3 text-left">UOM</th>
                  <th className="p-3 text-right">System Qty</th>
                  <th className="p-3 text-right">Actual Qty</th>
                  <th className="p-3 text-right">Variance</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {soItems.map((item, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="p-3">{idx + 1}</td>
                    <td className="p-3">{item.product_name}</td>
                    <td className="p-3 text-sm text-gray-600">{item.sku}</td>
                    <td className="p-3">{item.uom_name}</td>
                    <td className="p-3 text-right font-medium">{item.system_qty}</td>
                    <td className="p-3">
                      <input
                        type="number"
                        value={item.actual_qty || ''}
                        onChange={(e) => updateActualQty(idx, parseInt(e.target.value) || 0)}
                        className="w-24 text-right border p-2 rounded"
                        placeholder="0"
                        min="0"
                      />
                    </td>
                    <td className={`p-3 text-right font-bold ${
                      item.variance > 0 ? 'text-green-600' : item.variance < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {item.variance > 0 && '+'}{item.variance}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => removeProduct(idx)}
                        className="text-red-600 hover:text-red-800"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Submit Button */}
            <div className="p-4 border-t">
              <button
                onClick={handleSubmitSO}
                className="w-full bg-blue-600 text-white py-3 rounded-lg text-lg font-semibold hover:bg-blue-700"
              >
                Submit SO Harian ({soItems.length} items)
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-400 text-lg mb-2">Belum ada produk</p>
            <p className="text-gray-500 text-sm">Klik "Tambah Produk ke SO" untuk mulai counting</p>
          </div>
        )}

        {/* Product Selector Modal */}
        {showProductSelector && (
          <ProductSelectorModal
            onSelect={addProduct}
            onClose={() => setShowProductSelector(false)}
            excludeProducts={soItems.map(item => ({ product_id: item.product_id, uom_id: item.uom_id }))}
          />
        )}
      </div>
    </div>
  )
}
```

#### API Implementation
```typescript
// app/api/pos/stock-opname/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { type, items } = await req.json()
    
    // Validation
    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Minimal 1 produk harus di-count' },
        { status: 400 }
      )
    }

    if (type === 'harian' && items.length > 30) {
      return NextResponse.json(
        { error: 'Maksimal 30 produk untuk SO Harian' },
        { status: 400 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create SO header
      const soHeader = await tx.stock_opname_headers.create({
        data: {
          branch_id: 1, // Get from session
          so_type: type, // 'harian' or 'bulanan'
          so_date: new Date(),
          performed_by: 1, // Get from session
          total_items: items.length,
          total_variance: items.reduce((sum: number, item: any) => sum + item.variance, 0),
          status: 'completed'
        }
      })

      // Create SO details & adjust stock
      for (const item of items) {
        // Create SO detail
        await tx.stock_opname_details.create({
          data: {
            so_header_id: soHeader.so_header_id,
            product_id: item.product_id,
            uom_id: item.uom_id,
            system_qty: item.system_qty,
            actual_qty: item.actual_qty,
            variance: item.variance
          }
        })

        // Auto-adjust stock (direct adjust di MVP)
        await tx.inventory_stock.updateMany({
          where: {
            product_id: item.product_id,
            uom_id: item.uom_id,
            branch_id: 1 // Get from session
          },
          data: {
            qty_current: item.actual_qty
          }
        })

        // Log variance (optional, for reporting)
        if (item.variance !== 0) {
          await tx.stock_adjustments.create({
            data: {
              product_id: item.product_id,
              uom_id: item.uom_id,
              branch_id: 1,
              adjustment_type: item.variance > 0 ? 'surplus' : 'shrinkage',
              qty_adjustment: Math.abs(item.variance),
              reason: `SO ${type} - ${new Date().toLocaleDateString('id-ID')}`,
              performed_by: 1
            }
          })
        }
      }

      return soHeader
    })

    return NextResponse.json({ success: true, so_header_id: result.so_header_id })
  } catch (error) {
    console.error('SO Harian error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

#### PRD Reference
- **POS_PRD.md** Section 5.10 Stock Opname
- **BACKOFFICE_PRD_3_INVENTORY.md** Section 3.6.1 SO Harian

---

### **Story 7.2: Stock Opname Bulanan (Backoffice)**

**As a** Manager Backoffice  
**I want to** hitung semua SKU stock 1x per bulan  
**So that** stock accuracy comprehensive check

**Story Points**: 8

#### Acceptance Criteria
```
✅ SO Bulanan page accessible di `/backoffice/inventory/stock-opname`
✅ Create SO Bulanan:
   - Auto-load ALL products untuk cabang yang dipilih
   - Display: Product name, SKU, UOM, System Qty, Actual Qty (input), Variance
   - Pagination (50 items per page)

✅ Count process:
   - Staff count stock fisik semua SKU
   - Input actual qty per product
   - System calculate variance = actual_qty - system_qty
   - Show variance indicator (same as SO Harian)

✅ Save as draft:
   - Allow save progress (not completed yet)
   - Can resume later
   - Status: 'draft'

✅ Submit SO:
   - Validation: All products must have actual qty input
   - Create SO header record
   - Create SO detail records (per product)
   - Auto-adjust stock (direct adjust di MVP)
   - Status: 'completed'

✅ SO validation:
   - Cannot create new SO Bulanan jika ada yang masih draft
   - Recommended: 1x per bulan

✅ SO history:
   - View list SO Bulanan
   - Filter by month
   - View SO detail & variance report
```

#### Technical Tasks
- [ ] Create `/app/backoffice/inventory/stock-opname/page.tsx`
- [ ] Create SOBulananForm component (with pagination)
- [ ] Create API endpoints:
  - `POST /api/backoffice/stock-opname` (submit SO Bulanan)
  - `PUT /api/backoffice/stock-opname/:id/draft` (save draft)
  - `GET /api/backoffice/stock-opname/history` (view history)
- [ ] Implement save as draft functionality
- [ ] Test SO Bulanan end-to-end

#### Component Example (Simplified)
```tsx
// app/backoffice/inventory/stock-opname/page.tsx
export default function SOBulananPage() {
  const [branchId, setBranchId] = useState<number>(1)
  const [allProducts, setAllProducts] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50

  useEffect(() => {
    fetchAllProducts()
  }, [branchId])

  const fetchAllProducts = async () => {
    const res = await fetch(`/api/backoffice/inventory/products?branch_id=${branchId}`)
    const data = await res.json()
    setAllProducts(data)
  }

  const paginatedProducts = allProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const totalPages = Math.ceil(allProducts.length / itemsPerPage)

  // Similar structure to SO Harian, tapi untuk ALL products
  // dengan pagination & save draft feature

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Stock Opname Bulanan</h1>
      
      {/* Branch selector */}
      {/* Pagination controls */}
      {/* Counting table (similar to SO Harian) */}
      {/* Save Draft & Submit buttons */}
    </div>
  )
}
```

#### PRD Reference
- **BACKOFFICE_PRD_3_INVENTORY.md** Section 3.6.2 SO Bulanan

---

### **Story 7.3: Input Barang Rusak (POS)**

**As a** Kasir  
**I want to** input barang rusak  
**So that** stock berkurang & loss tercatat

**Story Points**: 5

#### Acceptance Criteria
```
✅ Barang Rusak page accessible di `/pos/damaged-goods`
✅ Input barang rusak form:
   - Select product (search)
   - Select UOM
   - Input qty rusak
   - Select reason (dropdown):
     * Expired
     * Damaged (rusak fisik)
     * Defect (cacat produk)
     * Other (input manual)
   - Notes (optional)

✅ Submit barang rusak:
   - Calculate loss = Qty × COGS (dari FIFO batch terlama)
   - Create damaged_goods record:
     * product_id
     * uom_id
     * branch_id
     * qty
     * reason
     * loss_amount (Qty × COGS)
     * notes
     * reported_by (kasir_id)
     * reported_at (timestamp)
   
   - Auto write-off stock:
     * Deduct qty dari inventory_stock
     * Deduct dari FIFO batch (same logic as sale)
     * No stock return (permanent loss)
   
   - Record as expense:
     * Add to daily_expenses (category: "Barang Rusak")
     * Amount = loss_amount

✅ Validation:
   - Qty must be > 0
   - Stock must be sufficient (cannot write-off more than available)
   - Reason required

✅ Barang Rusak history:
   - View list barang rusak per cabang
   - Filter by date, reason
   - Total loss amount per period
```

#### Technical Tasks
- [ ] Create `/app/pos/damaged-goods/page.tsx`
- [ ] Create DamagedGoodsForm component
- [ ] Implement FIFO deduction for damaged goods (reuse from Sprint 4)
- [ ] Create API endpoint:
  - `POST /api/pos/damaged-goods` (submit barang rusak)
  - `GET /api/pos/damaged-goods/history` (view history)
- [ ] Integrate dengan daily expenses
- [ ] Test barang rusak flow

#### Component Example
```tsx
// app/pos/damaged-goods/page.tsx
'use client'
import { useState } from 'react'

export default function DamagedGoodsPage() {
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [selectedUOM, setSelectedUOM] = useState<any>(null)
  const [qty, setQty] = useState(0)
  const [reason, setReason] = useState('Expired')
  const [notes, setNotes] = useState('')

  const reasons = ['Expired', 'Damaged', 'Defect', 'Other']

  const handleSubmit = async () => {
    if (!selectedProduct || !selectedUOM) {
      alert('Pilih produk & UOM dulu')
      return
    }

    if (qty <= 0) {
      alert('Qty harus > 0')
      return
    }

    if (!confirm(`Write-off ${qty} ${selectedUOM.uom_name} ${selectedProduct.product_name}?`)) {
      return
    }

    try {
      const res = await fetch('/api/pos/damaged-goods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: selectedProduct.product_id,
          uom_id: selectedUOM.id,
          qty,
          reason,
          notes
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message)
      }

      const data = await res.json()
      alert(`Barang rusak berhasil dicatat. Loss: ${formatCurrency(data.loss_amount)}`)
      
      // Reset form
      setSelectedProduct(null)
      setSelectedUOM(null)
      setQty(0)
      setNotes('')
    } catch (error) {
      alert(error.message)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Input Barang Rusak</h1>

        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <div className="space-y-4">
            {/* Product Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Product</label>
              <button
                onClick={() => {/* Show product selector */}}
                className="w-full border-2 border-dashed p-4 rounded-lg hover:border-blue-500 hover:bg-blue-50"
              >
                {selectedProduct ? (
                  <div>
                    <p className="font-medium">{selectedProduct.product_name}</p>
                    <p className="text-sm text-gray-600">{selectedProduct.sku}</p>
                  </div>
                ) : (
                  <p className="text-gray-400">+ Pilih Product</p>
                )}
              </button>
            </div>

            {/* UOM Selection (if product selected) */}
            {selectedProduct && (
              <div>
                <label className="block text-sm font-medium mb-2">UOM</label>
                <select
                  value={selectedUOM?.id || ''}
                  onChange={(e) => {
                    const uom = selectedProduct.uoms.find((u: any) => u.id === parseInt(e.target.value))
                    setSelectedUOM(uom)
                  }}
                  className="w-full border p-3 rounded-lg"
                >
                  <option value="">Pilih UOM</option>
                  {selectedProduct.uoms?.map((uom: any) => (
                    <option key={uom.id} value={uom.id}>
                      {uom.uom_name} (Stock: {uom.current_stock || 0})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Qty Input */}
            {selectedUOM && (
              <div>
                <label className="block text-sm font-medium mb-2">Qty Rusak</label>
                <input
                  type="number"
                  value={qty || ''}
                  onChange={(e) => setQty(parseInt(e.target.value) || 0)}
                  className="w-full text-2xl p-4 border-2 rounded-lg"
                  placeholder="0"
                  min="1"
                  max={selectedUOM.current_stock}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Max: {selectedUOM.current_stock} {selectedUOM.uom_name}
                </p>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium mb-2">Alasan</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full border p-3 rounded-lg"
              >
                {reasons.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-2">Catatan (Optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border p-3 rounded-lg"
                rows={3}
                placeholder="Catatan tambahan..."
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={!selectedProduct || !selectedUOM || qty <= 0}
            className="w-full mt-6 bg-red-600 text-white py-3 rounded-lg text-lg font-semibold hover:bg-red-700 disabled:bg-gray-300"
          >
            Write-off Barang Rusak
          </button>
        </div>

        {/* History Link */}
        <div className="text-center">
          <button
            onClick={() => window.location.href = '/pos/damaged-goods/history'}
            className="text-blue-600 hover:underline"
          >
            View Barang Rusak History
          </button>
        </div>
      </div>
    </div>
  )
}
```

#### API Implementation
```typescript
// app/api/pos/damaged-goods/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { calculateFIFOCOGS } from '@/lib/pos/fifo'

export async function POST(req: NextRequest) {
  try {
    const { product_id, uom_id, qty, reason, notes } = await req.json()

    // Validation
    if (qty <= 0) {
      return NextResponse.json(
        { error: 'Qty harus > 0' },
        { status: 400 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      const branchId = 1 // Get from session

      // Calculate FIFO COGS (reuse from Sprint 4)
      const fifoResult = await calculateFIFOCOGS(
        product_id,
        uom_id,
        branchId,
        qty,
        tx
      )

      const lossAmount = fifoResult.totalCOGS

      // Create damaged goods record
      const damagedGoods = await tx.damaged_goods.create({
        data: {
          product_id,
          uom_id,
          branch_id: branchId,
          qty,
          reason,
          notes,
          loss_amount: lossAmount,
          reported_by: 1, // Get from session
          reported_at: new Date()
        }
      })

      // Deduct stock (already done in calculateFIFOCOGS)
      await tx.inventory_stock.updateMany({
        where: {
          product_id,
          uom_id,
          branch_id: branchId
        },
        data: {
          qty_current: {
            decrement: qty
          }
        }
      })

      // Record as expense (optional, for daily expenses integration)
      await tx.daily_expenses.create({
        data: {
          shift_id: null, // Not tied to specific shift
          kasir_id: 1, // Get from session
          category: 'Barang Rusak',
          amount: lossAmount,
          notes: `Write-off: ${qty} ${reason}`,
          created_at: new Date()
        }
      })

      return {
        damaged_goods_id: damagedGoods.damaged_goods_id,
        loss_amount: lossAmount
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Damaged goods error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
```

#### PRD Reference
- **POS_PRD.md** Section 5.11.4 Damaged Goods
- **BACKOFFICE_PRD_3_INVENTORY.md** Section 3.5 Damaged Goods Tracking

---

### **Story 7.4: Variance Tracking & Reporting**

**As a** Manager Backoffice  
**I want to** view variance report (surplus/shrinkage)  
**So that** saya bisa monitor stock accuracy & losses

**Story Points**: 4

#### Acceptance Criteria
```
✅ Variance report page accessible di `/backoffice/reports/variance`
✅ Display variance summary:
   - Total Surplus (items & qty)
   - Total Shrinkage (items & qty)
   - Net Variance
   - Period: Daily, Weekly, Monthly

✅ Variance breakdown:
   - Per product: Product name, Total variance, Frequency
   - Per category: Category name, Total variance
   - Per reason (for barang rusak): Expired, Damaged, etc.

✅ Filters:
   - Date range
   - Branch
   - Product category

✅ Export (optional):
   - Download as Excel/CSV
```

#### Technical Tasks
- [ ] Create variance report page
- [ ] Aggregate variance data from SO & damaged goods
- [ ] Create charts (optional)
- [ ] Test variance reporting

#### PRD Reference
- **BACKOFFICE_PRD_3_INVENTORY.md** Section 3.6.3 Variance Analysis

---

## 📊 SPRINT 7 SUMMARY

### Story Points Breakdown
| Story | Points | Assignee Suggestion |
|-------|--------|---------------------|
| 7.1 SO Harian (POS) | 8 | Dev 1 + Dev 2 |
| 7.2 SO Bulanan (Backoffice) | 8 | Dev 2 |
| 7.3 Barang Rusak (POS) | 5 | Dev 1 |
| 7.4 Variance Reporting | 4 | Dev 1 |
| **TOTAL** | **25** | |

### Definition of Done
```
✅ SO Harian working (20-30 items, direct adjust)
✅ SO Bulanan working (all SKU, save draft, direct adjust)
✅ Barang rusak write-off working (FIFO COGS calculation)
✅ Variance tracking working
✅ Stock adjustment automatic
✅ Code reviewed & merged
✅ Manual testing completed
✅ No critical bugs
```

### Sprint Deliverables
1. ✅ SO Harian (POS) complete
2. ✅ SO Bulanan (Backoffice) complete
3. ✅ Barang rusak input & write-off working
4. ✅ Variance tracking & reporting

---

## 🧪 TESTING CHECKLIST

### Functional Testing
- [ ] SO Harian: Count 20 items → Submit → Stock adjusted
- [ ] SO Harian: Variance positive (+) → Surplus recorded
- [ ] SO Harian: Variance negative (-) → Shrinkage recorded
- [ ] SO Bulanan: Count all SKU → Save draft → Resume → Submit
- [ ] Barang rusak: Input 10 Pcs Expired → COGS calculated → Stock deducted
- [ ] Variance report: Show correct surplus/shrinkage totals

### Edge Cases
- [ ] SO with 0 variance → All match
- [ ] SO with all negative variance → All shrinkage
- [ ] Barang rusak qty > stock → Error
- [ ] Multiple SO Harian per day → Allowed
- [ ] Multiple SO Bulanan (draft) → Error (1 draft only)

---

## 🚨 RISKS & MITIGATIONS

| Risk | Impact | Mitigation |
|------|--------|------------|
| SO data entry error | MEDIUM | Clear UI, Confirmation before submit |
| Stock adjustment incorrect | HIGH | Validate calculation, Test thoroughly |
| Barang rusak FIFO error | MEDIUM | Reuse tested FIFO logic from Sprint 4 |
| Variance calculation error | MEDIUM | Unit tests, Cross-check with manual calculation |

---

## 📝 NOTES FOR NEXT SPRINT

**Sprint 8 Dependencies:**
- Barang rusak expense dari Sprint 7 → Sprint 8 akan include di laporan pengeluaran
- Variance data dari Sprint 7 → Sprint 8 reference untuk inventory reports
- Stock adjustment dari Sprint 7 → Sprint 8 validate stock accuracy

---

**Last Updated**: 18 April 2026  
**Sprint Status**: 🔴 Not Started  
**Previous Sprint**: MVP_SPRINT_6_SHIFT_SETTLEMENT.md  
**Next Sprint**: MVP_SPRINT_8_PO_LAPORAN_HUTANG.md
