# 📘 MVP SPRINT 5 - PAYMENT, RECEIPT & DELIVERY ORDER

**Sprint Duration**: 2 weeks (Week 9-10)  
**Sprint Goal**: Payment flow complete + Receipt printing + Surat Jalan + Open Bill  
**Story Points**: 30 points  
**Team**: 2-3 developers

---

## 🎯 SPRINT OBJECTIVES

By end of Sprint 5, system harus bisa:
1. ✅ Payment flow (Cash, QRIS)
2. ✅ Calculate change (untuk Cash)
3. ✅ Save transaction to database
4. ✅ Print receipt (thermal 58mm/80mm)
5. ✅ Surat Jalan (DO) manual trigger setelah checkout
6. ✅ Display total berat pesanan (di layar & receipt & DO)
7. ✅ Open Bill (pending transaction)

---

## 📋 USER STORIES

### **Story 5.1: Payment Method (Cash & QRIS)**

**As a** Kasir  
**I want to** terima pembayaran dengan Cash atau QRIS  
**So that** customer bisa bayar sesuai metode yang mereka pilih

**Story Points**: 5

#### Acceptance Criteria
```
✅ Payment method selection screen:
   - Display grand total
   - Show 2 payment methods:
     * Cash (tunai)
     * QRIS (scan QR code)

✅ Cash payment:
   - Input field: "Bayar (Rp)"
   - Real-time calculate change
   - Validation: Bayar >= Total
   - IF bayar < total → Error: "Jumlah bayar kurang"
   - Display kembalian: "Kembalian: Rp X"

✅ QRIS payment:
   - Generate QRIS QR code (dummy untuk MVP, static QR)
   - Show QR code to customer
   - Manual confirm: "Pembayaran berhasil?" (Yes/No)
   - IF Yes → Proceed to save transaction
   - IF No → Back to payment method selection

✅ Payment validation:
   - Cannot proceed jika payment belum confirmed
   - QRIS confirmation required
   - Cash change calculated correctly
```

#### Technical Tasks
- [ ] Create payment method selection component
- [ ] Create CashPayment component (input bayar, calculate change)
- [ ] Create QRISPayment component (show QR, confirm button)
- [ ] Implement payment validation
- [ ] Test payment flows (Cash & QRIS)

#### Component Example
```tsx
// components/pos/PaymentMethodSelection.tsx
export default function PaymentMethodSelection({
  total,
  onPaymentComplete
}: {
  total: number
  onPaymentComplete: (method: string, paidAmount: number, change: number) => void
}) {
  const [selectedMethod, setSelectedMethod] = useState<'cash' | 'qris' | null>(null)

  if (selectedMethod === 'cash') {
    return (
      <CashPayment
        total={total}
        onConfirm={(paidAmount, change) => {
          onPaymentComplete('cash', paidAmount, change)
        }}
        onCancel={() => setSelectedMethod(null)}
      />
    )
  }

  if (selectedMethod === 'qris') {
    return (
      <QRISPayment
        total={total}
        onConfirm={() => {
          onPaymentComplete('qris', total, 0)
        }}
        onCancel={() => setSelectedMethod(null)}
      />
    )
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6 text-center">Pilih Metode Pembayaran</h2>
      
      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <p className="text-sm text-gray-600 mb-1">Total Pembayaran:</p>
        <p className="text-3xl font-bold text-blue-600">{formatCurrency(total)}</p>
      </div>

      <div className="space-y-4">
        <button
          onClick={() => setSelectedMethod('cash')}
          className="w-full bg-green-600 text-white p-6 rounded-lg hover:bg-green-700 transition"
        >
          <div className="text-2xl mb-2">💵</div>
          <div className="text-xl font-bold">Cash (Tunai)</div>
        </button>

        <button
          onClick={() => setSelectedMethod('qris')}
          className="w-full bg-blue-600 text-white p-6 rounded-lg hover:bg-blue-700 transition"
        >
          <div className="text-2xl mb-2">📱</div>
          <div className="text-xl font-bold">QRIS</div>
        </button>
      </div>
    </div>
  )
}

// components/pos/CashPayment.tsx
function CashPayment({
  total,
  onConfirm,
  onCancel
}: {
  total: number
  onConfirm: (paidAmount: number, change: number) => void
  onCancel: () => void
}) {
  const [paidAmount, setPaidAmount] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const paid = parseFloat(paidAmount) || 0
  const change = paid - total
  const isValid = paid >= total

  const handleConfirm = () => {
    if (!isValid) {
      alert('Jumlah bayar kurang dari total')
      return
    }
    onConfirm(paid, change)
  }

  // Quick amount buttons
  const quickAmounts = [
    Math.ceil(total / 10000) * 10000, // Round up to nearest 10k
    Math.ceil(total / 50000) * 50000, // Round up to nearest 50k
    Math.ceil(total / 100000) * 100000 // Round up to nearest 100k
  ].filter((amt, idx, arr) => arr.indexOf(amt) === idx) // Remove duplicates

  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Cash Payment</h2>

      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <p className="text-sm text-gray-600 mb-1">Total:</p>
        <p className="text-2xl font-bold text-blue-600">{formatCurrency(total)}</p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Bayar (Rp)</label>
        <input
          ref={inputRef}
          type="number"
          value={paidAmount}
          onChange={(e) => setPaidAmount(e.target.value)}
          className="w-full text-2xl p-4 border-2 border-gray-300 rounded-lg focus:border-blue-500"
          placeholder="0"
          min={total}
          step="1000"
        />
      </div>

      {/* Quick amount buttons */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {quickAmounts.map(amt => (
          <button
            key={amt}
            onClick={() => setPaidAmount(amt.toString())}
            className="bg-gray-100 hover:bg-gray-200 p-3 rounded text-sm font-medium"
          >
            {formatCurrency(amt)}
          </button>
        ))}
      </div>

      {/* Change display */}
      <div className={`p-4 rounded-lg mb-6 ${
        isValid ? 'bg-green-50 border-2 border-green-200' : 'bg-red-50 border-2 border-red-200'
      }`}>
        <p className="text-sm mb-1">Kembalian:</p>
        <p className={`text-3xl font-bold ${isValid ? 'text-green-600' : 'text-red-600'}`}>
          {isValid ? formatCurrency(change) : 'Kurang bayar'}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 border-2 border-gray-300 py-3 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={!isValid}
          className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
        >
          Confirm Payment
        </button>
      </div>
    </div>
  )
}

// components/pos/QRISPayment.tsx
function QRISPayment({
  total,
  onConfirm,
  onCancel
}: {
  total: number
  onConfirm: () => void
  onCancel: () => void
}) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">QRIS Payment</h2>

      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <p className="text-sm text-gray-600 mb-1">Total:</p>
        <p className="text-2xl font-bold text-blue-600">{formatCurrency(total)}</p>
      </div>

      {/* QR Code Display */}
      <div className="bg-white p-6 rounded-lg border-2 border-gray-300 mb-6">
        <div className="text-center mb-4">
          <p className="text-sm text-gray-600 mb-2">Scan QR Code untuk bayar:</p>
        </div>
        
        {/* Dummy QR Code - In production, generate dynamic QR */}
        <div className="flex justify-center mb-4">
          <div className="w-64 h-64 bg-gray-200 flex items-center justify-center rounded">
            <div className="text-center">
              <p className="text-4xl mb-2">📱</p>
              <p className="text-sm text-gray-600">QRIS QR Code</p>
              <p className="text-xs text-gray-500 mt-2">(Dummy untuk MVP)</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-500 text-center">
          Instruksi: Buka aplikasi mobile banking → Scan QR → Konfirmasi pembayaran
        </p>
      </div>

      {/* Manual Confirmation */}
      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-6">
        <p className="text-sm text-yellow-800">
          ⚠️ Setelah customer bayar via QRIS, klik "Pembayaran Berhasil" di bawah.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 border-2 border-gray-300 py-3 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            if (confirm('Pembayaran QRIS sudah berhasil?')) {
              onConfirm()
            }
          }}
          className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700"
        >
          Pembayaran Berhasil
        </button>
      </div>
    </div>
  )
}
```

#### PRD Reference
- **POS_PRD.md** Section 5.4 Payment Method

---

### **Story 5.2: Save Transaction to Database**

**As a** System  
**I want to** save transaction setelah payment confirmed  
**So that** data penjualan tercatat dengan lengkap

**Story Points**: 3

#### Acceptance Criteria
```
✅ Generate invoice number:
   - Format: INV-BRANCHCODE-YYYYMMDD-XXXX
   - Example: INV-SDM-20260418-0001
   - Auto-increment per day per branch

✅ Save to transactions table:
   - invoice_number
   - branch_id
   - shift_id (current open shift)
   - kasir_id (logged-in kasir)
   - customer_id (optional, NULL untuk retail)
   - transaction_date (NOW())
   - gross_amount (sum subtotal before discount)
   - discount_amount (0 untuk MVP)
   - net_amount (gross - discount)
   - total_cogs (from FIFO calculation Sprint 4)
   - payment_method (cash/qris)
   - payment_amount
   - change_amount
   - total_weight_kg (sum berat pesanan)
   - status ('completed')

✅ Save to transaction_items table (for each cart item):
   - product_id
   - uom_id
   - tier_name
   - qty
   - price (per unit)
   - subtotal (qty × price)
   - cogs_total (from FIFO)
   - batches_used (JSON, optional audit trail)

✅ Validation:
   - Must have open shift (cannot checkout tanpa shift)
   - Kasir must be logged in
   - Payment amount confirmed
   - FIFO COGS calculated (dari Sprint 4)

✅ Transaction atomicity:
   - Use database transaction
   - IF save failed → Rollback stock deduction (from Sprint 4)
   - All or nothing
```

#### Technical Tasks
- [ ] Implement invoice number generation
- [ ] Create transaction save function
- [ ] Use database transaction (atomic)
- [ ] Error handling & rollback
- [ ] Test transaction save

#### Invoice Generation
```typescript
// lib/pos/invoice.ts
export async function generateInvoiceNumber(
  branchCode: string
): Promise<string> {
  const today = new Date()
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '') // YYYYMMDD

  // Find last invoice for today at this branch
  const lastInvoice = await prisma.transactions.findFirst({
    where: {
      invoice_number: {
        startsWith: `INV-${branchCode}-${dateStr}`
      }
    },
    orderBy: {
      invoice_number: 'desc'
    }
  })

  let sequence = 1
  if (lastInvoice) {
    const lastSeq = parseInt(lastInvoice.invoice_number.split('-')[3])
    sequence = lastSeq + 1
  }

  return `INV-${branchCode}-${dateStr}-${sequence.toString().padStart(4, '0')}`
}

// Example: INV-SDM-20260418-0001
```

#### Save Transaction
```typescript
// lib/pos/save-transaction.ts
export async function saveTransaction(data: {
  cart: CartItem[]
  branchId: number
  shiftId: number
  kasirId: number
  paymentMethod: string
  paidAmount: number
  changeAmount: number
  totalCOGS: number
  totalWeight: number
  fifoResults: any[] // From Sprint 4 checkout
}) {
  return await prisma.$transaction(async (tx) => {
    // Get branch code
    const branch = await tx.branches.findUnique({
      where: { branch_id: data.branchId }
    })

    if (!branch) throw new Error('Branch not found')

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(branch.branch_code)

    // Calculate amounts
    const grossAmount = data.cart.reduce((sum, item) => sum + item.subtotal, 0)
    const discountAmount = 0 // MVP: no discount
    const netAmount = grossAmount - discountAmount

    // Create transaction
    const transaction = await tx.transactions.create({
      data: {
        invoice_number: invoiceNumber,
        branch_id: data.branchId,
        shift_id: data.shiftId,
        kasir_id: data.kasirId,
        customer_id: null, // MVP: no customer tracking
        transaction_date: new Date(),
        gross_amount: grossAmount,
        discount_amount: discountAmount,
        net_amount: netAmount,
        total_cogs: data.totalCOGS,
        payment_method: data.paymentMethod,
        payment_amount: data.paidAmount,
        change_amount: data.changeAmount,
        total_weight_kg: data.totalWeight,
        status: 'completed'
      }
    })

    // Create transaction items
    for (let i = 0; i < data.cart.length; i++) {
      const item = data.cart[i]
      const fifoResult = data.fifoResults[i]

      await tx.transaction_items.create({
        data: {
          transaction_id: transaction.transaction_id,
          product_id: item.product_id,
          uom_id: item.uom_id,
          tier_name: item.tier_name,
          qty: item.qty,
          price: item.price,
          subtotal: item.subtotal,
          cogs_total: fifoResult.totalCOGS,
          batches_used: JSON.stringify(fifoResult.batchesUsed)
        }
      })
    }

    return transaction
  })
}
```

#### PRD Reference
- **POS_PRD.md** Section 5.4.5 Save Transaction

---

### **Story 5.3: Print Receipt (Thermal 58mm/80mm)**

**As a** Kasir  
**I want to** print receipt setelah payment  
**So that** customer punya bukti pembelian

**Story Points**: 8

#### Acceptance Criteria
```
✅ Receipt content:
   Header:
   - Logo (optional)
   - Nama Toko: PETSHOP ABC
   - Cabang: Sudirman
   - Alamat: Jl. Sudirman No. 123
   - Phone: 021-12345678
   
   Transaction Info:
   - Date: 18/04/2026 14:30
   - Invoice: INV-SDM-20260418-0001
   - Kasir: Ahmad

   Items:
   - Product Name
   - Qty × UOM @ Price
   - Subtotal
   (Repeat for each item)

   Summary:
   - Subtotal: Rp X
   - Discount: Rp 0 (MVP)
   - TOTAL: Rp Y

   Payment:
   - Paid (Cash/QRIS): Rp Z
   - Change: Rp W (if cash)

   Footer:
   - Total Berat: X Kg
   - Thank you!
   - Points Earned: 0 (MVP, no loyalty yet)

✅ Receipt format support:
   - 58mm thermal printer
   - 80mm thermal printer
   - Plain text format (for compatibility)

✅ Print trigger:
   - Auto-print after payment confirmed (configurable)
   - Manual reprint option

✅ Print preview (optional):
   - Show receipt preview before print
   - Confirm print

✅ Error handling:
   - Printer not connected → Show error, allow manual reprint
   - Print failed → Retry option
```

#### Technical Tasks
- [ ] Create receipt template (plain text format)
- [ ] Implement thermal printer communication (ESC/POS commands)
- [ ] Create print function
- [ ] Handle 58mm vs 80mm width
- [ ] Test printing on actual thermal printer
- [ ] Fallback: Save receipt as PDF if printer unavailable

#### Receipt Template
```typescript
// lib/pos/receipt-template.ts
export function generateReceiptText(transaction: any, width: 58 | 80 = 58): string {
  const maxWidth = width === 58 ? 32 : 48 // Characters per line
  
  const center = (text: string) => {
    const padding = Math.max(0, Math.floor((maxWidth - text.length) / 2))
    return ' '.repeat(padding) + text
  }

  const line = (left: string, right: string) => {
    const spacing = maxWidth - left.length - right.length
    return left + ' '.repeat(Math.max(1, spacing)) + right
  }

  const divider = '='.repeat(maxWidth)

  let receipt = ''

  // Header
  receipt += center('PETSHOP ABC') + '\n'
  receipt += center(`Cabang ${transaction.branch.branch_name}`) + '\n'
  receipt += center(transaction.branch.address) + '\n'
  receipt += center(`Tel: ${transaction.branch.phone}`) + '\n'
  receipt += divider + '\n'

  // Transaction info
  receipt += line('Date:', new Date(transaction.transaction_date).toLocaleString('id-ID')) + '\n'
  receipt += line('Invoice:', transaction.invoice_number) + '\n'
  receipt += line('Kasir:', transaction.kasir.name) + '\n'
  receipt += divider + '\n'

  // Items
  transaction.items.forEach((item: any) => {
    receipt += `${item.product.product_name}\n`
    receipt += line(
      `${item.qty} ${item.product_uom.uom_name} @ ${formatCurrency(item.price)}`,
      formatCurrency(item.subtotal)
    ) + '\n'
  })
  receipt += divider + '\n'

  // Summary
  receipt += line('Subtotal:', formatCurrency(transaction.gross_amount)) + '\n'
  receipt += line('Discount:', formatCurrency(transaction.discount_amount)) + '\n'
  receipt += line('TOTAL:', formatCurrency(transaction.net_amount)) + '\n'
  receipt += divider + '\n'

  // Payment
  const paymentLabel = transaction.payment_method === 'cash' ? 'Cash' : 'QRIS'
  receipt += line(`Paid (${paymentLabel}):`, formatCurrency(transaction.payment_amount)) + '\n'
  
  if (transaction.payment_method === 'cash') {
    receipt += line('Change:', formatCurrency(transaction.change_amount)) + '\n'
  }
  receipt += divider + '\n'

  // Footer
  receipt += line('Total Berat:', `${transaction.total_weight_kg} Kg`) + '\n'
  receipt += '\n'
  receipt += center('Terima Kasih!') + '\n'
  receipt += center('Selamat Berbelanja Kembali') + '\n'
  receipt += '\n'

  return receipt
}
```

#### Print Function
```typescript
// lib/pos/print.ts
export async function printReceipt(transaction: any, printerWidth: 58 | 80 = 58) {
  const receiptText = generateReceiptText(transaction, printerWidth)

  try {
    // For web-based POS, use browser print API
    if (typeof window !== 'undefined') {
      const printWindow = window.open('', '', 'width=400,height=600')
      if (!printWindow) throw new Error('Popup blocked')

      printWindow.document.write('<html><head><title>Receipt</title>')
      printWindow.document.write('<style>')
      printWindow.document.write('body { font-family: monospace; white-space: pre; font-size: 12px; }')
      printWindow.document.write('</style></head><body>')
      printWindow.document.write(receiptText)
      printWindow.document.write('</body></html>')
      printWindow.document.close()
      
      printWindow.focus()
      printWindow.print()
      printWindow.close()

      return { success: true }
    }

    // For Electron-based POS, use thermal printer library
    // Example: node-thermal-printer
    // const printer = new ThermalPrinter({...})
    // printer.println(receiptText)
    // await printer.execute()

    return { success: true }
  } catch (error) {
    console.error('Print error:', error)
    return { success: false, error: error.message }
  }
}
```

#### PRD Reference
- **POS_PRD.md** Section 5.4.6 Print Receipt

---

### **Story 5.4: Surat Jalan (Delivery Order) Manual Trigger**

**As a** Kasir  
**I want to** cetak Surat Jalan setelah checkout (manual trigger)  
**So that** customer punya dokumen delivery jika perlu

**Story Points**: 5

#### Acceptance Criteria
```
✅ Trigger setelah checkout:
   - After print receipt
   - Show modal: "Cetak Surat Jalan?"
   - Options: Yes / No
   - IF Yes → Print DO
   - IF No → Skip

✅ DO content (A4 format):
   Header:
   - Logo
   - Nama Toko: PETSHOP ABC
   - Alamat lengkap
   - No. Surat Jalan: DO-[Invoice Number]
   
   Transaction Info:
   - Tanggal: [Date]
   - Invoice: [Invoice Number]
   - Customer: [Nama] (input manual if needed)
   - Alamat Pengiriman: [Address] (input manual)

   Items Table:
   | No | Product | Qty | UOM | Berat (Kg) |
   |----|---------|-----|-----|-----------|
   
   Footer:
   - Total Berat: X Kg
   - TTD Pengirim: ___________
   - TTD Penerima: ___________
   - Notes: [Optional]

✅ DO record:
   - Save to delivery_orders table
   - Link to transaction_id
   - Status: created / printed / delivered

✅ Print format:
   - A4 paper (210mm × 297mm)
   - PDF format (for easy print/save)
   - 3 copies indicator:
     * Copy 1: Customer
     * Copy 2: Toko (arsip)
     * Copy 3: Driver (optional)
```

#### Technical Tasks
- [ ] Create DO confirmation modal
- [ ] Create DO template (A4 PDF)
- [ ] Implement PDF generation (using libraries like pdfmake or react-pdf)
- [ ] Save DO record to database
- [ ] Print DO (A4 printer)
- [ ] Test DO printing

#### Component Example
```tsx
// components/pos/DOConfirmationModal.tsx
export default function DOConfirmationModal({
  transaction,
  onConfirm,
  onSkip
}: {
  transaction: any
  onConfirm: (customerInfo: { name: string, address: string, notes: string }) => void
  onSkip: () => void
}) {
  const [customerName, setCustomerName] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')

  const handleConfirm = () => {
    if (!customerName.trim()) {
      alert('Nama customer harus diisi')
      return
    }
    onConfirm({ name: customerName, address, notes })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Cetak Surat Jalan?</h2>
        
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Nama Customer *</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full border p-2 rounded"
              placeholder="Nama penerima"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Alamat Pengiriman</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full border p-2 rounded"
              rows={3}
              placeholder="Alamat lengkap pengiriman (optional)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Catatan (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border p-2 rounded"
              placeholder="Catatan tambahan"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onSkip}
            className="flex-1 border py-2 rounded hover:bg-gray-50"
          >
            Tidak, Skip
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            Ya, Cetak DO
          </button>
        </div>
      </div>
    </div>
  )
}
```

#### DO PDF Template (Simplified)
```typescript
// lib/pos/do-template.ts
import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'

pdfMake.vfs = pdfFonts.pdfMake.vfs

export function generateDOPDF(transaction: any, customerInfo: any) {
  const docDefinition = {
    content: [
      { text: 'SURAT JALAN', style: 'header', alignment: 'center' },
      { text: 'PETSHOP ABC', style: 'subheader', alignment: 'center' },
      { text: `Cabang ${transaction.branch.branch_name}`, alignment: 'center', margin: [0, 0, 0, 5] },
      { text: transaction.branch.address, alignment: 'center', fontSize: 10, margin: [0, 0, 0, 20] },
      
      { text: `No. Surat Jalan: DO-${transaction.invoice_number}`, margin: [0, 0, 0, 5] },
      { text: `Tanggal: ${new Date(transaction.transaction_date).toLocaleDateString('id-ID')}`, margin: [0, 0, 0, 5] },
      { text: `Invoice: ${transaction.invoice_number}`, margin: [0, 0, 0, 20] },
      
      { text: `Kepada Yth: ${customerInfo.name}`, bold: true, margin: [0, 0, 0, 5] },
      { text: `Alamat: ${customerInfo.address || '-'}`, margin: [0, 0, 0, 20] },
      
      // Items table
      {
        table: {
          headerRows: 1,
          widths: [30, '*', 50, 50, 60],
          body: [
            ['No', 'Product', 'Qty', 'UOM', 'Berat (Kg)'],
            ...transaction.items.map((item: any, idx: number) => [
              idx + 1,
              item.product.product_name,
              item.qty,
              item.product_uom.uom_name,
              (item.qty * item.product.weight_grams / 1000).toFixed(2)
            ])
          ]
        },
        margin: [0, 0, 0, 20]
      },
      
      { text: `Total Berat: ${transaction.total_weight_kg} Kg`, bold: true, margin: [0, 0, 0, 20] },
      
      {
        columns: [
          { text: 'TTD Pengirim:\n\n\n\n___________', width: '50%' },
          { text: 'TTD Penerima:\n\n\n\n___________', width: '50%' }
        ],
        margin: [0, 20, 0, 20]
      },
      
      { text: `Catatan: ${customerInfo.notes || '-'}`, fontSize: 10, italics: true }
    ],
    styles: {
      header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
      subheader: { fontSize: 14, bold: true }
    }
  }

  return pdfMake.createPdf(docDefinition)
}
```

#### PRD Reference
- **BACKOFFICE_PRD_6_OPERATIONS.md** Section 3.4 Delivery Order
- User requirement: Manual trigger setelah checkout

---

### **Story 5.5: Display Total Berat Pesanan**

**As a** Kasir  
**I want to** lihat total berat pesanan di layar, receipt, dan DO  
**So that** customer tahu berat total barang yang dibeli

**Story Points**: 5

#### Acceptance Criteria
```
✅ Calculate total weight:
   - Sum all items: Qty × Berat per product
   - Convert gram to Kg
   - Display in Kg (2 decimal places)

✅ Display locations:
   1. POS Checkout screen (real-time):
      - Di cart panel, below grand total
      - "Total Berat: X.XX Kg"
   
   2. Receipt (printed):
      - Di footer section
      - "Total Berat: X.XX Kg"
   
   3. Surat Jalan (DO):
      - Di summary section & items table
      - Per item berat + total berat

✅ Product weight required:
   - All products must have weight (gram) in master data
   - Validation: Cannot checkout jika ada product tanpa berat

✅ Weight accuracy:
   - Use product.weight_grams from database
   - Calculate: (qty × weight_grams) / 1000 = Kg
   - Round to 2 decimal places
```

#### Technical Tasks
- [ ] Add weight validation (product must have weight)
- [ ] Calculate total weight in cart
- [ ] Display weight in checkout screen
- [ ] Include weight in receipt template (Story 5.3)
- [ ] Include weight in DO template (Story 5.4)
- [ ] Test weight calculation

#### Weight Calculation
```typescript
// lib/pos/calculate-weight.ts
export function calculateTotalWeight(cart: CartItem[]): number {
  const totalGrams = cart.reduce((sum, item) => {
    const weightGrams = item.product_weight_grams || 0
    return sum + (item.qty * weightGrams)
  }, 0)

  const totalKg = totalGrams / 1000
  return Math.round(totalKg * 100) / 100 // Round to 2 decimal
}

// Validation
export function validateCartWeight(cart: CartItem[]): { valid: boolean, errors: string[] } {
  const errors: string[] = []

  cart.forEach(item => {
    if (!item.product_weight_grams || item.product_weight_grams <= 0) {
      errors.push(`Product "${item.product_name}" belum ada berat. Update master data dulu.`)
    }
  })

  return {
    valid: errors.length === 0,
    errors
  }
}
```

#### Display in Cart
```tsx
// Update Cart component
<div className="border-t pt-4 space-y-2">
  <div className="flex justify-between items-center">
    <span className="text-lg font-semibold">TOTAL:</span>
    <span className="text-2xl font-bold text-blue-600">
      {formatCurrency(cartTotal)}
    </span>
  </div>
  
  <div className="flex justify-between items-center text-sm text-gray-600">
    <span>Total Berat:</span>
    <span className="font-medium">{totalWeight.toFixed(2)} Kg</span>
  </div>

  <button className="w-full bg-blue-600 text-white py-4 rounded-lg">
    Checkout ({cart.length} items, {totalWeight.toFixed(2)} Kg)
  </button>
</div>
```

#### PRD Reference
- **BACKOFFICE_PRD_2_PRODUCTS.md** Section 3.1.1 (weight field)
- User requirement: Display berat di layar POS, receipt, DO

---

### **Story 5.6: Open Bill (Pending Transaction)**

**As a** Kasir  
**I want to** simpan transaksi sebagai pending (open bill)  
**So that** customer bisa lanjut belanja nanti atau ambil barang dulu

**Story Points**: 5

#### Acceptance Criteria
```
✅ Save as pending flow:
   - During checkout, add button "Simpan sebagai Open Bill"
   - Input customer info:
     * Nama customer (required)
     * Phone (optional)
   - Save transaction dengan status: 'pending'
   - Clear cart
   - Show success: "Open bill disimpan untuk [Nama]"

✅ View pending bills:
   - List page: "Open Bills"
   - Display: Invoice, Customer Name, Phone, Total, Created At
   - Sort by created_at DESC (newest first)
   - Search by customer name/phone

✅ Recall pending bill:
   - Click "Lanjutkan" button
   - Load cart dengan items dari pending bill
   - Continue to payment
   - Update status: 'pending' → 'completed'

✅ Auto-void after 24 hours:
   - Cron job check pending bills > 24 hours
   - Update status: 'pending' → 'void'
   - Restore stock (reverse FIFO deduction)
   - Send notification to kasir

✅ Validation:
   - Customer name required untuk open bill
   - Max 1 pending bill per customer (prevent duplicate)
   - Cannot edit pending bill (only recall & complete atau void)
```

#### Technical Tasks
- [ ] Create "Save as Open Bill" button & modal
- [ ] Save pending transaction (status: pending)
- [ ] Create Open Bills list page
- [ ] Implement recall pending bill
- [ ] Implement auto-void cron job (24 hours)
- [ ] Restore stock on void
- [ ] Test open bill flow

#### Component Example
```tsx
// components/pos/SaveAsOpenBillModal.tsx
export default function SaveAsOpenBillModal({
  cart,
  total,
  onSave,
  onCancel
}: {
  cart: CartItem[]
  total: number
  onSave: (customerInfo: { name: string, phone: string }) => void
  onCancel: () => void
}) {
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')

  const handleSave = () => {
    if (!customerName.trim()) {
      alert('Nama customer harus diisi')
      return
    }
    onSave({ name: customerName, phone })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Simpan sebagai Open Bill</h2>
        
        <div className="bg-blue-50 p-4 rounded mb-4">
          <p className="text-sm text-gray-600 mb-1">Total:</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(total)}</p>
          <p className="text-sm text-gray-600 mt-2">{cart.length} items</p>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Nama Customer *</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full border p-2 rounded"
              placeholder="Nama customer"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Phone (Optional)</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border p-2 rounded"
              placeholder="08xx-xxxx-xxxx"
            />
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 p-3 rounded mb-4">
          <p className="text-xs text-yellow-800">
            ⚠️ Open bill akan otomatis void setelah 24 jam jika tidak diselesaikan.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 border py-2 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            Simpan Open Bill
          </button>
        </div>
      </div>
    </div>
  )
}
```

#### Save Pending Transaction
```typescript
// lib/pos/save-pending.ts
export async function savePendingTransaction(data: {
  cart: CartItem[]
  branchId: number
  shiftId: number
  kasirId: number
  customerName: string
  customerPhone?: string
  totalWeight: number
}) {
  // Check existing pending bill untuk customer ini
  const existing = await prisma.transactions.findFirst({
    where: {
      status: 'pending',
      customer_phone: data.customerPhone
    }
  })

  if (existing) {
    throw new Error('Customer ini sudah punya open bill. Selesaikan dulu.')
  }

  // Generate invoice number
  const branch = await prisma.branches.findUnique({
    where: { branch_id: data.branchId }
  })
  const invoiceNumber = await generateInvoiceNumber(branch!.branch_code)

  // Calculate amounts
  const grossAmount = data.cart.reduce((sum, item) => sum + item.subtotal, 0)

  // Create pending transaction
  const transaction = await prisma.transactions.create({
    data: {
      invoice_number: invoiceNumber,
      branch_id: data.branchId,
      shift_id: data.shiftId,
      kasir_id: data.kasirId,
      customer_name: data.customerName,
      customer_phone: data.customerPhone,
      transaction_date: new Date(),
      gross_amount: grossAmount,
      discount_amount: 0,
      net_amount: grossAmount,
      total_cogs: 0, // Will calculate on complete
      payment_method: null,
      payment_amount: null,
      change_amount: null,
      total_weight_kg: data.totalWeight,
      status: 'pending'
    }
  })

  // Create transaction items
  for (const item of data.cart) {
    await prisma.transaction_items.create({
      data: {
        transaction_id: transaction.transaction_id,
        product_id: item.product_id,
        uom_id: item.uom_id,
        tier_name: item.tier_name,
        qty: item.qty,
        price: item.price,
        subtotal: item.subtotal,
        cogs_total: 0 // Will calculate on complete
      }
    })
  }

  return transaction
}
```

#### PRD Reference
- **POS_PRD.md** Section 5.4.4 Pending Transaction (Open Bill)
- User requirement: Opsi B - Pending transaction

---

## 📊 SPRINT 5 SUMMARY

### Story Points Breakdown
| Story | Points | Assignee Suggestion |
|-------|--------|---------------------|
| 5.1 Payment Method (Cash & QRIS) | 5 | Dev 1 |
| 5.2 Save Transaction | 3 | Dev 2 |
| 5.3 Print Receipt | 8 | Dev 1 |
| 5.4 Surat Jalan (DO) | 5 | Dev 2 |
| 5.5 Display Berat Pesanan | 5 | Dev 1 |
| 5.6 Open Bill | 5 | Dev 2 (+ Dev 1 support) |
| **TOTAL** | **30** | |

### Definition of Done
```
✅ Payment flow (Cash & QRIS) working
✅ Transaction saved to database
✅ Receipt printing working (thermal 58mm/80mm)
✅ DO printing working (A4 PDF)
✅ Total berat displayed di layar, receipt, DO
✅ Open bill (pending transaction) working
✅ Auto-void pending bill after 24h working
✅ Code reviewed & merged
✅ Manual testing completed
✅ No critical bugs
```

### Sprint Deliverables
1. ✅ Complete checkout flow (payment to receipt)
2. ✅ Cash & QRIS payment working
3. ✅ Transaction saved dengan FIFO COGS
4. ✅ Receipt printing (thermal)
5. ✅ DO printing (A4)
6. ✅ Total berat pesanan displayed
7. ✅ Open bill feature working

---

## 🧪 TESTING CHECKLIST

### Functional Testing
- [ ] Cash payment: Input Rp 150k untuk total Rp 100k → Kembalian Rp 50k
- [ ] Cash payment: Input Rp 50k untuk total Rp 100k → Error "Kurang bayar"
- [ ] QRIS payment: Confirm payment → Transaction saved
- [ ] Receipt print → Content correct, 58mm format
- [ ] DO print → Customer info correct, berat correct
- [ ] Open bill: Save → Recall → Complete → Status updated
- [ ] Open bill auto-void: Create pending > 24h ago → Cron void → Stock restored

### Integration Testing
- [ ] Full flow: Checkout → Payment (Cash) → Save → Print receipt → Print DO
- [ ] Full flow: Checkout → Save as open bill → Recall → Payment → Complete
- [ ] Weight calculation: 2 items (1kg + 2kg) → Total 3.00 Kg

---

## 🚨 RISKS & MITIGATIONS

| Risk | Impact | Mitigation |
|------|--------|------------|
| Printer tidak terdeteksi | MEDIUM | Fallback: Save as PDF, Manual reprint option |
| DO PDF generation slow | LOW | Optimize PDF template, Show loading indicator |
| Open bill stock conflict | MEDIUM | Lock stock on pending, Restore on void |
| QRIS manual confirm prone to error | MEDIUM | Clear UI, Confirmation dialog |

---

## 📝 NOTES FOR NEXT SPRINT

**Sprint 6 Dependencies:**
- Transaction dari Sprint 5 → Sprint 6 akan aggregate untuk settlement
- Payment method dari Sprint 5 → Sprint 6 settlement breakdown
- Shift from Sprint 1 → Sprint 6 close shift after settlement

---

**Last Updated**: 18 April 2026  
**Sprint Status**: 🔴 Not Started  
**Previous Sprint**: MVP_SPRINT_4_POS_PENJUALAN_FIFO.md  
**Next Sprint**: MVP_SPRINT_6_SHIFT_SETTLEMENT.md
