# 📘 MVP SPRINT 8 - PO WORKFLOW, HUTANG & LAPORAN 🎉 FINAL

**Sprint Duration**: 2 weeks (Week 15-16)  
**Sprint Goal**: PO workflow complete + Hutang supplier tracking + Laporan keuangan  
**Story Points**: 30 points  
**Team**: 2-3 developers

---

## 🎯 SPRINT OBJECTIVES

By end of Sprint 8, MVP COMPLETE! System harus bisa:
1. ✅ PO Request (POS) → Approval (Backoffice) → Receiving (POS)
2. ✅ Hutang supplier auto-create & partial payment
3. ✅ Laporan Omset (sales breakdown)
4. ✅ Laporan Laba Rugi (P&L sederhana)
5. ✅ Laporan Pengeluaran Bulanan
6. ✅ **SYSTEM READY FOR PRODUCTION** 🚀

---

## 📋 USER STORIES

### **Story 8.1: PO Request (POS)**

**As a** Kasir  
**I want to** buat PO request ke supplier  
**So that** stock bisa di-restock saat habis

**Story Points**: 5

#### Acceptance Criteria
```
✅ PO Request page accessible di `/pos/purchase-order/request`
✅ Create PO Request:
   - Select supplier (dropdown)
   - Add products to PO:
     * Search product
     * Select UOM
     * Input qty needed
     * Harga auto-fill dari last PO (read-only)
   - Display PO summary:
     * Total items
     * Total amount (Qty × Last Price)

✅ Submit PO Request:
   - Create purchase_orders record:
     * supplier_id
     * branch_id
     * requested_by (kasir_id)
     * request_date (NOW())
     * status: 'PENDING_APPROVAL'
     * total_amount
   
   - Create purchase_order_items records (per product)
   
   - Send notification to Backoffice (Manager BO/Owner)

✅ Validation:
   - Supplier required
   - Min 1 product
   - Qty > 0 per item

✅ PO Request history:
   - View list PO Request dari kasir ini
   - Status: Pending / Approved / Rejected
```

#### Technical Tasks
- [ ] Create `/app/pos/purchase-order/request/page.tsx`
- [ ] Create PORequestForm component
- [ ] Get last PO price untuk auto-fill
- [ ] Create API endpoint:
  - `POST /api/pos/purchase-order/request`
  - `GET /api/pos/purchase-order/my-requests`
- [ ] Test PO request flow

#### Component Example
```tsx
// app/pos/purchase-order/request/page.tsx
'use client'
import { useState } from 'react'

interface POItem {
  product_id: number
  product_name: string
  uom_id: number
  uom_name: string
  qty_needed: number
  last_price: number
  subtotal: number
}

export default function PORequestPage() {
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null)
  const [poItems, setPOItems] = useState<POItem[]>([])

  const addProduct = async (product: any, uom: any, qty: number) => {
    // Get last price from previous PO
    const res = await fetch(`/api/pos/products/${product.product_id}/last-price?supplier_id=${selectedSupplier.supplier_id}&uom_id=${uom.id}`)
    const data = await res.json()
    const lastPrice = data.last_price || 0

    const newItem: POItem = {
      product_id: product.product_id,
      product_name: product.product_name,
      uom_id: uom.id,
      uom_name: uom.uom_name,
      qty_needed: qty,
      last_price: lastPrice,
      subtotal: qty * lastPrice
    }

    setPOItems([...poItems, newItem])
  }

  const handleSubmitPO = async () => {
    if (!selectedSupplier) {
      alert('Pilih supplier dulu')
      return
    }

    if (poItems.length === 0) {
      alert('Tambah minimal 1 produk')
      return
    }

    if (!confirm(`Submit PO Request ke ${selectedSupplier.supplier_name}?`)) {
      return
    }

    try {
      const res = await fetch('/api/pos/purchase-order/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: selectedSupplier.supplier_id,
          items: poItems
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message)
      }

      alert('PO Request berhasil dikirim ke Backoffice untuk approval!')
      window.location.href = '/pos/purchase-order/my-requests'
    } catch (error) {
      alert(error.message)
    }
  }

  const totalAmount = poItems.reduce((sum, item) => sum + item.subtotal, 0)

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Buat PO Request</h1>

        {/* Supplier Selection */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <label className="block text-sm font-medium mb-2">Supplier</label>
          <select
            value={selectedSupplier?.supplier_id || ''}
            onChange={(e) => {
              // Fetch supplier by ID & set
            }}
            className="w-full border p-3 rounded-lg"
          >
            <option value="">Pilih Supplier</option>
            {/* Map suppliers */}
          </select>
        </div>

        {/* PO Items Table */}
        {selectedSupplier && (
          <>
            <div className="bg-white rounded-lg shadow mb-6">
              <div className="p-4 border-b">
                <button
                  onClick={() => {/* Show product selector */}}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  + Tambah Produk
                </button>
              </div>

              {poItems.length > 0 ? (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-3 text-left">Product</th>
                      <th className="p-3 text-left">UOM</th>
                      <th className="p-3 text-right">Qty</th>
                      <th className="p-3 text-right">Last Price</th>
                      <th className="p-3 text-right">Subtotal</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poItems.map((item, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-3">{item.product_name}</td>
                        <td className="p-3">{item.uom_name}</td>
                        <td className="p-3 text-right">{item.qty_needed}</td>
                        <td className="p-3 text-right">{formatCurrency(item.last_price)}</td>
                        <td className="p-3 text-right font-medium">{formatCurrency(item.subtotal)}</td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => setPOItems(poItems.filter((_, i) => i !== idx))}
                            className="text-red-600 hover:text-red-800"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2">
                    <tr>
                      <td colSpan={4} className="p-3 text-right font-bold">TOTAL:</td>
                      <td className="p-3 text-right font-bold text-blue-600">
                        {formatCurrency(totalAmount)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <div className="p-12 text-center text-gray-400">
                  Belum ada produk. Klik "Tambah Produk" untuk mulai.
                </div>
              )}
            </div>

            {/* Submit Button */}
            {poItems.length > 0 && (
              <button
                onClick={handleSubmitPO}
                className="w-full bg-blue-600 text-white py-4 rounded-lg text-lg font-semibold hover:bg-blue-700"
              >
                Submit PO Request ({poItems.length} items, {formatCurrency(totalAmount)})
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

#### API Implementation
```typescript
// app/api/pos/purchase-order/request/route.ts
export async function POST(req: NextRequest) {
  try {
    const { supplier_id, items } = await req.json()

    const result = await prisma.$transaction(async (tx) => {
      const totalAmount = items.reduce((sum: number, item: any) => sum + item.subtotal, 0)

      // Create PO header
      const po = await tx.purchase_orders.create({
        data: {
          supplier_id,
          branch_id: 1, // Get from session
          requested_by: 1, // Get from session (kasir)
          request_date: new Date(),
          status: 'PENDING_APPROVAL',
          total_amount: totalAmount
        }
      })

      // Create PO items
      for (const item of items) {
        await tx.purchase_order_items.create({
          data: {
            po_id: po.po_id,
            product_id: item.product_id,
            uom_id: item.uom_id,
            qty_ordered: item.qty_needed,
            price_per_unit: item.last_price,
            subtotal: item.subtotal
          }
        })
      }

      // TODO: Send notification to Backoffice (email/push)

      return po
    })

    return NextResponse.json({ success: true, po_id: result.po_id })
  } catch (error) {
    console.error('PO Request error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

#### PRD Reference
- **POS_PRD.md** Section 5.11 Purchase Order Request
- **BACKOFFICE_PRD_4_PURCHASING.md** Section 3.1 PO Creation

---

### **Story 8.2: PO Approval (Backoffice)**

**As a** Manager Backoffice  
**I want to** approve/reject PO request dari POS  
**So that** hanya PO yang valid yang di-order ke supplier

**Story Points**: 5

#### Acceptance Criteria
```
✅ PO Approval page accessible di `/backoffice/purchasing/approvals`
✅ Display pending PO list:
   - Supplier name
   - Requested by (kasir name)
   - Request date
   - Total amount
   - Total items
   - Action: View / Approve / Reject

✅ PO Detail view:
   - Supplier info
   - Items table (product, qty, price)
   - Total amount

✅ Approve PO:
   - Update status: 'PENDING_APPROVAL' → 'APPROVED'
   - approved_by (user_id)
   - approved_at (timestamp)
   - Send notification ke POS

✅ Reject PO:
   - Update status: 'PENDING_APPROVAL' → 'REJECTED'
   - rejected_by (user_id)
   - rejected_at (timestamp)
   - rejection_reason (optional input)

✅ Permission:
   - Only Owner & Manager BO can approve/reject
```

#### Technical Tasks
- [ ] Create `/app/backoffice/purchasing/approvals/page.tsx`
- [ ] Create POApprovalList component
- [ ] Create PODetailModal component
- [ ] Create API endpoints:
  - `PUT /api/backoffice/purchase-order/:id/approve`
  - `PUT /api/backoffice/purchase-order/:id/reject`
- [ ] Test approval flow

#### PRD Reference
- **BACKOFFICE_PRD_4_PURCHASING.md** Section 3.1.2 PO Approval

---

### **Story 8.3: PO Receiving (POS)**

**As a** Kasir/Gudang  
**I want to** receive barang dari supplier  
**So that** stock bertambah & hutang tercatat

**Story Points**: 8

#### Acceptance Criteria
```
✅ PO Receiving page accessible di `/pos/purchase-order/receive`
✅ Display approved PO list:
   - Filter: Status = 'APPROVED'
   - Supplier name
   - PO date
   - Total amount
   - Action: Receive

✅ Receiving process:
   - Display PO items
   - Input qty received per item (might differ from qty ordered)
   - Example:
     * Ordered: 100 Pcs
     * Received: 95 Pcs (5 Pcs short)
   
   - Auto-fill qty received = qty ordered (user can edit)

✅ Submit receiving:
   - Update PO status: 'APPROVED' → 'RECEIVED'
   - received_by (user_id)
   - received_at (timestamp)
   
   - For each item:
     * Create FIFO batch:
       - batch_number (auto-generate)
       - product_id, uom_id, branch_id
       - qty_in = qty_received
       - qty_balance = qty_received
       - cogs_per_unit = price_per_unit (dari PO item)
       - received_date = NOW()
       - po_id (link to PO)
     
     * Update inventory_stock:
       - qty_current += qty_received
   
   - Auto-create hutang supplier:
     * Create supplier_payables record:
       - supplier_id
       - po_id
       - invoice_number (input manual, optional untuk MVP)
       - amount_due = Total (qty_received × price)
       - amount_paid = 0
       - amount_outstanding = amount_due
       - due_date = NOW() + payment_term days
       - status: 'OUTSTANDING'

✅ Validation:
   - Qty received must be >= 0
   - Qty received can be < qty ordered (short delivery)
   - Qty received cannot be > qty ordered (di MVP, prevent over-delivery)

✅ Receiving history:
   - View list PO received
   - Filter by date, supplier
```

#### Technical Tasks
- [ ] Create `/app/pos/purchase-order/receive/page.tsx`
- [ ] Create POReceivingForm component
- [ ] Implement batch creation logic
- [ ] Implement hutang auto-create
- [ ] Create API endpoint:
  - `POST /api/pos/purchase-order/:id/receive`
- [ ] Test receiving flow end-to-end
- [ ] Test FIFO batch creation
- [ ] Test hutang auto-create

#### Component Example
```tsx
// app/pos/purchase-order/receive/page.tsx
'use client'
import { useState, useEffect } from 'react'

export default function POReceivingPage() {
  const [approvedPOs, setApprovedPOs] = useState([])
  const [selectedPO, setSelectedPO] = useState<any>(null)
  const [receivingItems, setReceivingItems] = useState([])

  useEffect(() => {
    fetchApprovedPOs()
  }, [])

  const fetchApprovedPOs = async () => {
    const res = await fetch('/api/pos/purchase-order?status=APPROVED')
    const data = await res.json()
    setApprovedPOs(data)
  }

  const handleSelectPO = async (po: any) => {
    const res = await fetch(`/api/pos/purchase-order/${po.po_id}`)
    const data = await res.json()
    
    setSelectedPO(data)
    
    // Initialize receiving items (auto-fill qty_received = qty_ordered)
    const items = data.items.map((item: any) => ({
      ...item,
      qty_received: item.qty_ordered
    }))
    setReceivingItems(items)
  }

  const updateQtyReceived = (index: number, qtyReceived: number) => {
    const updated = [...receivingItems]
    updated[index].qty_received = qtyReceived
    setReceivingItems(updated)
  }

  const handleSubmitReceiving = async () => {
    // Validation
    const invalidItems = receivingItems.filter(item => item.qty_received > item.qty_ordered)
    if (invalidItems.length > 0) {
      alert('Qty received tidak boleh > qty ordered')
      return
    }

    if (!confirm(`Receive PO dari ${selectedPO.supplier.supplier_name}?`)) {
      return
    }

    try {
      const res = await fetch(`/api/pos/purchase-order/${selectedPO.po_id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: receivingItems.map(item => ({
            po_item_id: item.po_item_id,
            qty_received: item.qty_received
          }))
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message)
      }

      const data = await res.json()
      alert(`PO received! Stock updated. Hutang created: ${formatCurrency(data.hutang_amount)}`)
      
      setSelectedPO(null)
      setReceivingItems([])
      fetchApprovedPOs()
    } catch (error) {
      alert(error.message)
    }
  }

  if (selectedPO) {
    const totalReceived = receivingItems.reduce((sum, item) => sum + (item.qty_received * item.price_per_unit), 0)

    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setSelectedPO(null)}
            className="mb-4 text-blue-600 hover:underline"
          >
            ← Back to PO List
          </button>

          <h1 className="text-2xl font-bold mb-6">Receive PO</h1>

          {/* PO Info */}
          <div className="bg-white p-4 rounded-lg shadow mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Supplier:</p>
                <p className="font-medium">{selectedPO.supplier.supplier_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">PO Date:</p>
                <p className="font-medium">{new Date(selectedPO.request_date).toLocaleDateString('id-ID')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Requested by:</p>
                <p className="font-medium">{selectedPO.requested_by_user.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total PO:</p>
                <p className="font-medium">{formatCurrency(selectedPO.total_amount)}</p>
              </div>
            </div>
          </div>

          {/* Receiving Table */}
          <div className="bg-white rounded-lg shadow">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left">Product</th>
                  <th className="p-3 text-left">UOM</th>
                  <th className="p-3 text-right">Qty Ordered</th>
                  <th className="p-3 text-right">Qty Received</th>
                  <th className="p-3 text-right">Price</th>
                  <th className="p-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {receivingItems.map((item, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="p-3">{item.product.product_name}</td>
                    <td className="p-3">{item.product_uom.uom_name}</td>
                    <td className="p-3 text-right">{item.qty_ordered}</td>
                    <td className="p-3">
                      <input
                        type="number"
                        value={item.qty_received || ''}
                        onChange={(e) => updateQtyReceived(idx, parseInt(e.target.value) || 0)}
                        className="w-24 text-right border p-2 rounded"
                        min="0"
                        max={item.qty_ordered}
                      />
                    </td>
                    <td className="p-3 text-right">{formatCurrency(item.price_per_unit)}</td>
                    <td className="p-3 text-right font-medium">
                      {formatCurrency(item.qty_received * item.price_per_unit)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2">
                <tr>
                  <td colSpan={5} className="p-3 text-right font-bold">TOTAL RECEIVED:</td>
                  <td className="p-3 text-right font-bold text-blue-600">
                    {formatCurrency(totalReceived)}
                  </td>
                </tr>
              </tfoot>
            </table>

            <div className="p-4 border-t">
              <button
                onClick={handleSubmitReceiving}
                className="w-full bg-blue-600 text-white py-3 rounded-lg text-lg font-semibold hover:bg-blue-700"
              >
                Confirm Receiving & Create Hutang
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // PO List view
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Receive Purchase Order</h1>

        <div className="bg-white rounded-lg shadow">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">PO Date</th>
                <th className="p-3 text-left">Supplier</th>
                <th className="p-3 text-left">Requested By</th>
                <th className="p-3 text-right">Total Amount</th>
                <th className="p-3 text-center">Items</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {approvedPOs.map((po: any) => (
                <tr key={po.po_id} className="border-t">
                  <td className="p-3">{new Date(po.request_date).toLocaleDateString('id-ID')}</td>
                  <td className="p-3 font-medium">{po.supplier.supplier_name}</td>
                  <td className="p-3">{po.requested_by_user.name}</td>
                  <td className="p-3 text-right">{formatCurrency(po.total_amount)}</td>
                  <td className="p-3 text-center">{po.items_count} items</td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => handleSelectPO(po)}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                      Receive
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {approvedPOs.length === 0 && (
            <div className="p-12 text-center text-gray-400">
              Tidak ada PO yang perlu di-receive
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

#### API Implementation
```typescript
// app/api/pos/purchase-order/[id]/receive/route.ts
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const poId = parseInt(params.id)
    const { items } = await req.json()

    const result = await prisma.$transaction(async (tx) => {
      // Get PO
      const po = await tx.purchase_orders.findUnique({
        where: { po_id: poId },
        include: {
          supplier: true,
          items: {
            include: {
              product: true,
              product_uom: true
            }
          }
        }
      })

      if (!po) throw new Error('PO not found')
      if (po.status !== 'APPROVED') throw new Error('PO not approved yet')

      let totalHutang = 0

      // Process each item
      for (const receivedItem of items) {
        const poItem = po.items.find(i => i.po_item_id === receivedItem.po_item_id)
        if (!poItem) continue

        const qtyReceived = receivedItem.qty_received
        if (qtyReceived <= 0) continue

        // Create FIFO batch
        const batchNumber = `BATCH-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${poItem.product_id}-${Date.now()}`

        await tx.inventory_batches.create({
          data: {
            batch_number: batchNumber,
            product_id: poItem.product_id,
            uom_id: poItem.uom_id,
            branch_id: po.branch_id,
            qty_in: qtyReceived,
            qty_balance: qtyReceived,
            cogs_per_unit: poItem.price_per_unit,
            received_date: new Date(),
            po_id: poId,
            status: 'active'
          }
        })

        // Update inventory stock
        const existingStock = await tx.inventory_stock.findFirst({
          where: {
            product_id: poItem.product_id,
            uom_id: poItem.uom_id,
            branch_id: po.branch_id
          }
        })

        if (existingStock) {
          await tx.inventory_stock.update({
            where: { stock_id: existingStock.stock_id },
            data: {
              qty_current: {
                increment: qtyReceived
              }
            }
          })
        } else {
          await tx.inventory_stock.create({
            data: {
              product_id: poItem.product_id,
              uom_id: poItem.uom_id,
              branch_id: po.branch_id,
              qty_current: qtyReceived,
              min_stock: 0
            }
          })
        }

        totalHutang += qtyReceived * poItem.price_per_unit
      }

      // Update PO status
      await tx.purchase_orders.update({
        where: { po_id: poId },
        data: {
          status: 'RECEIVED',
          received_by: 1, // Get from session
          received_at: new Date()
        }
      })

      // Auto-create Hutang Supplier
      const dueDate = new Date()
      const paymentTermDays = po.supplier.payment_term === 'NET_7' ? 7 :
                             po.supplier.payment_term === 'NET_14' ? 14 :
                             po.supplier.payment_term === 'NET_30' ? 30 : 0

      dueDate.setDate(dueDate.getDate() + paymentTermDays)

      const hutang = await tx.supplier_payables.create({
        data: {
          supplier_id: po.supplier_id,
          po_id: poId,
          invoice_number: `INV-SUPPLIER-${poId}`, // Simplified
          amount_due: totalHutang,
          amount_paid: 0,
          amount_outstanding: totalHutang,
          due_date: dueDate,
          status: 'OUTSTANDING'
        }
      })

      return {
        po_id: poId,
        hutang_id: hutang.payable_id,
        hutang_amount: totalHutang
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('PO Receiving error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
```

#### PRD Reference
- **POS_PRD.md** Section 5.11.2 PO Receiving
- **BACKOFFICE_PRD_4_PURCHASING.md** Section 3.2 Goods Receipt

---

### **Story 8.4: Hutang Supplier Tracking & Partial Payment**

**As a** Owner/Manager BO  
**I want to** track hutang supplier & bayar partial  
**So that** hutang tercatat dengan akurat

**Story Points**: 5

#### Acceptance Criteria
```
✅ Hutang list page accessible di `/backoffice/finance/hutang`
✅ Display hutang list:
   - Supplier name
   - PO number
   - Invoice number
   - Amount due
   - Amount paid
   - Amount outstanding
   - Due date
   - Status (Outstanding / Partial Paid / Fully Paid / Overdue)
   - Aging (days since due date)

✅ Filter hutang:
   - By supplier
   - By status
   - By date range

✅ Partial payment:
   - Click "Bayar" button
   - Input payment amount (can be < outstanding)
   - Payment date (default: today)
   - Payment method (dropdown: Cash/Transfer)
   - Notes (optional)
   
   - Submit payment:
     * Create supplier_payments record
     * Update supplier_payables:
       - amount_paid += payment_amount
       - amount_outstanding -= payment_amount
       - IF outstanding = 0 → status = 'FULLY_PAID'
       - ELSE → status = 'PARTIAL_PAID'

✅ Payment history:
   - View all payments untuk 1 hutang
   - Display: Payment date, Amount, Method, By who

✅ Aging calculation:
   - IF today > due_date:
     * Aging = days since due_date
     * Status badge: "Overdue (X days)"
```

#### Technical Tasks
- [ ] Create `/app/backoffice/finance/hutang/page.tsx`
- [ ] Create HutangList component
- [ ] Create PartialPaymentModal component
- [ ] Create API endpoints:
  - `GET /api/backoffice/supplier-payables`
  - `POST /api/backoffice/supplier-payables/:id/payment`
  - `GET /api/backoffice/supplier-payables/:id/payment-history`
- [ ] Implement aging calculation
- [ ] Test partial payment flow

#### PRD Reference
- **BACKOFFICE_PRD_4_PURCHASING.md** Section 3.4 Supplier Payment
- User requirement: Hutang auto-record + partial payment CRITICAL

---

### **Story 8.5: Laporan Omset (Sales Revenue)**

**As an** Owner  
**I want to** view laporan omset  
**So that** saya tahu total penjualan per periode

**Story Points**: 3

#### Acceptance Criteria
```
✅ Laporan Omset page accessible di `/backoffice/reports/omset`
✅ Display sales summary:
   - Gross Sales (total penjualan kotor)
   - Sales Discount (total discount given)
   - Net Sales (gross - discount)
   
   - Breakdown by payment method:
     * Cash: Rp X
     * QRIS: Rp Y
   
   - Breakdown by category (optional):
     * Makanan: Rp A
     * Obat: Rp B
     * Aksesoris: Rp C

✅ Time range filter:
   - Harian (pilih tanggal)
   - Mingguan (pilih minggu)
   - Bulanan (pilih bulan)

✅ Branch filter:
   - Per cabang (dropdown)
   - Konsolidasi (all branches)

✅ Export (optional):
   - Download as Excel/PDF
```

#### Technical Tasks
- [ ] Create `/app/backoffice/reports/omset/page.tsx`
- [ ] Aggregate sales data from transactions
- [ ] Create charts (optional: line chart sales over time)
- [ ] Test omset calculation

#### PRD Reference
- **BACKOFFICE_PRD_7_REPORTING.md** Section 3.1 Sales Report

---

### **Story 8.6: Laporan Laba Rugi Sederhana**

**As an** Owner  
**I want to** view laporan laba rugi  
**So that** saya tahu profit/loss bisnis

**Story Points**: 4

#### Acceptance Criteria
```
✅ Laporan Laba Rugi page accessible di `/backoffice/reports/laba-rugi`
✅ Display P&L summary:
   
   REVENUE:
   - Net Sales                     Rp X
   
   COST OF GOODS SOLD:
   - Total COGS (dari FIFO)        Rp Y
   
   GROSS PROFIT:
   - = Net Sales - COGS            Rp Z
   
   OPERATING EXPENSES:
   - Daily Expenses (dari POS)     Rp A
   - Barang Rusak (write-off)      Rp B
   - Total OpEx                    Rp (A+B)
   
   NET PROFIT:
   - = Gross Profit - Total OpEx   Rp W

✅ Time range & branch filter (same as Omset)

✅ Profit margin calculation:
   - Gross Margin % = (Gross Profit / Net Sales) × 100%
   - Net Margin % = (Net Profit / Net Sales) × 100%

✅ Display:
   - Use card layout untuk easy reading
   - Color indicator:
     * Green: Profit positive
     * Red: Profit negative (loss)
```

#### Technical Tasks
- [ ] Create `/app/backoffice/reports/laba-rugi/page.tsx`
- [ ] Aggregate data:
  - Net Sales (from transactions)
  - Total COGS (from transactions.total_cogs)
  - Daily Expenses (from daily_expenses)
  - Barang Rusak (from damaged_goods.loss_amount)
- [ ] Calculate profit & margins
- [ ] Test P&L calculation accuracy

#### PRD Reference
- **BACKOFFICE_PRD_5_FINANCE.md** Section 3.3 P&L Report

---

### **Story 8.7: Laporan Pengeluaran Bulanan**

**As an** Owner  
**I want to** view laporan pengeluaran per kategori  
**So that** saya tahu spending breakdown

**Story Points**: 2

#### Acceptance Criteria
```
✅ Laporan Pengeluaran page accessible di `/backoffice/reports/pengeluaran`
✅ Display expense summary:
   - Total Daily Expenses (dari POS settlement)
   - Total Barang Rusak (write-off value)
   - Total Pengeluaran
   
   - Breakdown by category:
     * Transport: Rp X
     * Konsumsi: Rp Y
     * Perlengkapan: Rp Z
     * Barang Rusak: Rp A
     * Lain-lain: Rp B

✅ Time range filter:
   - Bulanan only (pilih bulan)

✅ Branch filter:
   - Per cabang
   - Konsolidasi

✅ Display as chart (optional):
   - Pie chart untuk breakdown by category
```

#### Technical Tasks
- [ ] Create `/app/backoffice/reports/pengeluaran/page.tsx`
- [ ] Aggregate expense data from:
  - daily_expenses table
  - damaged_goods table
- [ ] Create pie chart (optional)
- [ ] Test expense aggregation

#### PRD Reference
- **BACKOFFICE_PRD_5_FINANCE.md** Section 3.4 OpEx Report

---

## 📊 SPRINT 8 SUMMARY

### Story Points Breakdown
| Story | Points | Assignee Suggestion |
|-------|--------|---------------------|
| 8.1 PO Request (POS) | 5 | Dev 1 |
| 8.2 PO Approval (Backoffice) | 5 | Dev 2 |
| 8.3 PO Receiving (POS) | 8 | Dev 1 + Dev 2 |
| 8.4 Hutang Tracking & Payment | 5 | Dev 2 |
| 8.5 Laporan Omset | 3 | Dev 1 |
| 8.6 Laporan Laba Rugi | 4 | Dev 1 |
| 8.7 Laporan Pengeluaran | 2 | Dev 1 |
| **TOTAL** | **30** | |

### Definition of Done
```
✅ PO workflow complete (Request → Approve → Receive)
✅ FIFO batch created saat receiving
✅ Hutang auto-created saat receiving
✅ Partial payment hutang working
✅ Laporan Omset accurate
✅ Laporan Laba Rugi accurate
✅ Laporan Pengeluaran accurate
✅ Code reviewed & merged
✅ Manual testing completed
✅ No critical bugs
✅ **SYSTEM READY FOR PRODUCTION** 🚀
```

### Sprint Deliverables
1. ✅ Complete PO workflow
2. ✅ Hutang supplier tracking
3. ✅ Partial payment functionality
4. ✅ 3 laporan keuangan working
5. ✅ **MVP COMPLETE!**

---

## 🧪 TESTING CHECKLIST

### PO Workflow Testing
- [ ] Kasir create PO Request → Status PENDING_APPROVAL
- [ ] Manager approve PO → Status APPROVED
- [ ] Kasir receive PO (full qty) → Batch created, Stock updated, Hutang created
- [ ] Kasir receive PO (short delivery: 95/100) → Batch = 95, Hutang = 95 × price

### Hutang Testing
- [ ] Hutang auto-created setelah PO received
- [ ] Partial payment Rp 500k → Outstanding reduced, Status PARTIAL_PAID
- [ ] Full payment → Outstanding = 0, Status FULLY_PAID
- [ ] Overdue hutang → Status badge "Overdue (X days)"

### Laporan Testing
- [ ] Omset calculation: Total sales match transaction sum
- [ ] Laba Rugi: Net Profit = (Sales - COGS - Expenses) ✓
- [ ] Pengeluaran: Total match daily_expenses + damaged_goods

---

## 🚨 RISKS & MITIGATIONS

| Risk | Impact | Mitigation |
|------|--------|------------|
| FIFO batch creation error saat receiving | CRITICAL | Reuse tested logic from Sprint 4, Extra validation |
| Hutang calculation wrong | HIGH | Double-check calculation, Manual verification |
| Laporan data tidak akurat | HIGH | Cross-validate with raw data, Unit tests |
| PO workflow confusion (kasir/manager) | MEDIUM | Clear UI, Status indicators, Training |

---

## 🎉 MVP COMPLETION CHECKLIST

After Sprint 8, validate entire system:

### **POS Features (11/11)** ✅
- [x] 1. Login User
- [x] 2. Penjualan (Multi-UOM, Multi-Harga, FIFO COGS)
- [x] 3. Stock Opname Harian
- [x] 4. Input Barang Rusak
- [x] 5. Settlement Multi-Kasir
- [x] 6. Pengeluaran Harian
- [x] 7. PO Request
- [x] 8. Open Bill
- [x] 9. Shift Management
- [x] 10. Multi-Kasir per Shift
- [x] 11. Tampilan Berat Pesanan

### **Backoffice Features (6/6)** ✅
- [x] 1. Login & User Role
- [x] 2. Dashboard KPI
- [x] 3. Master Data (Produk, Kategori, Cabang, User, UOM, Multi-Harga, Supplier)
- [x] 4. Inventory per Cabang
- [x] 5. Stock Opname Bulanan
- [x] 6. Laporan Keuangan (Omset, Laba Rugi, Pengeluaran)

### **Critical Features Working** ✅
- [x] FIFO COGS calculation
- [x] Multi-UOM (5 UOM)
- [x] Multi-Harga (4 tier)
- [x] Auto-break logic
- [x] Multi-kasir settlement
- [x] Hutang supplier tracking
- [x] PO workflow
- [x] Receipt printing
- [x] Surat Jalan (DO)

---

## 🚀 PRODUCTION READINESS

### Pre-Launch Checklist
- [ ] All 17 features tested end-to-end
- [ ] FIFO calculation verified by Owner/Finance
- [ ] Sample data seeded (10 products, 3 branches, 5 users)
- [ ] Receipt printer tested (thermal 58mm/80mm)
- [ ] Multi-kasir tested (2-3 kasir concurrent)
- [ ] Settlement variance calculation verified
- [ ] Laporan Laba Rugi cross-checked with manual calculation
- [ ] User training completed (POS & Backoffice)
- [ ] Database backup strategy implemented
- [ ] Production environment ready (server, domain, SSL)

### Phase 2 Planning (Future)
Features deferred dari MVP:
- Approval workflows (SO, void transaction)
- Piutang customer tracking
- Retur customer/supplier
- Promo & discount management
- Loyalty points & member tier
- Custom report builder
- Advanced analytics (charts, trends)
- Notification system (WA/Email)
- Multiple barcodes per product
- Harga per cabang berbeda
- Stock transfer antar cabang
- Export Excel/PDF semua laporan

---

## 🎊 CONGRATULATIONS!

**MVP SPRINT 8 COMPLETE!**  
**Total Sprints**: 8 sprints (16 weeks / 4 months)  
**Total Story Points**: 215 points  
**Total Features**: 17 features (11 POS + 6 Backoffice)

**SYSTEM READY FOR PRODUCTION!** 🚀🎉

---

**Last Updated**: 18 April 2026  
**Sprint Status**: 🔴 Not Started  
**Previous Sprint**: MVP_SPRINT_7_SO_BARANG_RUSAK.md  
**Next Sprint**: PRODUCTION LAUNCH! 🚀
