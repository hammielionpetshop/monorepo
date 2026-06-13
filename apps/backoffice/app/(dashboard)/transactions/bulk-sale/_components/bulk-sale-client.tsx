'use client'

import { createRef, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReceiptPrint from '@/components/pos/receipt-print'
import type { CartItem } from '@/components/pos/cart-store'
import { calculateBulkSaleTotals, calculateRowSubtotal } from './bulk-sale-calculations'
import BulkSaleDeliveryNotePrint from './bulk-sale-delivery-note-print'
import BulkSaleItemRow from './bulk-sale-item-row'
import type { BulkSaleProduct, BulkSaleRow } from './types'

type CurrentUser = {
  userId: number
  userName: string
  branchId: number
  branchName: string
  role: string
}

type BranchOption = {
  id: number
  name: string
  code: string
}

type PaymentMethodOption = {
  id: number
  name: string
  type: string
}

type CustomerOption = {
  id: number
  name: string
  phone: string | null
}

type TransactionResponse = {
  transactionNumber?: string
  id?: number
}

type PrintMode = 'receipt' | 'delivery-note'

type PrintableBulkSale = {
  transactionNumber: string
  transactionDate: Date
  branchName: string
  customerName: string
  paymentMethodName: string
  cashierName: string
  amountPaid: number
  change: number
  discountTotal: number
  grandTotal: number
  items: BulkSaleRow[]
}

type BulkSaleClientProps = {
  currentUser: CurrentUser
  branches: BranchOption[]
  paymentMethods: PaymentMethodOption[]
}

let nextRowId = 1

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function parseCustomer(value: unknown): CustomerOption | null {
  if (!isRecord(value) || typeof value.id !== 'number' || typeof value.name !== 'string') return null
  return { id: value.id, name: value.name, phone: readString(value.phone) }
}

function parseCustomerList(value: unknown) {
  if (Array.isArray(value)) return value.map(parseCustomer).filter((customer): customer is CustomerOption => customer !== null)
  if (isRecord(value) && Array.isArray(value.customers)) {
    return value.customers.map(parseCustomer).filter((customer): customer is CustomerOption => customer !== null)
  }
  return []
}

function parseProductList(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.products)) return []
  return value.products.filter((product): product is BulkSaleProduct => {
    if (!isRecord(product)) return false
    return (
      typeof product.id === 'number' &&
      typeof product.code === 'string' &&
      typeof product.name === 'string' &&
      typeof product.baseUomId === 'number' &&
      typeof product.baseUomCode === 'string' &&
      typeof product.stock === 'number' &&
      Array.isArray(product.availableUoms) &&
      Array.isArray(product.prices)
    )
  })
}

function integerFromInput(value: string) {
  const parsed = parseInt(value.replace(/\D/g, ''), 10)
  return Number.isNaN(parsed) ? 0 : parsed
}

function formatCurrency(value: number) {
  return value.toLocaleString('id-ID')
}

function readTransactionNumber(transaction: Record<string, unknown>) {
  return (
    readString(transaction.trxNumber) ??
    readString(transaction.transactionNumber) ??
    readString(transaction.transactionNo) ??
    undefined
  )
}

function toReceiptItems(items: BulkSaleRow[]): CartItem[] {
  return items.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    uomId: item.uomId,
    uomCode: item.uomCode,
    qty: item.qty,
    unitPrice: String(item.unitPrice),
    priceTier: item.priceTier,
    discountAmount: String(item.discountAmount),
    subtotal: String(item.subtotal),
  }))
}

function clonePrintableRows(items: BulkSaleRow[]): BulkSaleRow[] {
  return items.map((item) => ({
    ...item,
    availableUoms: item.availableUoms.map((uom) => ({ ...uom })),
    availablePrices: item.availablePrices.map((price) => ({ ...price })),
  }))
}

function formatPrintDate(date: Date) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export default function BulkSaleClient({ currentUser, branches, paymentMethods }: BulkSaleClientProps) {
  const [branchId, setBranchId] = useState(currentUser.branchId)
  const [paymentMethodId, setPaymentMethodId] = useState(paymentMethods[0]?.id ?? 0)
  const [amountPaid, setAmountPaid] = useState(0)
  const [isCredit, setIsCredit] = useState(false)
  const [dueAt, setDueAt] = useState('')
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null)
  const [productQuery, setProductQuery] = useState('')
  const [productResults, setProductResults] = useState<BulkSaleProduct[]>([])
  const [isSearchingProducts, setIsSearchingProducts] = useState(false)
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false)
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [productHighlightIndex, setProductHighlightIndex] = useState(0)
  const [customerHighlightIndex, setCustomerHighlightIndex] = useState(0)
  const [rows, setRows] = useState<BulkSaleRow[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [transactionResponse, setTransactionResponse] = useState<TransactionResponse | null>(null)
  const [printableBulkSale, setPrintableBulkSale] = useState<PrintableBulkSale | null>(null)
  const [activePrintMode, setActivePrintMode] = useState<PrintMode | null>(null)

  const productSearchRef = useRef<HTMLInputElement>(null)
  const customerSearchRef = useRef<HTMLInputElement>(null)
  const productDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const customerDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const qtyRefs = useRef<Map<string, React.RefObject<HTMLInputElement | null>>>(new Map())
  const productDropdownRefs = useRef<(HTMLButtonElement | null)[]>([])
  const customerDropdownRefs = useRef<(HTMLButtonElement | null)[]>([])

  const canChangeBranch = ['OWNER', 'GM'].includes(currentUser.role)
  const totals = useMemo(() => calculateBulkSaleTotals(rows, amountPaid), [amountPaid, rows])
  const receiptItems = useMemo(() => toReceiptItems(printableBulkSale?.items ?? []), [printableBulkSale])

  function resetBranchScopedState() {
    setRows([])
    setProductQuery('')
    setProductResults([])
    setShowProductDropdown(false)
    setProductHighlightIndex(0)
    setSelectedCustomer(null)
    setCustomerQuery('')
    setCustomerResults([])
    setShowCustomerDropdown(false)
    setCustomerHighlightIndex(0)
    setAmountPaid(0)
    setIsCredit(false)
    setDueAt('')
    setSuccessMsg('')
    setErrorMsg('')
    setTransactionResponse(null)
    setPrintableBulkSale(null)
    setActivePrintMode(null)
  }

  useEffect(() => {
    if (!successMsg) return
    const timeoutId = setTimeout(() => setSuccessMsg(''), 3000)
    return () => clearTimeout(timeoutId)
  }, [successMsg])

  useEffect(() => {
    if (!errorMsg) return
    const timeoutId = setTimeout(() => setErrorMsg(''), 5000)
    return () => clearTimeout(timeoutId)
  }, [errorMsg])

  useEffect(() => {
    productDropdownRefs.current[productHighlightIndex]?.scrollIntoView({ block: 'nearest' })
  }, [productHighlightIndex])

  useEffect(() => {
    customerDropdownRefs.current[customerHighlightIndex]?.scrollIntoView({ block: 'nearest' })
  }, [customerHighlightIndex])

  const searchProducts = useCallback(async (query: string, selectedBranchId: number) => {
    if (!query.trim() || !selectedBranchId) {
      setProductResults([])
      setShowProductDropdown(false)
      return
    }

    setIsSearchingProducts(true)
    try {
      const response = await fetch(
        `/api/bo/bulk-sale-products?branchId=${selectedBranchId}&search=${encodeURIComponent(query)}&limit=8`,
      )
      const data: unknown = await response.json()
      setProductResults(response.ok ? parseProductList(data) : [])
      setProductHighlightIndex(0)
      setShowProductDropdown(true)
    } catch {
      setProductResults([])
      setShowProductDropdown(false)
    } finally {
      setIsSearchingProducts(false)
    }
  }, [])

  const searchCustomers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setCustomerResults([])
      setShowCustomerDropdown(false)
      return
    }

    setIsSearchingCustomers(true)
    try {
      const response = await fetch(`/api/customers?q=${encodeURIComponent(query)}&limit=8`)
      const data: unknown = await response.json()
      setCustomerResults(response.ok ? parseCustomerList(data) : [])
      setCustomerHighlightIndex(0)
      setShowCustomerDropdown(true)
    } catch {
      setCustomerResults([])
      setShowCustomerDropdown(false)
    } finally {
      setIsSearchingCustomers(false)
    }
  }, [])

  useEffect(() => {
    if (productDebounceRef.current) clearTimeout(productDebounceRef.current)
    productDebounceRef.current = setTimeout(() => searchProducts(productQuery, branchId), 300)
    return () => {
      if (productDebounceRef.current) clearTimeout(productDebounceRef.current)
    }
  }, [branchId, productQuery, searchProducts])

  useEffect(() => {
    if (customerDebounceRef.current) clearTimeout(customerDebounceRef.current)
    customerDebounceRef.current = setTimeout(() => searchCustomers(customerQuery), 300)
    return () => {
      if (customerDebounceRef.current) clearTimeout(customerDebounceRef.current)
    }
  }, [customerQuery, searchCustomers])

  function addProduct(product: BulkSaleProduct) {
    const basePrice = product.prices.find((price) => price.uomId === product.baseUomId) ?? product.prices[0]
    if (!basePrice) {
      setErrorMsg(`Harga untuk ${product.name} belum tersedia`)
      return
    }

    const id = String(nextRowId++)
    const ref = createRef<HTMLInputElement>()
    qtyRefs.current.set(id, ref)
    const qty = 1
    const discountAmount = 0
    const unitPrice = basePrice.price
    const row: BulkSaleRow = {
      id,
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      uomId: basePrice.uomId,
      uomCode: product.availableUoms.find((uom) => uom.uomId === basePrice.uomId)?.uomCode ?? product.baseUomCode,
      availableUoms: product.availableUoms,
      priceTier: basePrice.priceTier,
      availablePrices: product.prices,
      qty,
      unitPrice,
      discountAmount,
      subtotal: calculateRowSubtotal({ qty, unitPrice, discountAmount }),
    }

    setRows((previous) => [...previous, row])
    setProductQuery('')
    setProductResults([])
    setShowProductDropdown(false)
    setTimeout(() => {
      ref.current?.focus()
      ref.current?.select()
    }, 50)
  }

  function handleProductKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!showProductDropdown || productResults.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setProductHighlightIndex((index) => Math.min(index + 1, productResults.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setProductHighlightIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const product = productResults[productHighlightIndex]
      if (product) addProduct(product)
    } else if (event.key === 'Escape') {
      setShowProductDropdown(false)
    }
  }

  function handleCustomerKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!showCustomerDropdown || customerResults.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setCustomerHighlightIndex((index) => Math.min(index + 1, customerResults.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setCustomerHighlightIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const customer = customerResults[customerHighlightIndex]
      if (customer) selectCustomer(customer)
    } else if (event.key === 'Escape') {
      setShowCustomerDropdown(false)
    }
  }

  function selectCustomer(customer: CustomerOption) {
    setSelectedCustomer(customer)
    setCustomerQuery(customer.name)
    setCustomerResults([])
    setShowCustomerDropdown(false)
    setTimeout(() => productSearchRef.current?.focus(), 50)
  }

  async function submitBulkSale() {
    if (!selectedCustomer) {
      setErrorMsg('Pilih customer terlebih dahulu')
      customerSearchRef.current?.focus()
      return
    }
    if (!paymentMethodId) {
      setErrorMsg('Pilih metode pembayaran')
      return
    }
    if (rows.length === 0) {
      setErrorMsg('Tambahkan minimal satu produk')
      productSearchRef.current?.focus()
      return
    }
    if (rows.some((row) => row.qty <= 0 || row.unitPrice <= 0 || row.subtotal <= 0)) {
      setErrorMsg('Pastikan qty, harga, dan subtotal semua item valid')
      return
    }
    if (isCredit) {
      if (amountPaid >= totals.grandTotal) {
        setErrorMsg('Penjualan kredit: uang muka (DP) harus kurang dari total transaksi')
        return
      }
    } else if (amountPaid < totals.grandTotal) {
      setErrorMsg('Jumlah bayar kurang dari total transaksi')
      return
    }

    setIsSubmitting(true)
    setErrorMsg('')
    try {
      const response = await fetch('/api/bo/bulk-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          customerId: selectedCustomer.id,
          paymentMethodId,
          amountPaid,
          change: totals.change,
          isCredit,
          dueAt: isCredit ? (dueAt || null) : null,
          items: rows.map((row) => ({
            productId: row.productId,
            productName: row.productName,
            uomId: row.uomId,
            uomCode: row.uomCode,
            qty: row.qty,
            unitPrice: row.unitPrice,
            priceTier: row.priceTier,
            discountAmount: row.discountAmount,
            subtotal: row.subtotal,
          })),
          totals: {
            subtotal: totals.subtotal,
            discountTotal: totals.discountTotal,
            grandTotal: totals.grandTotal,
            itemCount: totals.itemCount,
          },
        }),
      })
      const data: unknown = await response.json()

      if (!response.ok) {
        setErrorMsg(isRecord(data) && typeof data.error === 'string' ? data.error : 'Gagal membuat bulk sale')
        return
      }

      const transaction = isRecord(data) ? data : {}
      const transactionNumber = readTransactionNumber(transaction)
      const transactionDate = new Date()
      const selectedBranchName = branches.find((branch) => branch.id === branchId)?.name ?? currentUser.branchName
      const selectedPaymentMethodName = paymentMethods.find((method) => method.id === paymentMethodId)?.name ?? '-'
      setTransactionResponse({
        id: typeof transaction.id === 'number' ? transaction.id : undefined,
        transactionNumber,
      })
      if (transactionNumber) {
        setPrintableBulkSale({
          transactionNumber,
          transactionDate,
          branchName: selectedBranchName,
          customerName: selectedCustomer.name,
          paymentMethodName: selectedPaymentMethodName,
          cashierName: currentUser.userName,
          amountPaid,
          change: totals.change,
          discountTotal: totals.discountTotal,
          grandTotal: totals.grandTotal,
          items: clonePrintableRows(rows),
        })
      } else {
        setPrintableBulkSale(null)
      }
      setActivePrintMode(null)
      setSuccessMsg(isCredit ? 'Transaksi kredit berhasil dibuat, hutang dicatat' : 'Transaksi bulk sale berhasil dibuat')
      setRows([])
      setAmountPaid(0)
      setIsCredit(false)
      setDueAt('')
      setSelectedCustomer(null)
      setCustomerQuery('')
      setProductQuery('')
      setTimeout(() => customerSearchRef.current?.focus(), 50)
    } catch {
      setErrorMsg('Terjadi kesalahan. Coba lagi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function printBulkSale(mode: PrintMode) {
    setActivePrintMode(mode)
    setTimeout(() => window.print(), 50)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Bulk Sale</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Buat transaksi penjualan grosir dengan pencarian produk cepat.
        </p>
      </div>

      {successMsg && (
        <div role="status" aria-live="polite" className="bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded-md text-sm">
          {successMsg}
          {transactionResponse?.transactionNumber ? ` (${transactionResponse.transactionNumber})` : ''}
        </div>
      )}

      {transactionResponse?.transactionNumber && printableBulkSale && (
        <div className="flex flex-wrap gap-2 rounded-md border border-border bg-card px-3 py-2">
          <button
            type="button"
            onClick={() => printBulkSale('receipt')}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
          >
            Cetak Struk
          </button>
          <button
            type="button"
            onClick={() => printBulkSale('delivery-note')}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
          >
            Cetak Surat Jalan
          </button>
        </div>
      )}

      {errorMsg && (
        <div role="alert" aria-live="assertive" className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md text-sm">
          {errorMsg}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">Cabang</label>
          {canChangeBranch ? (
            <select
              value={branchId}
              onChange={(event) => {
                setBranchId(parseInt(event.target.value, 10))
                resetBranchScopedState()
              }}
              disabled={isSubmitting}
              className="w-full border border-border rounded-md px-2.5 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="border border-border rounded-md px-2.5 py-1.5 text-sm bg-muted/30 text-foreground">
              {currentUser.branchName}
            </div>
          )}
        </div>

        <div className="relative">
          <label className="mb-1 block text-xs font-medium text-foreground">Customer</label>
          <input
            ref={customerSearchRef}
            value={customerQuery}
            onChange={(event) => {
              setCustomerQuery(event.target.value)
              setSelectedCustomer(null)
            }}
            onKeyDown={handleCustomerKeyDown}
            onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
            onFocus={() => customerResults.length > 0 && setShowCustomerDropdown(true)}
            disabled={isSubmitting}
            placeholder="Cari nama atau telepon customer..."
            className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
          />
          {isSearchingCustomers && <div className="absolute right-3 top-8 text-xs text-muted-foreground">Mencari...</div>}
          {showCustomerDropdown && customerResults.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-card shadow-lg">
              {customerResults.map((customer, index) => (
                <li key={customer.id}>
                  <button
                    ref={(element) => {
                      customerDropdownRefs.current[index] = element
                    }}
                    type="button"
                    onMouseDown={() => selectCustomer(customer)}
                    className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                      index === customerHighlightIndex ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <div className="font-medium truncate">{customer.name}</div>
                    <div className={`text-xs ${index === customerHighlightIndex ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {customer.phone ?? 'Tanpa nomor telepon'}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">Metode Pembayaran</label>
          <select
            value={paymentMethodId}
            onChange={(event) => setPaymentMethodId(parseInt(event.target.value, 10))}
            disabled={isSubmitting || paymentMethods.length === 0}
            className="w-full border border-border rounded-md px-2.5 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
          >
            {paymentMethods.map((method) => (
              <option key={method.id} value={method.id}>
                {method.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="relative">
        <label className="mb-1 block text-xs font-medium text-foreground">Cari Produk</label>
        <input
          ref={productSearchRef}
          value={productQuery}
          onChange={(event) => setProductQuery(event.target.value)}
          onKeyDown={handleProductKeyDown}
          onBlur={() => setTimeout(() => setShowProductDropdown(false), 150)}
          onFocus={() => productResults.length > 0 && setShowProductDropdown(true)}
          disabled={isSubmitting}
          placeholder="Nama, SKU, atau barcode produk..."
          className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
        />
        {isSearchingProducts && <div className="absolute right-3 top-8 text-xs text-muted-foreground">Mencari...</div>}
        {showProductDropdown && productResults.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-card shadow-lg">
            {productResults.map((product, index) => (
              <li key={product.id}>
                <button
                  ref={(element) => {
                    productDropdownRefs.current[index] = element
                  }}
                  type="button"
                  onMouseDown={() => addProduct(product)}
                  className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                    index === productHighlightIndex ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted/50'
                  }`}
                >
                  <div className="font-medium truncate">{product.name}</div>
                  <div className={`text-xs ${index === productHighlightIndex ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {product.code} | Stok {product.stock.toLocaleString('id-ID')} {product.baseUomCode}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {showProductDropdown && !isSearchingProducts && productResults.length === 0 && productQuery.trim() && (
          <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground shadow-lg">
            Produk tidak ditemukan
          </div>
        )}
      </div>

      {rows.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Produk</th>
                <th className="w-20 px-2 py-2.5 text-center text-xs font-medium text-muted-foreground">Qty</th>
                <th className="w-24 px-2 py-2.5 text-center text-xs font-medium text-muted-foreground">UOM</th>
                <th className="w-28 px-2 py-2.5 text-center text-xs font-medium text-muted-foreground">Tier</th>
                <th className="w-28 px-2 py-2.5 text-right text-xs font-medium text-muted-foreground">Harga</th>
                <th className="w-28 px-2 py-2.5 text-right text-xs font-medium text-muted-foreground">Diskon</th>
                <th className="w-32 px-2 py-2.5 text-right text-xs font-medium text-muted-foreground">Subtotal</th>
                <th className="w-10 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const ref = qtyRefs.current.get(row.id) ?? createRef<HTMLInputElement>()
                if (!qtyRefs.current.has(row.id)) qtyRefs.current.set(row.id, ref)
                return (
                  <BulkSaleItemRow
                    key={row.id}
                    ref={ref}
                    row={row}
                    onChange={(nextRow) => setRows((previous) => previous.map((item) => (item.id === row.id ? nextRow : item)))}
                    onRemove={() => {
                      qtyRefs.current.delete(row.id)
                      setRows((previous) => previous.filter((item) => item.id !== row.id))
                      setTimeout(() => productSearchRef.current?.focus(), 50)
                    }}
                    onLastFieldTab={() => {
                      const nextRow = rows[index + 1]
                      if (nextRow) setTimeout(() => qtyRefs.current.get(nextRow.id)?.current?.focus(), 50)
                      else setTimeout(() => productSearchRef.current?.focus(), 50)
                    }}
                    disabled={isSubmitting}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          Belum ada produk. Gunakan kolom pencarian produk untuk menambahkan item penjualan.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-[1fr_320px]">
        <div className="text-xs text-muted-foreground">
          {rows.length} produk | {totals.itemCount} total qty
        </div>
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span>Rp {formatCurrency(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Total Diskon</span>
            <span>Rp {formatCurrency(totals.discountTotal)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold text-foreground">
            <span>Grand Total</span>
            <span>Rp {formatCurrency(totals.grandTotal)}</span>
          </div>
          <label className="flex items-center gap-2 border-t border-border pt-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={isCredit}
              onChange={(event) => {
                setIsCredit(event.target.checked)
                if (event.target.checked) setAmountPaid(0)
                else setDueAt('')
              }}
              disabled={isSubmitting}
              className="h-4 w-4 rounded border-border"
            />
            Penjualan Kredit (Hutang)
          </label>
          {isCredit && (
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Jatuh Tempo</label>
              <input
                type="date"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              {isCredit ? 'Uang Muka (DP)' : 'Jumlah Bayar'}
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={amountPaid === 0 ? '' : String(amountPaid)}
              onChange={(event) => setAmountPaid(integerFromInput(event.target.value))}
              onFocus={(event) => event.target.select()}
              placeholder="0"
              disabled={isSubmitting}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-right text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
          </div>
          {isCredit ? (
            <div className="flex justify-between text-sm font-semibold text-yellow-700">
              <span>Sisa Hutang</span>
              <span>Rp {formatCurrency(Math.max(0, totals.grandTotal - amountPaid))}</span>
            </div>
          ) : (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Kembali</span>
              <span>Rp {formatCurrency(Math.max(0, totals.change))}</span>
            </div>
          )}
          <button
            type="button"
            onClick={submitBulkSale}
            disabled={isSubmitting || rows.length === 0}
            className="w-full rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? 'Menyimpan...' : 'Simpan Bulk Sale'}
          </button>
        </div>
      </div>
      {printableBulkSale && activePrintMode === 'receipt' && (
        <ReceiptPrint
          receiptNumber={printableBulkSale.transactionNumber}
          items={receiptItems}
          grandTotal={String(printableBulkSale.grandTotal)}
          amountPaid={String(printableBulkSale.amountPaid)}
          kembalian={String(printableBulkSale.change)}
          paymentMethodName={printableBulkSale.paymentMethodName}
          branchName={printableBulkSale.branchName}
          transactionDate={printableBulkSale.transactionDate}
          cashierName={printableBulkSale.cashierName}
          discountAmount={String(printableBulkSale.discountTotal)}
          customerName={printableBulkSale.customerName}
        />
      )}

      {printableBulkSale && activePrintMode === 'delivery-note' && (
        <BulkSaleDeliveryNotePrint
          transactionNumber={printableBulkSale.transactionNumber}
          transactionDate={formatPrintDate(printableBulkSale.transactionDate)}
          branchName={printableBulkSale.branchName}
          customerName={printableBulkSale.customerName}
          items={printableBulkSale.items}
        />
      )}
    </div>
  )
}
