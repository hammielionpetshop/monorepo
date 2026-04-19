# 📘 MVP SPRINT 3 - MULTI-HARGA & INVENTORY SETUP

**Sprint Duration**: 2 weeks (Week 5-6)  
**Sprint Goal**: Multi-tier pricing (4 tier) + Inventory monitoring + FIFO batch structure ready  
**Story Points**: 26 points  
**Team**: 2-3 developers

---

## 🎯 SPRINT OBJECTIVES

By end of Sprint 3, system harus bisa:
1. ✅ Setup multi-harga 4 tier per UOM per produk (Retail, Grosir, Member, Owner Manual)
2. ✅ View inventory stock per cabang (monitoring)
3. ✅ FIFO batch structure ready (table + initial logic, belum full implementation)
4. ✅ Stock minimum setting per produk
5. ✅ Dashboard KPI basic (4 cards)

---

## 📋 USER STORIES

### **Story 3.1: Multi-Harga 4 Tier per UOM**

**As a** Manager Backoffice  
**I want to** setup harga untuk setiap UOM dengan 4 tier pricing  
**So that** POS bisa jual dengan harga berbeda sesuai tier customer

**Story Points**: 8

#### Acceptance Criteria
```
✅ Product detail page include Pricing section
✅ Display pricing table per UOM:
   Columns: UOM | Tier 1 (Retail) | Tier 2 (Grosir) | Tier 3 (Member) | Tier 4 (Owner Manual) | Action

✅ Setup pricing per UOM:
   - Select UOM yang sudah ada di product
   - Input harga untuk 3 tier (Retail, Grosir, Member)
   - Tier 4 (Owner Manual) kosong (akan di-input di POS saat transaksi)
   - Example untuk "Pakan Meow":
     UOM Sak:
       - Retail: Rp 100.000
       - Grosir: Rp 95.000
       - Member: Rp 90.000
       - Owner Manual: (empty)
     
     UOM Pcs:
       - Retail: Rp 3.500
       - Grosir: Rp 3.300
       - Member: Rp 3.000
       - Owner Manual: (empty)

✅ Harga TIDAK harus proporsional:
   - Tier 2 tidak harus X% dari Tier 1
   - Bisa set harga manual sesuai strategi bisnis
   - Contoh valid:
     * Retail Sak: Rp 100.000 (Rp 3.333/Pcs equivalent)
     * Retail Pcs: Rp 3.500 (lebih mahal per unit, encourage bulk)

✅ Edit pricing:
   - Update harga per tier
   - Warning jika harga tier lebih mahal > tier lebih murah
     (Grosir > Retail → unusual, show warning tapi allow)

✅ Delete pricing:
   - Remove harga untuk UOM tertentu
   - Confirmation required

✅ Validation:
   - Harga must be positive number
   - Tier 1, 2, 3 required (cannot be empty)
   - Tier 4 always empty (will be input di POS)
   - Same price untuk all branches (di MVP)

✅ Bulk pricing setup (optional, nice to have):
   - Set default margin per tier
   - Example: Tier 2 = Tier 1 - 5%, Tier 3 = Tier 1 - 10%
   - Auto-calculate based on Tier 1 (Retail)
   - User can override per UOM
```

#### Technical Tasks
- [ ] Create ProductPricingTable component
- [ ] Create PricingForm component
- [ ] Create API endpoints:
  - `GET /api/products/:id/pricing` (get all pricing for product)
  - `POST /api/products/:id/pricing` (create pricing for UOM)
  - `PUT /api/products/:id/pricing/:pricing_id` (update)
  - `DELETE /api/products/:id/pricing/:pricing_id` (delete)
- [ ] Implement validation
- [ ] Add warning for unusual pricing (Grosir > Retail)
- [ ] (Optional) Implement bulk pricing with auto-calculation
- [ ] Test pricing operations
- [ ] Test edge cases (harga 0, harga negatif, dll)

#### Component Example
```tsx
// components/backoffice/ProductPricingTable.tsx
export default function ProductPricingTable({ 
  productId, 
  uoms 
}: { 
  productId: number
  uoms: any[]
}) {
  const [pricing, setPricing] = useState([])
  const [editingUOM, setEditingUOM] = useState(null)

  useEffect(() => {
    fetchPricing()
  }, [productId])

  const fetchPricing = async () => {
    const res = await fetch(`/api/products/${productId}/pricing`)
    const data = await res.json()
    setPricing(data)
  }

  const getPricingForUOM = (uomId: number) => {
    return pricing.filter(p => p.uom_id === uomId)
  }

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Multi-Tier Pricing</h3>
        <button
          onClick={() => setEditingUOM({ mode: 'create' })}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm"
        >
          + Setup Pricing
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full bg-white border">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">UOM</th>
              <th className="p-3 text-right">Tier 1 (Retail)</th>
              <th className="p-3 text-right">Tier 2 (Grosir)</th>
              <th className="p-3 text-right">Tier 3 (Member)</th>
              <th className="p-3 text-right">Tier 4 (Owner Manual)</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {uoms.map(uom => {
              const uomPricing = getPricingForUOM(uom.id)
              const retailPrice = uomPricing.find(p => p.tier_name === 'Retail')
              const grosirPrice = uomPricing.find(p => p.tier_name === 'Grosir')
              const memberPrice = uomPricing.find(p => p.tier_name === 'Member')

              return (
                <tr key={uom.id} className="border-t">
                  <td className="p-3 font-medium">{uom.uom_name}</td>
                  <td className="p-3 text-right">
                    {retailPrice ? formatCurrency(retailPrice.price) : '-'}
                  </td>
                  <td className="p-3 text-right">
                    {grosirPrice ? formatCurrency(grosirPrice.price) : '-'}
                  </td>
                  <td className="p-3 text-right">
                    {memberPrice ? formatCurrency(memberPrice.price) : '-'}
                  </td>
                  <td className="p-3 text-right text-gray-400">
                    (Input di POS)
                  </td>
                  <td className="p-3 text-right">
                    {retailPrice ? (
                      <>
                        <button 
                          onClick={() => setEditingUOM({ mode: 'edit', uom, pricing: uomPricing })}
                          className="text-blue-600 hover:underline mr-2"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDeletePricing(uom.id)}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setEditingUOM({ mode: 'create', uom })}
                        className="text-green-600 hover:underline"
                      >
                        + Add
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Warning untuk UOM tanpa pricing */}
      {uoms.some(uom => !getPricingForUOM(uom.id).length) && (
        <div className="mt-4 bg-yellow-50 border border-yellow-200 p-4 rounded">
          <p className="text-yellow-800 text-sm">
            ⚠️ Beberapa UOM belum ada pricing. Produk tidak bisa dijual di POS untuk UOM tersebut.
          </p>
        </div>
      )}

      {editingUOM && (
        <PricingFormModal
          productId={productId}
          uom={editingUOM.uom}
          existingPricing={editingUOM.pricing}
          mode={editingUOM.mode}
          onClose={() => setEditingUOM(null)}
          onSuccess={() => {
            fetchPricing()
            setEditingUOM(null)
          }}
        />
      )}
    </div>
  )
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount)
}
```

#### Pricing Form Component
```tsx
// components/backoffice/PricingFormModal.tsx
export default function PricingFormModal({
  productId,
  uom,
  existingPricing = [],
  mode, // 'create' or 'edit'
  onClose,
  onSuccess
}: {
  productId: number
  uom: any
  existingPricing?: any[]
  mode: 'create' | 'edit'
  onClose: () => void
  onSuccess: () => void
}) {
  const [prices, setPrices] = useState({
    retail: existingPricing.find(p => p.tier_name === 'Retail')?.price || '',
    grosir: existingPricing.find(p => p.tier_name === 'Grosir')?.price || '',
    member: existingPricing.find(p => p.tier_name === 'Member')?.price || ''
  })
  const [warnings, setWarnings] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  // Check pricing logic warnings
  useEffect(() => {
    const newWarnings: string[] = []
    
    if (prices.grosir && prices.retail && Number(prices.grosir) > Number(prices.retail)) {
      newWarnings.push('Harga Grosir lebih mahal dari Retail (unusual)')
    }
    
    if (prices.member && prices.grosir && Number(prices.member) > Number(prices.grosir)) {
      newWarnings.push('Harga Member lebih mahal dari Grosir (unusual)')
    }

    if (prices.member && prices.retail && Number(prices.member) > Number(prices.retail)) {
      newWarnings.push('Harga Member lebih mahal dari Retail (unusual)')
    }

    setWarnings(newWarnings)
  }, [prices])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Prepare data: 3 tier pricing (Retail, Grosir, Member)
      const pricingData = [
        { tier_name: 'Retail', price: Number(prices.retail) },
        { tier_name: 'Grosir', price: Number(prices.grosir) },
        { tier_name: 'Member', price: Number(prices.member) },
        { tier_name: 'Owner_Manual', price: null } // Always null untuk Tier 4
      ]

      const res = await fetch(`/api/products/${productId}/pricing`, {
        method: mode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uom_id: uom.id,
          pricing: pricingData
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message)
      }

      alert('Pricing berhasil disimpan')
      onSuccess()
    } catch (error) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleBulkCalculate = () => {
    // Auto-calculate Tier 2 & 3 based on Tier 1
    if (prices.retail) {
      const retail = Number(prices.retail)
      setPrices({
        ...prices,
        grosir: Math.round(retail * 0.95).toString(), // -5%
        member: Math.round(retail * 0.90).toString()  // -10%
      })
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">
          {mode === 'create' ? 'Setup' : 'Edit'} Pricing - {uom?.uom_name}
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Tier 1 - Retail <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={prices.retail}
                onChange={(e) => setPrices({ ...prices, retail: e.target.value })}
                required
                min="0"
                step="100"
                className="w-full border p-2 rounded"
                placeholder="Rp 100.000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Tier 2 - Grosir <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={prices.grosir}
                onChange={(e) => setPrices({ ...prices, grosir: e.target.value })}
                required
                min="0"
                step="100"
                className="w-full border p-2 rounded"
                placeholder="Rp 95.000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Tier 3 - Member <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={prices.member}
                onChange={(e) => setPrices({ ...prices, member: e.target.value })}
                required
                min="0"
                step="100"
                className="w-full border p-2 rounded"
                placeholder="Rp 90.000"
              />
            </div>

            <div className="bg-gray-50 p-3 rounded">
              <p className="text-sm text-gray-600 mb-2">
                Tier 4 - Owner Manual: (Akan di-input di POS saat transaksi)
              </p>
              <button
                type="button"
                onClick={handleBulkCalculate}
                className="text-sm text-blue-600 hover:underline"
              >
                💡 Auto-calculate Tier 2 (-5%) & Tier 3 (-10%)
              </button>
            </div>

            {/* Warnings */}
            {warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded">
                <p className="text-sm font-medium text-yellow-800 mb-1">⚠️ Warning:</p>
                <ul className="text-sm text-yellow-700 space-y-1">
                  {warnings.map((warning, i) => (
                    <li key={i}>• {warning}</li>
                  ))}
                </ul>
                <p className="text-xs text-yellow-600 mt-2">
                  (Masih bisa save, tapi cek kembali harga Anda)
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 py-2 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Saving...' : 'Save Pricing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

#### API Implementation
```typescript
// app/api/products/[id]/pricing/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// POST - Create pricing for UOM
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = parseInt(params.id)
    const { uom_id, pricing } = await req.json()

    // Validation
    for (const tier of pricing) {
      if (tier.tier_name !== 'Owner_Manual' && (!tier.price || tier.price <= 0)) {
        return NextResponse.json(
          { error: `Harga ${tier.tier_name} harus diisi dan > 0` },
          { status: 400 }
        )
      }
    }

    // Delete existing pricing untuk UOM ini (if any)
    await prisma.product_pricing.deleteMany({
      where: {
        product_id: productId,
        uom_id: uom_id
      }
    })

    // Create new pricing (4 tiers)
    const created = await prisma.product_pricing.createMany({
      data: pricing.map((tier: any) => ({
        product_id: productId,
        uom_id: uom_id,
        tier_name: tier.tier_name,
        price: tier.price
      }))
    })

    return NextResponse.json({ 
      success: true, 
      created: created.count 
    }, { status: 201 })
  } catch (error) {
    console.error('Create pricing error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - Get all pricing for product
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const productId = parseInt(params.id)

  const pricing = await prisma.product_pricing.findMany({
    where: { product_id: productId },
    include: {
      product_uom: true
    },
    orderBy: [
      { uom_id: 'asc' },
      { tier_name: 'asc' }
    ]
  })

  return NextResponse.json(pricing)
}
```

#### PRD Reference
- **BACKOFFICE_PRD_2_PRODUCTS.md** Section 3.2 Multi-Tier Pricing
- **POS_PRD.md** Section 5.2 Price Selection

---

### **Story 3.2: Inventory Monitoring UI**

**As a** Manager Backoffice  
**I want to** view stock per cabang  
**So that** saya tahu stock barang di setiap cabang

**Story Points**: 5

#### Acceptance Criteria
```
✅ Inventory page accessible di `/backoffice/inventory`
✅ Filter cabang:
   - Dropdown select cabang
   - "All Branches" option (konsolidasi)

✅ Display stock dalam table:
   - Product Name
   - SKU
   - Category
   - UOM (display per UOM yang ada stock)
   - Qty Current
   - Min Stock
   - Stock Value (Qty × Avg COGS)
   - Status (✅ OK / ⚠️ Low / 🔴 Out)

✅ Stock status logic:
   - OK: Current qty >= Min stock
   - Low: Current qty < Min stock (tapi > 0)
   - Out: Current qty = 0

✅ Search & Filter:
   - Search by product name, SKU
   - Filter by kategori
   - Filter by status (OK/Low/Out)

✅ Stock value calculation:
   - Stock Value = Qty × Average COGS (dari batches)
   - Display total stock value di bottom

✅ Action buttons:
   - View batch detail (lihat FIFO batches)
   - Set minimum stock
```

#### Technical Tasks
- [ ] Create inventory page `/app/backoffice/inventory/page.tsx`
- [ ] Create InventoryTable component
- [ ] Create API endpoint:
  - `GET /api/inventory?branch_id=X&category_id=Y&status=Z`
- [ ] Implement search & filter
- [ ] Calculate stock value (Qty × Avg COGS dari batches)
- [ ] Implement stock status logic
- [ ] Test dengan multiple branches

#### Component Example
```tsx
// app/backoffice/inventory/page.tsx
'use client'
import { useState, useEffect } from 'react'

export default function InventoryPage() {
  const [branchId, setBranchId] = useState<number | 'all'>('all')
  const [categoryId, setCategoryId] = useState<number | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)

  const [branches, setBranches] = useState([])
  const [categories, setCategories] = useState([])

  useEffect(() => {
    fetchBranches()
    fetchCategories()
  }, [])

  useEffect(() => {
    fetchInventory()
  }, [branchId, categoryId, statusFilter, searchQuery])

  const fetchInventory = async () => {
    setLoading(true)
    
    const params = new URLSearchParams()
    if (branchId !== 'all') params.append('branch_id', branchId.toString())
    if (categoryId !== 'all') params.append('category_id', categoryId.toString())
    if (statusFilter !== 'all') params.append('status', statusFilter)
    if (searchQuery) params.append('search', searchQuery)

    const res = await fetch(`/api/inventory?${params}`)
    const data = await res.json()
    setInventory(data)
    setLoading(false)
  }

  const getStatusBadge = (stock: any) => {
    if (stock.qty_current === 0) {
      return <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm">🔴 Out of Stock</span>
    }
    if (stock.qty_current < stock.min_stock) {
      return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">⚠️ Low Stock</span>
    }
    return <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">✅ OK</span>
  }

  const totalStockValue = inventory.reduce((sum, item) => sum + item.stock_value, 0)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Inventory Management</h1>

      {/* Filters */}
      <div className="bg-white p-4 rounded shadow mb-6">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-sm mb-1">Branch</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              className="w-full border p-2 rounded"
            >
              <option value="all">All Branches</option>
              {branches.map(b => (
                <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              className="w-full border p-2 rounded"
            >
              <option value="all">All Categories</option>
              {categories.map(c => (
                <option key={c.category_id} value={c.category_id}>{c.category_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border p-2 rounded"
            >
              <option value="all">All Status</option>
              <option value="ok">✅ OK</option>
              <option value="low">⚠️ Low Stock</option>
              <option value="out">🔴 Out of Stock</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Product name, SKU..."
              className="w-full border p-2 rounded"
            />
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full bg-white shadow rounded">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left">Product</th>
                  <th className="p-3 text-left">SKU</th>
                  <th className="p-3 text-left">Category</th>
                  <th className="p-3 text-left">UOM</th>
                  <th className="p-3 text-right">Qty</th>
                  <th className="p-3 text-right">Min Stock</th>
                  <th className="p-3 text-right">Stock Value</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((item, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="p-3">{item.product_name}</td>
                    <td className="p-3 text-sm text-gray-600">{item.sku}</td>
                    <td className="p-3">{item.category_name}</td>
                    <td className="p-3">{item.uom_name}</td>
                    <td className="p-3 text-right font-medium">{item.qty_current}</td>
                    <td className="p-3 text-right text-gray-600">{item.min_stock || '-'}</td>
                    <td className="p-3 text-right">{formatCurrency(item.stock_value)}</td>
                    <td className="p-3 text-center">{getStatusBadge(item)}</td>
                    <td className="p-3 text-right">
                      <button className="text-blue-600 hover:underline text-sm mr-2">
                        View Batches
                      </button>
                      <button className="text-green-600 hover:underline text-sm">
                        Set Min
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="mt-4 bg-blue-50 p-4 rounded">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total Stock Value:</span>
              <span className="text-xl font-bold text-blue-700">
                {formatCurrency(totalStockValue)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
```

#### API Implementation
```typescript
// app/api/inventory/route.ts
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get('branch_id')
  const categoryId = searchParams.get('category_id')
  const status = searchParams.get('status')
  const search = searchParams.get('search')

  // Build query
  const where: any = {}
  
  if (branchId) {
    where.branch_id = parseInt(branchId)
  }

  if (categoryId) {
    where.product = {
      category_id: parseInt(categoryId)
    }
  }

  if (search) {
    where.OR = [
      { product: { product_name: { contains: search, mode: 'insensitive' } } },
      { product: { sku: { contains: search, mode: 'insensitive' } } }
    ]
  }

  // Get inventory stock
  const inventory = await prisma.inventory_stock.findMany({
    where,
    include: {
      product: {
        include: {
          category: true
        }
      },
      product_uom: true,
      branch: true
    }
  })

  // Calculate stock value from batches
  const enrichedInventory = await Promise.all(
    inventory.map(async (item) => {
      // Get batches untuk calculate avg COGS
      const batches = await prisma.inventory_batches.findMany({
        where: {
          product_id: item.product_id,
          uom_id: item.uom_id,
          branch_id: item.branch_id,
          status: 'active',
          qty_balance: { gt: 0 }
        }
      })

      // Calculate weighted avg COGS
      let avgCOGS = 0
      if (batches.length > 0) {
        const totalQty = batches.reduce((sum, b) => sum + b.qty_balance, 0)
        const totalValue = batches.reduce((sum, b) => sum + (b.qty_balance * b.cogs_per_unit), 0)
        avgCOGS = totalValue / totalQty
      }

      const stockValue = item.qty_current * avgCOGS

      return {
        product_name: item.product.product_name,
        sku: item.product.sku,
        category_name: item.product.category.category_name,
        uom_name: item.product_uom.uom_name,
        qty_current: item.qty_current,
        min_stock: item.min_stock,
        stock_value: stockValue,
        avg_cogs: avgCOGS
      }
    })
  )

  // Filter by status if requested
  let filtered = enrichedInventory
  if (status === 'ok') {
    filtered = filtered.filter(i => i.qty_current >= i.min_stock)
  } else if (status === 'low') {
    filtered = filtered.filter(i => i.qty_current < i.min_stock && i.qty_current > 0)
  } else if (status === 'out') {
    filtered = filtered.filter(i => i.qty_current === 0)
  }

  return NextResponse.json(filtered)
}
```

#### PRD Reference
- **BACKOFFICE_PRD_3_INVENTORY.md** Section 3.1 Stock Monitoring

---

### **Story 3.3: FIFO Batch Structure Setup**

**As a** System  
**I want to** have FIFO batch structure ready  
**So that** Sprint 4 bisa implement FIFO COGS calculation

**Story Points**: 5

#### Acceptance Criteria
```
✅ Table `inventory_batches` already created (dari Sprint 1.2)
✅ Batch view component created (untuk view batches per product)
✅ Basic batch operations:
   - View batches untuk product tertentu
   - Sort by received_date ASC (FIFO order)
   - Display: Batch Number, Qty In, Qty Balance, COGS per Unit, Received Date, Status

✅ Batch structure validation:
   - Every batch linked to: product_id, uom_id, branch_id
   - COGS per unit stored
   - Parent batch tracking (untuk auto-break)

✅ Seed sample batches (for testing):
   - Create 5-10 sample products dengan batches
   - Different received dates
   - Different COGS per batch
   - Test FIFO ordering

⚠️ NOTE: Full FIFO logic (deduct dari batch terlama) akan di-implement di Sprint 4
Sprint 3 fokus structure & view only
```

#### Technical Tasks
- [ ] Create BatchList component
- [ ] Create API endpoint:
  - `GET /api/inventory/batches?product_id=X&uom_id=Y&branch_id=Z`
- [ ] Create seed script untuk sample batches
- [ ] Test batch view & sorting
- [ ] Validate batch data structure
- [ ] Document batch lifecycle untuk Sprint 4

#### Component Example
```tsx
// components/backoffice/BatchListModal.tsx
export default function BatchListModal({
  productId,
  uomId,
  branchId,
  onClose
}: {
  productId: number
  uomId: number
  branchId: number
  onClose: () => void
}) {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBatches()
  }, [])

  const fetchBatches = async () => {
    const params = new URLSearchParams({
      product_id: productId.toString(),
      uom_id: uomId.toString(),
      branch_id: branchId.toString()
    })

    const res = await fetch(`/api/inventory/batches?${params}`)
    const data = await res.json()
    setBatches(data)
    setLoading(false)
  }

  const totalQtyBalance = batches.reduce((sum, b) => sum + b.qty_balance, 0)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">FIFO Batches</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        {loading ? (
          <p>Loading batches...</p>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-4">
              Total Qty Available: <strong>{totalQtyBalance}</strong> units
            </p>

            <table className="w-full border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Batch #</th>
                  <th className="p-2 text-right">Qty In</th>
                  <th className="p-2 text-right">Qty Balance</th>
                  <th className="p-2 text-right">COGS/Unit</th>
                  <th className="p-2 text-left">Received Date</th>
                  <th className="p-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch, idx) => (
                  <tr 
                    key={batch.batch_id} 
                    className={`border-t ${idx === 0 ? 'bg-blue-50' : ''}`}
                  >
                    <td className="p-2">
                      {batch.batch_number}
                      {idx === 0 && <span className="ml-2 text-xs text-blue-600">(Oldest - Used First)</span>}
                    </td>
                    <td className="p-2 text-right">{batch.qty_in}</td>
                    <td className="p-2 text-right font-medium">{batch.qty_balance}</td>
                    <td className="p-2 text-right">{formatCurrency(batch.cogs_per_unit)}</td>
                    <td className="p-2">{new Date(batch.received_date).toLocaleDateString('id-ID')}</td>
                    <td className="p-2 text-center">
                      {batch.qty_balance === 0 ? (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">Depleted</span>
                      ) : (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Active</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 bg-yellow-50 border border-yellow-200 p-3 rounded">
              <p className="text-sm text-yellow-800">
                <strong>FIFO Rule:</strong> Saat penjualan, system akan deduct dari batch terlama (paling atas) dulu.
                COGS dihitung dari batch yang dipakai.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

#### Seed Sample Batches
```typescript
// prisma/seed-batches.ts
async function seedBatches() {
  // Assume product_id: 1 (Pakan Meow), uom_id: 1 (Pcs), branch_id: 1 (Sudirman)
  
  const batches = [
    {
      batch_number: 'BATCH-20260301-001',
      product_id: 1,
      uom_id: 1,
      branch_id: 1,
      qty_in: 100,
      qty_balance: 30, // 70 already sold
      cogs_per_unit: 3000,
      received_date: new Date('2026-03-01'),
      status: 'active'
    },
    {
      batch_number: 'BATCH-20260315-002',
      product_id: 1,
      uom_id: 1,
      branch_id: 1,
      qty_in: 200,
      qty_balance: 200, // Fresh batch, not used yet
      cogs_per_unit: 3200, // Harga beli naik
      received_date: new Date('2026-03-15'),
      status: 'active'
    },
    {
      batch_number: 'BATCH-20260401-003',
      product_id: 1,
      uom_id: 1,
      branch_id: 1,
      qty_in: 150,
      qty_balance: 150, // Fresh batch
      cogs_per_unit: 3100, // Harga turun lagi
      received_date: new Date('2026-04-01'),
      status: 'active'
    }
  ]

  for (const batch of batches) {
    await prisma.inventory_batches.upsert({
      where: { batch_number: batch.batch_number },
      update: {},
      create: batch
    })
  }

  console.log('✅ Sample batches created for FIFO testing')
}
```

#### PRD Reference
- **BACKOFFICE_PRD_3_INVENTORY.md** Section 3.2 FIFO Batch Tracking
- **POS_PRD.md** Section 5.3 FIFO COGS Calculation

---

### **Story 3.4: Stock Minimum Setting**

**As a** Manager Backoffice  
**I want to** set minimum stock per produk  
**So that** system bisa alert jika stock rendah

**Story Points**: 3

#### Acceptance Criteria
```
✅ Set minimum stock modal/form accessible dari inventory page
✅ Input:
   - Product (read-only, pre-selected)
   - UOM (read-only, pre-selected)
   - Branch (read-only, pre-selected)
   - Minimum Stock (numeric, >= 0)

✅ Save minimum stock ke `inventory_stock` table
✅ Update inventory list → status badge updated (OK/Low/Out)
✅ Validation: Min stock >= 0
```

#### Technical Tasks
- [ ] Create SetMinStockModal component
- [ ] Create API endpoint:
  - `PUT /api/inventory/min-stock` (update min stock)
- [ ] Update inventory_stock table (min_stock column)
- [ ] Test min stock setting & alert

#### PRD Reference
- **BACKOFFICE_PRD_3_INVENTORY.md** Section 3.1.2 Stock Minimum

---

### **Story 3.5: Dashboard KPI Basic**

**As an** Owner  
**I want to** view KPI cards di dashboard  
**So that** saya bisa quick overview bisnis

**Story Points**: 5

#### Acceptance Criteria
```
✅ Dashboard accessible di `/backoffice`
✅ Display 4 KPI cards:
   
   Card 1: Total Penjualan Hari Ini
   - Gross Sales (Rp)
   - Net Sales (Rp)
   - % vs Yesterday

   Card 2: Total Produk
   - Total SKU count
   - Active products count

   Card 3: Stock Low Alert
   - Count products dengan stock < min stock
   - Quick link: "View Low Stock Items"

   Card 4: Pending Approval
   - Count PO pending approval
   - Quick link: "View Pending PO"

✅ Mode selection:
   - Per Cabang (dropdown)
   - Konsolidasi (All branches)

✅ Time range (untuk Card 1):
   - Hari Ini (default)
   - Minggu Ini
   - Bulan Ini

✅ Auto-refresh every 5 minutes (optional)
```

#### Technical Tasks
- [ ] Create `/app/backoffice/page.tsx` (dashboard)
- [ ] Create KPICard component
- [ ] Create API endpoint:
  - `GET /api/dashboard/kpi?branch_id=X&period=today`
- [ ] Implement KPI calculations
- [ ] Test dengan different branches & time ranges

#### PRD Reference
- **BACKOFFICE_PRD_1_FOUNDATION.md** Section 3.1 Dashboard

---

## 📊 SPRINT 3 SUMMARY

### Story Points Breakdown
| Story | Points | Assignee Suggestion |
|-------|--------|---------------------|
| 3.1 Multi-Harga 4 Tier | 8 | Dev 1 + Dev 2 |
| 3.2 Inventory Monitoring | 5 | Dev 2 |
| 3.3 FIFO Batch Structure | 5 | Dev 1 + Dev 2 |
| 3.4 Stock Min Setting | 3 | Dev 1 |
| 3.5 Dashboard KPI | 5 | Dev 1 |
| **TOTAL** | **26** | |

### Definition of Done
```
✅ Multi-harga 4 tier working untuk semua UOM
✅ Inventory monitoring complete
✅ FIFO batch structure ready (view only, logic di Sprint 4)
✅ Stock minimum setting working
✅ Dashboard KPI displaying correctly
✅ Code reviewed & merged
✅ Manual testing completed
```

### Sprint Deliverables
1. ✅ Pricing table per UOM (4 tier) complete
2. ✅ Inventory monitoring per cabang working
3. ✅ FIFO batch view component ready
4. ✅ Stock minimum alert working
5. ✅ Dashboard KPI (4 cards) displaying

---

## 🧪 TESTING CHECKLIST

### Functional Testing
- [ ] Setup pricing untuk 1 produk dengan 2 UOM → All tiers saved
- [ ] Harga Grosir > Retail → Warning displayed (tapi bisa save)
- [ ] View inventory dengan filter cabang → Correct data
- [ ] Stock qty < min stock → Status "Low Stock" ⚠️
- [ ] Stock qty = 0 → Status "Out of Stock" 🔴
- [ ] View batches → Sorted by received_date ASC (FIFO)
- [ ] Dashboard KPI hari ini → Correct sales amount
- [ ] Switch cabang di dashboard → KPI updated

---

## 🚨 RISKS & MITIGATIONS

| Risk | Impact | Mitigation |
|------|--------|------------|
| Pricing logic complex (4 tier) | MEDIUM | Thorough testing, clear UI warnings |
| FIFO batch view confusing untuk user | LOW | Add help text, clear visual hierarchy |
| Dashboard KPI slow query | MEDIUM | Add database indexes, optimize queries |

---

## 📝 NOTES FOR NEXT SPRINT

**Sprint 4 (CRITICAL) Dependencies:**
- Multi-harga dari Sprint 3 → POS akan pakai untuk pilih tier
- FIFO batch structure dari Sprint 3 → Sprint 4 implement deduction logic
- Inventory monitoring dari Sprint 3 → Sprint 4 update stock after sale

**Sprint 4 = MOST CRITICAL SPRINT:**
- FIFO COGS calculation
- Auto-break logic (Sak → Pcs)
- Stock deduction dari batch terlama
- Allocate 2 developers untuk Sprint 4

---

**Last Updated**: 18 April 2026  
**Sprint Status**: 🔴 Not Started  
**Previous Sprint**: MVP_SPRINT_2_MASTER_DATA.md  
**Next Sprint**: MVP_SPRINT_4_POS_PENJUALAN_FIFO.md
