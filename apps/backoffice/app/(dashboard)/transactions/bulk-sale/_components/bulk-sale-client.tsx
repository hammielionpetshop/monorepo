'use client'

import { createRef, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatWIB } from '@petshop/shared'
import ReceiptPrint from '@/components/pos/receipt-print'
import type { CartItem } from '@/components/pos/cart-store'
import { OrderPreviewModal } from '@/components/pos/cart-preview-modal'
import type { PreviewItem } from '@/components/pos/cart-preview-text'
import { allocateTransactionDiscount, calculateBulkSaleTotals, calculateRowSubtotal } from './bulk-sale-calculations'
import BulkSaleDeliveryNotePrint from './bulk-sale-delivery-note-print'
import DeliveryNoteImageExport from './delivery-note-image-export'
import BulkSaleDraftsDrawer from './bulk-sale-drafts-drawer'
import BulkSaleHoldDialog from './bulk-sale-hold-dialog'
import BulkSaleItemRow from './bulk-sale-item-row'
import BulkSaleProductPicker from './bulk-sale-product-picker'
import BulkSaleTierDialog from './bulk-sale-tier-dialog'
import BulkSaleReviewDialog from './bulk-sale-review-dialog'
import {
  internalRetailWarning,
  pickDefaultPriceOption,
  pickInternalDefaultPriceOption,
  pickInternalTierPrice,
  pickTierPrice,
  pricesForUom,
} from './bulk-sale-pricing'
import { applyTierToRows, incrementRowQty, isSameLine, mergeDuplicateRows } from './bulk-sale-rows'
import { resolvePickChoice, type BulkSalePickChoice } from './bulk-sale-pick-choice'
import { describeStockShortage, findStockShortages, type BulkSaleStockInfo } from './bulk-sale-stock'
import {
  createBulkSaleDraft,
  deleteBulkSaleDraft,
  draftToDeliveryNote,
  fetchBulkSaleDrafts,
  type BulkSaleDraft,
} from './bulk-sale-drafts'
import type { BulkSaleProduct, BulkSaleRow } from './types'
import { describeQzError, printDeliveryNoteViaQz, type DeliveryNoteData } from '@/lib/qz-print'
import { printReceipt, type ReceiptSource } from '@/lib/print-receipt'
import ReceiptImageExport from '../../_components/receipt-image-export'
import { CLONE_NOT_ALLOWED_MESSAGE, canCloneTransaction } from '../../_components/clone-rules'
import { formatRupiahInput } from '@/lib/number-input'
import { lastBulkPriceKey, parseLastBulkPrices, type LastBulkPrice } from './bulk-sale-last-price'

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
  receiptName: string
  address: string | null
  phone: string | null
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
  // Disalin saat transaksi terbit, bukan dibaca ulang dari dropdown: mengganti pilihan
  // cabang setelah nota jadi tidak boleh mengubah kop struk yang sudah terbit.
  storeName: string
  storeAddress: string | null
  storePhone: string | null
  customerName: string
  customerPhone: string | null
  customerAddress: string | null
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
    tierPrices: { [item.priceTier]: String(item.unitPrice) },
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
  return formatWIB(date, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type IbtPrefillInfo = {
  id: number
  ibtNumber: string
  destinationBranchName: string | null
}

type IbtDetailResponse = {
  id: number
  ibtNumber: string
  sourceBranchId: number
  destinationBranchId: number
  destinationBranchName: string | null
  destinationCustomerId: number | null
  destinationCustomerName: string | null
  destinationCustomerDefaultTierType: string | null
  status: string
  convertedTransactionId: number | null
  items: {
    productId: number
    productName: string | null
    uomId: number
    qtyRequested: number
  }[]
}

function parseIbtDetail(value: unknown): IbtDetailResponse | null {
  if (!isRecord(value) || typeof value.id !== 'number' || typeof value.sourceBranchId !== 'number') return null
  if (!Array.isArray(value.items)) return null
  const items = value.items
    .filter(isRecord)
    .filter((item) => typeof item.productId === 'number' && typeof item.uomId === 'number' && typeof item.qtyRequested === 'number')
    .map((item) => ({
      productId: item.productId as number,
      productName: readString(item.productName),
      uomId: item.uomId as number,
      qtyRequested: item.qtyRequested as number,
    }))
  return {
    id: value.id,
    ibtNumber: readString(value.ibtNumber) ?? String(value.id),
    sourceBranchId: value.sourceBranchId,
    destinationBranchId: typeof value.destinationBranchId === 'number' ? value.destinationBranchId : 0,
    destinationBranchName: readString(value.destinationBranchName),
    destinationCustomerId: typeof value.destinationCustomerId === 'number' ? value.destinationCustomerId : null,
    destinationCustomerName: readString(value.destinationCustomerName),
    destinationCustomerDefaultTierType: readString(value.destinationCustomerDefaultTierType),
    status: readString(value.status) ?? '',
    convertedTransactionId: typeof value.convertedTransactionId === 'number' ? value.convertedTransactionId : null,
    items,
  }
}

type OrderPrefillInfo = {
  id: number
  orderNumber: string
}

type OrderDetailResponse = {
  id: number
  orderNumber: string
  customerId: number
  customerName: string | null
  customerPhone: string | null
  branchId: number
  status: string
  convertedTransactionId: number | null
  items: {
    productId: number
    productName: string
    uomId: number
    uomCode: string
    qty: number
    priceTier: string
    unitPriceSnapshot: number
  }[]
}

function parseOrderDetail(value: unknown): OrderDetailResponse | null {
  if (!isRecord(value) || typeof value.id !== 'number' || typeof value.customerId !== 'number') return null
  if (!Array.isArray(value.items)) return null
  const items = value.items
    .filter(isRecord)
    .filter(
      (item) =>
        typeof item.productId === 'number' && typeof item.uomId === 'number' && typeof item.qty === 'number',
    )
    .map((item) => ({
      productId: item.productId as number,
      productName: readString(item.productName) ?? `#${item.productId}`,
      uomId: item.uomId as number,
      uomCode: readString(item.uomCode) ?? '',
      qty: item.qty as number,
      priceTier: readString(item.priceTier) ?? 'RETAIL',
      unitPriceSnapshot: typeof item.unitPriceSnapshot === 'number' ? item.unitPriceSnapshot : 0,
    }))
  return {
    id: value.id,
    orderNumber: readString(value.orderNumber) ?? String(value.id),
    customerId: value.customerId,
    customerName: readString(value.customerName),
    customerPhone: readString(value.customerPhone),
    branchId: typeof value.branchId === 'number' ? value.branchId : 0,
    status: readString(value.status) ?? '',
    convertedTransactionId: typeof value.convertedTransactionId === 'number' ? value.convertedTransactionId : null,
    items,
  }
}

type ClonePrefillInfo = {
  trxNumber: string
  status: string
}

type TransactionCloneResponse = {
  trxNumber: string
  branchId: number
  status: string
  customerId: number | null
  customerName: string | null
  customerPhone: string | null
  paymentMethodIds: number[]
  items: {
    productId: number
    productName: string
    uomId: number
    uomCode: string
    qty: number
    unitPrice: number
    discountAmount: number
    priceTier: string
  }[]
}

function parseTransactionForClone(value: unknown): TransactionCloneResponse | null {
  if (!isRecord(value) || typeof value.trxNumber !== 'string' || typeof value.branchId !== 'number') return null
  const items = (Array.isArray(value.items) ? value.items : [])
    .filter(isRecord)
    .filter(
      (item) =>
        typeof item.productId === 'number' &&
        typeof item.uomId === 'number' &&
        typeof item.qty === 'number' &&
        typeof item.unitPrice === 'number',
    )
    .map((item) => ({
      productId: item.productId as number,
      productName: readString(item.productName) ?? `#${item.productId}`,
      uomId: item.uomId as number,
      uomCode: readString(item.uomCode) ?? '',
      qty: item.qty as number,
      unitPrice: item.unitPrice as number,
      discountAmount: typeof item.discountAmount === 'number' ? item.discountAmount : 0,
      priceTier: readString(item.priceTier) ?? '',
    }))
  const paymentMethodIds = (Array.isArray(value.payments) ? value.payments : [])
    .filter(isRecord)
    .map((payment) => payment.paymentMethodId)
    .filter((id): id is number => typeof id === 'number')
  return {
    trxNumber: value.trxNumber,
    branchId: value.branchId,
    status: readString(value.status) ?? '',
    customerId: typeof value.customerId === 'number' ? value.customerId : null,
    customerName: readString(value.customerName),
    customerPhone: readString(value.customerPhone),
    paymentMethodIds,
    items,
  }
}

export default function BulkSaleClient({ currentUser, branches, paymentMethods }: BulkSaleClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const debtMethod = useMemo(() => paymentMethods.find((method) => method.type === 'DEBT') ?? null, [paymentMethods])
  const nonDebtMethods = useMemo(() => paymentMethods.filter((method) => method.type !== 'DEBT'), [paymentMethods])
  const defaultPaymentMethodId = debtMethod?.id ?? paymentMethods[0]?.id ?? 0
  const defaultDpMethodId = nonDebtMethods[0]?.id ?? 0
  const defaultBranchId = useMemo(() => {
    const gudang = branches.find(
      (branch) => branch.name.toLowerCase().includes('gudang') || branch.code.toUpperCase() === 'GUDANG',
    )
    return gudang?.id ?? currentUser.branchId
  }, [branches, currentUser.branchId])

  const [branchId, setBranchId] = useState(defaultBranchId)
  const [paymentMethodId, setPaymentMethodId] = useState(defaultPaymentMethodId)
  const [dpMethodId, setDpMethodId] = useState(defaultDpMethodId)
  const [amountPaid, setAmountPaid] = useState(0)
  const [transactionDiscount, setTransactionDiscount] = useState(0)
  const [dueAt, setDueAt] = useState('')
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null)
  const [customerSummary, setCustomerSummary] = useState<{ total: number; outstandingDebt: number } | null>(null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)
  const [productQuery, setProductQuery] = useState('')
  const [productResults, setProductResults] = useState<BulkSaleProduct[]>([])
  const [isSearchingProducts, setIsSearchingProducts] = useState(false)
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false)
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [productHighlightIndex, setProductHighlightIndex] = useState(0)
  const [pickerNotice, setPickerNotice] = useState<{ text: string; isError: boolean } | null>(null)
  const lastAddedRowIdRef = useRef<string | null>(null)
  const [customerHighlightIndex, setCustomerHighlightIndex] = useState(0)
  const [rows, setRows] = useState<BulkSaleRow[]>([])
  const [stockByProduct, setStockByProduct] = useState<Map<number, BulkSaleStockInfo>>(new Map())
  const [lastPrices, setLastPrices] = useState<Map<string, LastBulkPrice>>(new Map())
  const [showReview, setShowReview] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [transactionResponse, setTransactionResponse] = useState<TransactionResponse | null>(null)
  const [printableBulkSale, setPrintableBulkSale] = useState<PrintableBulkSale | null>(null)
  const [activePrintMode, setActivePrintMode] = useState<PrintMode | null>(null)
  const [draftDeliveryNote, setDraftDeliveryNote] = useState<DeliveryNoteData | null>(null)
  const [includePrice, setIncludePrice] = useState(false)
  const [sourceIbt, setSourceIbt] = useState<IbtPrefillInfo | null>(null)
  const [sourceOrder, setSourceOrder] = useState<OrderPrefillInfo | null>(null)
  const [sourceClone, setSourceClone] = useState<ClonePrefillInfo | null>(null)
  const [completedIbt, setCompletedIbt] = useState<IbtPrefillInfo | null>(null)
  const [prefillSkipped, setPrefillSkipped] = useState<string[]>([])
  const [isPrefilling, setIsPrefilling] = useState(false)
  const [drafts, setDrafts] = useState<BulkSaleDraft[]>([])
  const [showDrafts, setShowDrafts] = useState(false)
  const [showHoldDialog, setShowHoldDialog] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showTierDialog, setShowTierDialog] = useState(false)
  const prefillDoneRef = useRef(false)

  const productSearchRef = useRef<HTMLInputElement>(null)
  const customerSearchRef = useRef<HTMLInputElement>(null)
  const transactionDiscountRef = useRef<HTMLInputElement>(null)
  const openReviewRef = useRef<() => void>(() => {})
  const productDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const customerDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const qtyRefs = useRef<Map<string, React.RefObject<HTMLInputElement | null>>>(new Map())
  const customerDropdownRefs = useRef<(HTMLButtonElement | null)[]>([])

  const canChangeBranch = ['OWNER', 'GM'].includes(currentUser.role)
  const selectedPaymentMethod = paymentMethods.find((method) => method.id === paymentMethodId) ?? null
  const isCredit = selectedPaymentMethod?.type === 'DEBT'
  // Kunci field customer hanya kalau prefill IBT berhasil auto-pilih customer internalnya —
  // kalau cabang tujuan belum punya customer internal (destinationCustomerId null), jangan
  // sampai kasir terjebak field kosong tak bisa diisi; biarkan pilih manual seperti biasa.
  const lockCustomerToIbt = Boolean(sourceIbt && selectedCustomer)
  const retailRowCount = sourceIbt
    ? rows.filter((row) => internalRetailWarning(row.availablePrices, row.uomId, row.priceTier)).length
    : 0
  const totals = useMemo(
    () => calculateBulkSaleTotals(rows, amountPaid, transactionDiscount),
    [amountPaid, rows, transactionDiscount],
  )
  const previewItems = useMemo<PreviewItem[]>(
    () =>
      rows.map((row) => ({
        productName: row.productName,
        qty: row.qty,
        uomCode: row.uomCode,
        unitPrice: String(row.unitPrice),
        discountAmount: String(row.discountAmount),
        subtotal: String(row.subtotal),
      })),
    [rows],
  )
  // Fokus input di bawah dilepas dulu: modal preview tidak menjebak fokus, jadi ketikan
  // berikutnya bisa diam-diam masuk ke kotak cari produk di belakangnya.
  function openPreview() {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    setShowPreview(true)
  }
  const receiptItems = useMemo(() => toReceiptItems(printableBulkSale?.items ?? []), [printableBulkSale])
  const stockShortages = useMemo(() => findStockShortages(rows, stockByProduct), [rows, stockByProduct])
  const rowProductIdsKey = useMemo(
    () => Array.from(new Set(rows.map((row) => row.productId))).sort((a, b) => a - b).join(','),
    [rows],
  )

  // Stok dimuat ulang tiap kali himpunan produk di daftar berubah, bukan disimpan di
  // baris: baris dari draf/Internal PO/clone nota bisa berumur lama, stoknya sudah basi.
  useEffect(() => {
    if (!rowProductIdsKey || !branchId) {
      setStockByProduct(new Map())
      return
    }
    let active = true
    fetch(`/api/bo/bulk-sale-products?branchId=${branchId}&ids=${rowProductIdsKey}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: unknown) => {
        if (!active || data === null) return
        setStockByProduct(
          new Map(parseProductList(data).map((product) => [product.id, { stock: product.stock, reserved: product.reservedQty ?? 0, baseUomCode: product.baseUomCode }])),
        )
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [branchId, rowProductIdsKey])

  // Harga terakhir customer (kanban #57) dimuat ulang saat customer, cabang, atau himpunan
  // produk berubah — customer boleh dipilih sesudah item diisi.
  const selectedCustomerId = selectedCustomer?.id ?? null
  useEffect(() => {
    if (!rowProductIdsKey || !branchId || !selectedCustomerId) {
      setLastPrices(new Map())
      return
    }
    let active = true
    fetch(`/api/bo/bulk-sales/last-prices?branchId=${branchId}&customerId=${selectedCustomerId}&productIds=${rowProductIdsKey}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: unknown) => {
        if (!active || data === null) return
        setLastPrices(new Map(parseLastBulkPrices(data).map((price) => [lastBulkPriceKey(price.productId, price.uomId), price])))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [branchId, rowProductIdsKey, selectedCustomerId])

  function resetBranchScopedState() {
    setShowReview(false)
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
    setPaymentMethodId(defaultPaymentMethodId)
    setDpMethodId(defaultDpMethodId)
    setAmountPaid(0)
    setTransactionDiscount(0)
    setDueAt('')
    setSuccessMsg('')
    setErrorMsg('')
    setTransactionResponse(null)
    setPrintableBulkSale(null)
    setActivePrintMode(null)
    setSourceIbt(null)
    setSourceOrder(null)
    setSourceClone(null)
    setCompletedIbt(null)
    setPrefillSkipped([])
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
    let ignore = false
    void (async () => {
      const loaded = await fetchBulkSaleDrafts()
      if (!ignore) setDrafts(loaded)
    })()
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    function handleGlobalHotkey(event: KeyboardEvent) {
      if (isSubmitting || showPreview || showProductDropdown || showTierDialog) return
      if (event.key === 'F7') {
        event.preventDefault()
        if (showHoldDialog || showDrafts || showReview || rows.length === 0) return
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
        setShowPreview(true)
        return
      }
      if (event.key === 'F8') {
        event.preventDefault()
        if (!showHoldDialog && !showDrafts && !showReview && rows.length > 0) setShowHoldDialog(true)
        return
      }
      if (showHoldDialog || showDrafts) return
      if (event.key === 'F2') {
        event.preventDefault()
        if (!showReview) setShowProductDropdown(true)
      } else if (event.key === 'F4') {
        event.preventDefault()
        customerSearchRef.current?.focus()
        customerSearchRef.current?.select()
      } else if (event.key === 'F6') {
        event.preventDefault()
        transactionDiscountRef.current?.focus()
        transactionDiscountRef.current?.select()
      } else if (event.key === 'F9') {
        event.preventDefault()
        openReviewRef.current()
      }
    }
    window.addEventListener('keydown', handleGlobalHotkey)
    return () => window.removeEventListener('keydown', handleGlobalHotkey)
  }, [isSubmitting, rows.length, showDrafts, showHoldDialog, showPreview, showProductDropdown, showReview, showTierDialog])

  useEffect(() => {
    customerDropdownRefs.current[customerHighlightIndex]?.scrollIntoView({ block: 'nearest' })
  }, [customerHighlightIndex])

  const searchProducts = useCallback(async (query: string, selectedBranchId: number) => {
    if (!query.trim() || !selectedBranchId) {
      setProductResults([])
      return
    }

    setIsSearchingProducts(true)
    try {
      const response = await fetch(
        `/api/bo/bulk-sale-products?branchId=${selectedBranchId}&search=${encodeURIComponent(query)}&limit=30`,
      )
      const data: unknown = await response.json()
      setProductResults(response.ok ? parseProductList(data) : [])
      setProductHighlightIndex(0)
    } catch {
      setProductResults([])
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

  useEffect(() => {
    const customerId = selectedCustomer?.id
    if (!customerId) {
      setCustomerSummary(null)
      setIsLoadingSummary(false)
      return
    }
    let active = true
    setIsLoadingSummary(true)
    setCustomerSummary(null)
    fetch(`/api/customers/${customerId}/summary`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: unknown) => {
        if (!active) return
        setCustomerSummary(
          isRecord(data)
            ? { total: Number(data.total) || 0, outstandingDebt: Number(data.outstandingDebt) || 0 }
            : null,
        )
      })
      .catch(() => {
        if (active) setCustomerSummary(null)
      })
      .finally(() => {
        if (active) setIsLoadingSummary(false)
      })
    return () => {
      active = false
    }
  }, [selectedCustomer?.id])

  function addProduct(product: BulkSaleProduct, choice?: BulkSalePickChoice) {
    // Produk yang satuan kecilnya belum berharga tetap bisa dimasukkan: barisnya
    // jatuh ke satuan berharga terkecil, bukan ditolak. Isian dari jendela pilih produk
    // (qty · satuan · tier) dipakai bila ada.
    const picked = choice
      ? resolvePickChoice(product, choice)
      : sourceIbt ? pickInternalDefaultPriceOption(product) : pickDefaultPriceOption(product)
    const addQty = choice?.qty ?? 1
    if (!picked) {
      setErrorMsg(`Semua satuan ${product.name} belum punya harga di cabang ini`)
      setPickerNotice({ text: `Semua satuan ${product.name} belum punya harga di cabang ini`, isError: true })
      return
    }

    // Produk yang sudah ada di daftar (satuan & tier sama) cukup ditambah qty-nya —
    // baris kembar membingungkan di nota dan dulu menggandakan piutang IBT.
    const line = { productId: product.id, uomId: picked.uom.uomId, priceTier: picked.price.priceTier }
    const existing = rows.find((row) => isSameLine(row, line))
    if (existing) {
      setRows((previous) => previous.map((row) => (row.id === existing.id ? incrementRowQty(row, addQty) : row)))
      setProductQuery('')
      setProductResults([])
      lastAddedRowIdRef.current = existing.id
      setPickerNotice({ text: `${product.name} sudah ada — qty ditambah ${addQty}`, isError: false })
      return
    }

    const id = String(nextRowId++)
    const ref = createRef<HTMLInputElement>()
    qtyRefs.current.set(id, ref)
    const qty = addQty
    const discountAmount = 0
    const unitPrice = picked.price.price
    const row: BulkSaleRow = {
      id,
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      uomId: picked.uom.uomId,
      uomCode: picked.uom.uomCode || product.baseUomCode,
      weightGram: picked.uom.weightGram ?? null,
      availableUoms: product.availableUoms,
      priceTier: picked.price.priceTier,
      availablePrices: product.prices,
      qty,
      unitPrice,
      discountAmount,
      subtotal: calculateRowSubtotal({ qty, unitPrice, discountAmount }),
    }

    setRows((previous) => [...previous, row])
    setProductQuery('')
    setProductResults([])
    lastAddedRowIdRef.current = id
    setPickerNotice({ text: `${product.name} ×${qty} ${row.uomCode} ditambahkan`, isError: false })
  }

  function clearFormAfterHold() {
    setRows([])
    qtyRefs.current.clear()
    setSelectedCustomer(null)
    setCustomerQuery('')
    setCustomerResults([])
    setProductQuery('')
    setProductResults([])
    setAmountPaid(0)
    setTransactionDiscount(0)
    setPaymentMethodId(defaultPaymentMethodId)
    setDpMethodId(defaultDpMethodId)
    setDueAt('')
    if (sourceIbt || sourceOrder) {
      setSourceIbt(null)
      setSourceOrder(null)
      setPrefillSkipped([])
      router.replace('/transactions/bulk-sale')
    }
  }

  async function holdBulkSale(name: string) {
    if (rows.length === 0) return
    const draftInput: Omit<BulkSaleDraft, 'id' | 'savedAt'> = {
      name,
      branchId,
      branchName: branches.find((branch) => branch.id === branchId)?.name ?? currentUser.branchName,
      customerId: selectedCustomer?.id ?? null,
      customerName: selectedCustomer?.name ?? '',
      customerPhone: selectedCustomer?.phone ?? null,
      paymentMethodId,
      dpMethodId,
      amountPaid,
      transactionDiscount,
      dueAt,
      rows,
      grandTotal: totals.grandTotal,
      itemCount: totals.itemCount,
      source: sourceIbt
        ? {
            kind: 'IBT',
            id: sourceIbt.id,
            number: sourceIbt.ibtNumber,
            destinationBranchName: sourceIbt.destinationBranchName,
          }
        : sourceOrder
          ? { kind: 'ORDER', id: sourceOrder.id, number: sourceOrder.orderNumber }
          : null,
    }

    let created: BulkSaleDraft
    try {
      created = await createBulkSaleDraft(draftInput)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan daftar tunggu')
      return
    }

    setDrafts((previous) => [created, ...previous])
    setShowHoldDialog(false)
    clearFormAfterHold()
    setSuccessMsg(`Bulk sale ditahan sebagai "${name}"`)
    setTimeout(() => customerSearchRef.current?.focus(), 50)
  }

  function resumeDraft(draft: BulkSaleDraft) {
    if (draft.branchId !== branchId && !canChangeBranch) {
      setErrorMsg(`Draf ini milik cabang ${draft.branchName}, hanya bisa dilanjutkan dari cabang tersebut`)
      return
    }
    if (rows.length > 0 && !window.confirm('Isi bulk sale saat ini akan diganti oleh draf yang dipilih. Lanjutkan?')) {
      return
    }

    if (draft.branchId !== branchId) setBranchId(draft.branchId)
    // Id baris dinomori ulang: id lama bisa bentrok dengan baris yang ditambahkan
    // di sesi halaman ini, dan bentrokan id membuat fokus qty menunjuk baris keliru.
    qtyRefs.current.clear()
    setRows(mergeDuplicateRows(draft.rows.map((row) => ({ ...row, id: String(nextRowId++) }))))
    setSelectedCustomer(
      draft.customerId ? { id: draft.customerId, name: draft.customerName, phone: draft.customerPhone } : null,
    )
    setCustomerQuery(draft.customerName)
    setCustomerResults([])
    setPaymentMethodId(draft.paymentMethodId || defaultPaymentMethodId)
    setDpMethodId(draft.dpMethodId || defaultDpMethodId)
    setAmountPaid(draft.amountPaid)
    setTransactionDiscount(draft.transactionDiscount)
    setDueAt(draft.dueAt)
    setSourceIbt(
      draft.source?.kind === 'IBT'
        ? {
            id: draft.source.id,
            ibtNumber: draft.source.number,
            destinationBranchName: draft.source.destinationBranchName ?? null,
          }
        : null,
    )
    setSourceOrder(
      draft.source?.kind === 'ORDER' ? { id: draft.source.id, orderNumber: draft.source.number } : null,
    )
    setPrefillSkipped([])
    setTransactionResponse(null)
    setPrintableBulkSale(null)
    setActivePrintMode(null)
    // Draf yang dilanjutkan dianggap "dipakai" — dibuang dari daftar segera di UI, penghapusan
    // di server menyusul di belakang (tidak diblokir menunggu network; kalaupun gagal, draf
    // yatim di server tidak berbahaya, cuma nongkrong tak terlihat).
    setDrafts((previous) => previous.filter((d) => d.id !== draft.id))
    void deleteBulkSaleDraft(draft.id)
    setShowDrafts(false)
    setSuccessMsg(`Draf "${draft.name}" dilanjutkan`)
  }

  function deleteDraft(draft: BulkSaleDraft) {
    if (!window.confirm(`Hapus draf "${draft.name}"? Tindakan ini tidak bisa dibatalkan.`)) return
    setDrafts((previous) => previous.filter((d) => d.id !== draft.id))
    void deleteBulkSaleDraft(draft.id)
  }

  function openProductPicker() {
    if (isSubmitting) return
    setPickerNotice(null)
    lastAddedRowIdRef.current = null
    setShowProductDropdown(true)
  }

  // Jendela pilih produk hanya tertutup lewat tombol Selesai/Esc. Setelah tertutup, fokus
  // pindah ke qty produk terakhir yang dimasukkan supaya bisa langsung dikoreksi.
  function closeProductPicker() {
    setShowProductDropdown(false)
    const lastRowId = lastAddedRowIdRef.current
    setTimeout(() => {
      const qtyInput = lastRowId ? qtyRefs.current.get(lastRowId)?.current : null
      if (qtyInput) {
        qtyInput.focus()
        qtyInput.select()
      } else {
        productSearchRef.current?.focus()
      }
    }, 50)
  }

  function handleProductKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === 'ArrowDown') {
      event.preventDefault()
      openProductPicker()
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

  function clearPrefill() {
    setSourceIbt(null)
    setSourceOrder(null)
    setSourceClone(null)
    setPrefillSkipped([])
    setRows([])
    router.replace('/transactions/bulk-sale')
  }

  const prefillFromIbt = useCallback(
    async (ibtId: number) => {
      setIsPrefilling(true)
      setErrorMsg('')
      try {
        const ibtResponse = await fetch(`/api/bo/internal-transfers/${ibtId}`)
        const ibtData: unknown = await ibtResponse.json()
        if (!ibtResponse.ok) {
          setErrorMsg(isRecord(ibtData) && typeof ibtData.error === 'string' ? ibtData.error : 'Gagal memuat Internal PO')
          return
        }
        const ibt = parseIbtDetail(ibtData)
        if (!ibt) {
          setErrorMsg('Data Internal PO tidak valid')
          return
        }
        if (ibt.convertedTransactionId) {
          setErrorMsg('Internal PO ini sudah diproses menjadi bulk sale')
          return
        }
        if (ibt.status === 'CANCELLED') {
          setErrorMsg('Internal PO ini sudah dibatalkan')
          return
        }

        const targetBranchId = ibt.sourceBranchId
        setBranchId(targetBranchId)

        const productIds = Array.from(new Set(ibt.items.map((item) => item.productId)))
        const productResponse = await fetch(
          `/api/bo/bulk-sale-products?branchId=${targetBranchId}&ids=${productIds.join(',')}`,
        )
        const productData: unknown = await productResponse.json()
        if (!productResponse.ok) {
          setErrorMsg(isRecord(productData) && typeof productData.error === 'string' ? productData.error : 'Gagal memuat harga produk')
          return
        }
        const productList = parseProductList(productData)
        const productById = new Map(productList.map((product) => [product.id, product]))

        const nextRows: BulkSaleRow[] = []
        const skipped: string[] = []
        for (const item of ibt.items) {
          const product = productById.get(item.productId)
          const fallbackName = item.productName ?? `#${item.productId}`
          if (!product) {
            skipped.push(`${fallbackName} (nonaktif / tidak ditemukan)`)
            continue
          }
          const price = pickInternalTierPrice(product.prices, item.uomId)
          if (!price) {
            const uomLabel = product.availableUoms.find((uom) => uom.uomId === item.uomId)?.uomCode ?? ''
            skipped.push(`${product.name} (harga ${uomLabel} belum tersedia di cabang ini)`)
            continue
          }
          const id = String(nextRowId++)
          const ref = createRef<HTMLInputElement>()
          qtyRefs.current.set(id, ref)
          const qty = item.qtyRequested > 0 ? item.qtyRequested : 1
          const unitPrice = price.price
          nextRows.push({
            id,
            productId: product.id,
            productCode: product.code,
            productName: product.name,
            uomId: item.uomId,
            uomCode: product.availableUoms.find((uom) => uom.uomId === item.uomId)?.uomCode ?? product.baseUomCode,
            weightGram: product.availableUoms.find((uom) => uom.uomId === item.uomId)?.weightGram ?? null,
            availableUoms: product.availableUoms,
            priceTier: price.priceTier,
            availablePrices: product.prices,
            qty,
            unitPrice,
            discountAmount: 0,
            subtotal: calculateRowSubtotal({ qty, unitPrice, discountAmount: 0 }),
          })
        }

        setRows(mergeDuplicateRows(nextRows))
        setSourceIbt({ id: ibt.id, ibtNumber: ibt.ibtNumber, destinationBranchName: ibt.destinationBranchName })
        if (ibt.destinationCustomerId && ibt.destinationCustomerName) {
          const internalCustomer: CustomerOption = {
            id: ibt.destinationCustomerId,
            name: ibt.destinationCustomerName,
            phone: null,
          }
          setSelectedCustomer(internalCustomer)
          setCustomerQuery(internalCustomer.name)
        }
        setPrefillSkipped(skipped)
        if (nextRows.length === 0) {
          setErrorMsg('Tidak ada item Internal PO yang dapat diproses (harga belum tersedia)')
        }
      } catch {
        setErrorMsg('Gagal memuat Internal PO. Coba lagi.')
      } finally {
        setIsPrefilling(false)
      }
    },
    [router],
  )

  const prefillFromOrder = useCallback(
    async (orderId: number) => {
      setIsPrefilling(true)
      setErrorMsg('')
      try {
        const orderResponse = await fetch(`/api/bo/customer-orders/${orderId}`)
        const orderData: unknown = await orderResponse.json()
        if (!orderResponse.ok) {
          setErrorMsg(isRecord(orderData) && typeof orderData.error === 'string' ? orderData.error : 'Gagal memuat order')
          return
        }
        const order = parseOrderDetail(orderData)
        if (!order) {
          setErrorMsg('Data order tidak valid')
          return
        }
        if (order.convertedTransactionId) {
          setErrorMsg('Order ini sudah diproses menjadi bulk sale')
          return
        }
        if (order.status !== 'PENDING') {
          setErrorMsg('Order ini sudah tidak berstatus menunggu konfirmasi')
          return
        }

        const targetBranchId = order.branchId
        setBranchId(targetBranchId)

        const productIds = Array.from(new Set(order.items.map((item) => item.productId)))
        const productResponse = await fetch(
          `/api/bo/bulk-sale-products?branchId=${targetBranchId}&ids=${productIds.join(',')}`,
        )
        const productData: unknown = await productResponse.json()
        if (!productResponse.ok) {
          setErrorMsg(isRecord(productData) && typeof productData.error === 'string' ? productData.error : 'Gagal memuat harga produk')
          return
        }
        const productList = parseProductList(productData)
        const productById = new Map(productList.map((product) => [product.id, product]))

        const nextRows: BulkSaleRow[] = []
        const skipped: string[] = []
        for (const item of order.items) {
          const product = productById.get(item.productId)
          if (!product) {
            skipped.push(`${item.productName} (nonaktif / tidak ditemukan)`)
            continue
          }
          const price = pricesForUom(product.prices, item.uomId).find((option) => option.priceTier === item.priceTier)
          if (!price) {
            const uomLabel = product.availableUoms.find((uom) => uom.uomId === item.uomId)?.uomCode ?? item.uomCode
            skipped.push(`${product.name} (harga ${uomLabel} tier ${item.priceTier} belum tersedia di cabang ini)`)
            continue
          }
          const id = String(nextRowId++)
          const ref = createRef<HTMLInputElement>()
          qtyRefs.current.set(id, ref)
          const qty = item.qty > 0 ? item.qty : 1
          const unitPrice = price.price
          nextRows.push({
            id,
            productId: product.id,
            productCode: product.code,
            productName: product.name,
            uomId: item.uomId,
            uomCode: product.availableUoms.find((uom) => uom.uomId === item.uomId)?.uomCode ?? product.baseUomCode,
            weightGram: product.availableUoms.find((uom) => uom.uomId === item.uomId)?.weightGram ?? null,
            availableUoms: product.availableUoms,
            priceTier: price.priceTier,
            availablePrices: product.prices,
            qty,
            unitPrice,
            discountAmount: 0,
            subtotal: calculateRowSubtotal({ qty, unitPrice, discountAmount: 0 }),
          })
        }

        setRows(mergeDuplicateRows(nextRows))
        setSourceOrder({ id: order.id, orderNumber: order.orderNumber })
        const orderCustomer: CustomerOption = {
          id: order.customerId,
          name: order.customerName ?? `Customer #${order.customerId}`,
          phone: order.customerPhone,
        }
        setSelectedCustomer(orderCustomer)
        setCustomerQuery(orderCustomer.name)
        setPrefillSkipped(skipped)
        if (nextRows.length === 0) {
          setErrorMsg('Tidak ada item order yang dapat diproses (harga belum tersedia)')
        }
      } catch {
        setErrorMsg('Gagal memuat order. Coba lagi.')
      } finally {
        setIsPrefilling(false)
      }
    },
    [router],
  )

  // Clone nota: jalan keluar saat nota salah input — kasir menyalin isi nota lama ke Bulk
  // Sale, membetulkan yang salah, menyimpannya sebagai nota baru, lalu mengajukan void nota
  // lama. Harga, tier, dan diskon per item disalin apa adanya (diskon transaksi lama sudah
  // teralokasi ke diskon item), jadi total nota baru sama persis selama tidak diubah.
  const prefillFromTransaction = useCallback(
    async (trxNumber: string) => {
      setIsPrefilling(true)
      setErrorMsg('')
      try {
        const trxResponse = await fetch(`/api/bo/transactions/${encodeURIComponent(trxNumber)}/detail`)
        const trxData: unknown = await trxResponse.json()
        if (!trxResponse.ok) {
          setErrorMsg(isRecord(trxData) && typeof trxData.error === 'string' ? trxData.error : 'Gagal memuat nota')
          return
        }
        const trx = parseTransactionForClone(trxData)
        if (!trx) {
          setErrorMsg('Data nota tidak valid')
          return
        }
        if (!canCloneTransaction(trx.status)) {
          setErrorMsg(CLONE_NOT_ALLOWED_MESSAGE)
          return
        }
        if (trx.branchId !== defaultBranchId && !canChangeBranch) {
          setErrorMsg('Nota ini milik cabang lain dan tidak bisa di-clone dari cabang Anda')
          return
        }

        const productIds = Array.from(new Set(trx.items.map((item) => item.productId)))
        if (productIds.length === 0) {
          setErrorMsg('Nota ini tidak punya item untuk di-clone')
          return
        }

        setBranchId(trx.branchId)

        const productResponse = await fetch(
          `/api/bo/bulk-sale-products?branchId=${trx.branchId}&ids=${productIds.join(',')}`,
        )
        const productData: unknown = await productResponse.json()
        if (!productResponse.ok) {
          setErrorMsg(isRecord(productData) && typeof productData.error === 'string' ? productData.error : 'Gagal memuat harga produk')
          return
        }
        const productById = new Map(parseProductList(productData).map((product) => [product.id, product]))

        const nextRows: BulkSaleRow[] = []
        const skipped: string[] = []
        for (const item of trx.items) {
          const product = productById.get(item.productId)
          if (!product) {
            skipped.push(`${item.productName} (nonaktif / tidak ditemukan)`)
            continue
          }
          const uom = product.availableUoms.find((option) => option.uomId === item.uomId)
          if (!uom) {
            skipped.push(`${product.name} (satuan ${item.uomCode} tidak lagi punya konversi)`)
            continue
          }
          const price = pickTierPrice(product.prices, item.uomId, item.priceTier)
          if (!price) {
            skipped.push(`${product.name} (harga ${uom.uomCode} belum tersedia di cabang ini)`)
            continue
          }
          const id = String(nextRowId++)
          qtyRefs.current.set(id, createRef<HTMLInputElement>())
          const qty = item.qty > 0 ? item.qty : 1
          const unitPrice = item.unitPrice > 0 ? item.unitPrice : price.price
          const discountAmount = Math.min(Math.max(0, item.discountAmount), qty * unitPrice)
          nextRows.push({
            id,
            productId: product.id,
            productCode: product.code,
            productName: product.name,
            uomId: uom.uomId,
            uomCode: uom.uomCode || product.baseUomCode,
            weightGram: uom.weightGram ?? null,
            availableUoms: product.availableUoms,
            priceTier: price.priceTier,
            availablePrices: product.prices,
            qty,
            unitPrice,
            discountAmount,
            subtotal: calculateRowSubtotal({ qty, unitPrice, discountAmount }),
          })
        }

        setRows(mergeDuplicateRows(nextRows))
        setSourceClone({ trxNumber: trx.trxNumber, status: trx.status })
        if (trx.customerId) {
          const customer: CustomerOption = {
            id: trx.customerId,
            name: trx.customerName ?? `Customer #${trx.customerId}`,
            phone: trx.customerPhone,
          }
          setSelectedCustomer(customer)
          setCustomerQuery(customer.name)
        }
        const clonedMethodId =
          trx.paymentMethodIds.find((methodId) => methodId === debtMethod?.id) ??
          trx.paymentMethodIds.find((methodId) => paymentMethods.some((method) => method.id === methodId))
        if (clonedMethodId) setPaymentMethodId(clonedMethodId)
        setPrefillSkipped(skipped)
        if (nextRows.length === 0) {
          setErrorMsg('Tidak ada item nota yang dapat di-clone (produk nonaktif / harga belum tersedia)')
        }
      } catch {
        setErrorMsg('Gagal memuat nota. Coba lagi.')
      } finally {
        setIsPrefilling(false)
      }
    },
    [canChangeBranch, debtMethod, defaultBranchId, paymentMethods],
  )

  useEffect(() => {
    if (prefillDoneRef.current) return
    const fromIbt = searchParams.get('fromIbt')
    const fromOrder = searchParams.get('fromOrder')
    const fromTransaction = searchParams.get('fromTransaction')?.trim()
    if (fromTransaction) {
      prefillDoneRef.current = true
      prefillFromTransaction(fromTransaction)
      return
    }
    if (fromIbt) {
      const ibtId = Number(fromIbt)
      if (Number.isInteger(ibtId) && ibtId > 0) {
        prefillDoneRef.current = true
        prefillFromIbt(ibtId)
      }
      return
    }
    if (fromOrder) {
      const orderId = Number(fromOrder)
      if (Number.isInteger(orderId) && orderId > 0) {
        prefillDoneRef.current = true
        prefillFromOrder(orderId)
      }
    }
  }, [searchParams, prefillFromIbt, prefillFromOrder, prefillFromTransaction])

  function validateSale(): boolean {
    if (!selectedCustomer) {
      setErrorMsg('Pilih customer terlebih dahulu')
      customerSearchRef.current?.focus()
      return false
    }
    if (!paymentMethodId) {
      setErrorMsg('Pilih metode pembayaran')
      return false
    }
    if (rows.length === 0) {
      setErrorMsg('Tambahkan minimal satu produk')
      productSearchRef.current?.focus()
      return false
    }
    if (rows.some((row) => row.qty <= 0 || row.unitPrice <= 0 || row.subtotal <= 0)) {
      setErrorMsg('Pastikan qty, harga, dan subtotal semua item valid')
      return false
    }
    if (transactionDiscount > totals.subtotal - totals.discountTotal) {
      setErrorMsg('Diskon transaksi melebihi total setelah diskon per item')
      return false
    }
    if (isCredit) {
      if (amountPaid >= totals.grandTotal) {
        setErrorMsg('Penjualan kredit: uang muka (DP) harus kurang dari total transaksi')
        return false
      }
      if (amountPaid > 0 && !dpMethodId) {
        setErrorMsg('Pilih metode pembayaran untuk uang muka (DP)')
        return false
      }
    } else if (amountPaid < totals.grandTotal) {
      setErrorMsg('Jumlah bayar kurang dari total transaksi')
      return false
    }
    return true
  }

  function openReview() {
    if (!validateSale()) return
    setErrorMsg('')
    setShowReview(true)
  }
  openReviewRef.current = openReview

  async function submitBulkSale() {
    if (!selectedCustomer || !validateSale()) {
      setShowReview(false)
      return
    }

    setShowReview(false)
    setIsSubmitting(true)
    setErrorMsg('')
    try {
      const allocatedDiscounts = allocateTransactionDiscount(rows, totals.transactionDiscount)
      const items = rows.map((row, index) => {
        const discountAmount = allocatedDiscounts[index]
        return {
          productId: row.productId,
          productName: row.productName,
          uomId: row.uomId,
          uomCode: row.uomCode,
          qty: row.qty,
          unitPrice: row.unitPrice,
          priceTier: row.priceTier,
          discountAmount,
          subtotal: row.qty * row.unitPrice - discountAmount,
        }
      })
      const response = await fetch('/api/bo/bulk-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          customerId: selectedCustomer.id,
          paymentMethodId: isCredit ? dpMethodId : paymentMethodId,
          amountPaid,
          change: Math.max(0, totals.change),
          isCredit,
          dueAt: isCredit ? (dueAt || null) : null,
          sourceIbtId: sourceIbt?.id ?? null,
          sourceOrderId: sourceOrder?.id ?? null,
          items,
          totals: {
            subtotal: totals.subtotal,
            discountTotal: totals.discountTotal + totals.transactionDiscount,
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
      const selectedBranch = branches.find((branch) => branch.id === branchId)
      const selectedBranchName = selectedBranch?.name ?? currentUser.branchName
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
          storeName: selectedBranch?.receiptName || 'HAMMIELION',
          storeAddress: selectedBranch?.address ?? null,
          storePhone: selectedBranch?.phone ?? null,
          customerName: selectedCustomer.name,
          customerPhone: readString(transaction.customerPhone),
          customerAddress: readString(transaction.customerAddress),
          paymentMethodName: selectedPaymentMethodName,
          cashierName: currentUser.userName,
          amountPaid,
          change: totals.change,
          discountTotal: totals.discountTotal + totals.transactionDiscount,
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
      setTransactionDiscount(0)
      setPaymentMethodId(defaultPaymentMethodId)
      setDpMethodId(defaultDpMethodId)
      setDueAt('')
      setSelectedCustomer(null)
      setCustomerQuery('')
      setProductQuery('')
      setCompletedIbt(sourceIbt)
      if (sourceIbt || sourceOrder) {
        setSourceIbt(null)
        setSourceOrder(null)
        setPrefillSkipped([])
        router.replace('/transactions/bulk-sale')
      }
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

  function getReceiptSource(): ReceiptSource | null {
    if (!printableBulkSale) return null
    return {
      receiptNumber: printableBulkSale.transactionNumber,
      items: receiptItems,
      grandTotal: String(printableBulkSale.grandTotal),
      amountPaid: String(printableBulkSale.amountPaid),
      kembalian: String(printableBulkSale.change),
      paymentMethodName: printableBulkSale.paymentMethodName,
      storeName: printableBulkSale.storeName,
      storeAddress: printableBulkSale.storeAddress,
      storePhone: printableBulkSale.storePhone,
      transactionDate: printableBulkSale.transactionDate,
      cashierName: printableBulkSale.cashierName,
      discountAmount: String(printableBulkSale.discountTotal),
      customerName: printableBulkSale.customerName,
    }
  }

  async function cetakStruk() {
    const source = getReceiptSource()
    if (!source) return
    await printReceipt(
      source,
      () => printBulkSale('receipt')
    )
  }

  function getDeliveryNoteData(): DeliveryNoteData | null {
    if (!printableBulkSale) return null
    return {
      transactionNumber: printableBulkSale.transactionNumber,
      transactionDate: formatPrintDate(printableBulkSale.transactionDate),
      branchName: printableBulkSale.branchName,
      customerName: printableBulkSale.customerName,
      customerPhone: printableBulkSale.customerPhone,
      customerAddress: printableBulkSale.customerAddress,
      staffName: printableBulkSale.cashierName,
      withPrice: includePrice,
      grandTotal: printableBulkSale.grandTotal,
      items: printableBulkSale.items,
    }
  }

  async function printSuratJalan() {
    const data = getDeliveryNoteData()
    if (!data) return
    try {
      await printDeliveryNoteViaQz(data)
      setSuccessMsg('Surat jalan dikirim ke printer (QZ Tray)')
    } catch (err) {
      console.error('[Surat Jalan] Cetak via QZ Tray gagal:', err)
      setErrorMsg(`Cetak QZ Tray gagal (${describeQzError(err)}) — memakai cetak browser.`)
      printBulkSale('delivery-note')
    }
  }

  async function printDraftDeliveryNote(draft: BulkSaleDraft) {
    const data = draftToDeliveryNote(draft, {
      transactionDate: formatPrintDate(new Date()),
      staffName: currentUser.userName,
    })
    try {
      await printDeliveryNoteViaQz(data)
      setSuccessMsg(`Surat jalan draf "${draft.name}" dikirim ke printer (QZ Tray)`)
    } catch (err) {
      console.error('[Surat Jalan Draf] Cetak via QZ Tray gagal:', err)
      setErrorMsg(`Cetak QZ Tray gagal (${describeQzError(err)}) — memakai cetak browser.`)
      // Lepas mode cetak nota lain dulu: dua blok surat jalan yang ter-mount sama-sama ikut tercetak.
      setActivePrintMode(null)
      setDraftDeliveryNote(data)
      setTimeout(() => {
        window.print()
        setDraftDeliveryNote(null)
      }, 50)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Bulk Sale</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Buat transaksi penjualan grosir dengan pencarian produk cepat.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowDrafts(true)}
          className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
          aria-label={`Daftar tunggu bulk sale${drafts.length > 0 ? ` (${drafts.length})` : ''}`}
        >
          Daftar Tunggu
          {drafts.length > 0 && (
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold tabular-nums text-primary-foreground">
              {drafts.length}
            </span>
          )}
        </button>
      </div>

      {isPrefilling && (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          Memuat item dari{' '}
          {searchParams.get('fromTransaction')
            ? `nota ${searchParams.get('fromTransaction')}`
            : searchParams.get('fromOrder')
              ? 'Order Portal'
              : 'Internal PO'}
          ...
        </div>
      )}

      {sourceIbt && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-medium">Dari Internal PO {sourceIbt.ibtNumber}</span>
              {sourceIbt.destinationBranchName && (
                <span className="text-blue-700"> → tujuan {sourceIbt.destinationBranchName}</span>
              )}
              <div className="mt-0.5 text-xs text-blue-700">
                {lockCustomerToIbt
                  ? 'Customer toko tujuan terkunci otomatis ke customer internal cabang tersebut — tidak bisa diganti manual (mencegah salah pilih ke customer lain yang kebetulan namanya sama). Untuk memilih customer lain, klik "Batalkan & mulai kosong".'
                  : 'Customer internal untuk cabang tujuan belum ditemukan — pilih customer manual di bawah.'}
              </div>
            </div>
            <button
              type="button"
              onClick={clearPrefill}
              disabled={isSubmitting}
              className="rounded-md border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-800 transition-colors hover:bg-blue-100 disabled:opacity-50"
            >
              Batalkan & mulai kosong
            </button>
          </div>
          {retailRowCount > 0 && (
            <div className="mt-2 rounded border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
              {retailRowCount} item memakai harga <strong>RETAIL</strong> (ditandai kuning di tabel). PO Internal biasanya
              memakai GROSIR/RESELLER — pastikan memang disengaja, atau lengkapi harga grosirnya di master produk.
            </div>
          )}
          {prefillSkipped.length > 0 && (
            <div className="mt-2 rounded border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
              <span className="font-medium">{prefillSkipped.length} item dilewati:</span>{' '}
              {prefillSkipped.join('; ')}
            </div>
          )}
        </div>
      )}

      {sourceClone && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-medium">Clone dari nota {sourceClone.trxNumber}</span>
              <div className="mt-0.5 text-xs">
                Item, harga, diskon, dan customer disalin dari nota lama. Betulkan yang salah lalu simpan sebagai nota baru.
                {sourceClone.status === 'PENDING_VOID' && (
                  <>
                    {' '}
                    <span className="font-semibold">Void nota {sourceClone.trxNumber} masih menunggu persetujuan</span> —
                    pastikan disetujui supaya barangnya tidak tercatat dua kali.
                  </>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={clearPrefill}
              disabled={isSubmitting}
              className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:bg-transparent dark:text-amber-200"
            >
              Batalkan & mulai kosong
            </button>
          </div>
          {prefillSkipped.length > 0 && (
            <div className="mt-2 rounded border border-amber-300 bg-white/60 px-2.5 py-1.5 text-xs text-amber-800">
              <span className="font-medium">{prefillSkipped.length} item dilewati:</span>{' '}
              {prefillSkipped.join('; ')}
            </div>
          )}
        </div>
      )}

      {sourceOrder && (
        <div className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-sm text-indigo-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-medium">Dari Order Portal {sourceOrder.orderNumber}</span>
              <div className="mt-0.5 text-xs text-indigo-700">
                Customer & item order terpilih otomatis. Periksa harga/qty lalu simpan — order akan tertaut ke transaksi ini.
              </div>
            </div>
            <button
              type="button"
              onClick={clearPrefill}
              disabled={isSubmitting}
              className="rounded-md border border-indigo-300 bg-white px-3 py-1.5 text-xs font-medium text-indigo-800 transition-colors hover:bg-indigo-100 disabled:opacity-50"
            >
              Batalkan & mulai kosong
            </button>
          </div>
          {prefillSkipped.length > 0 && (
            <div className="mt-2 rounded border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
              <span className="font-medium">{prefillSkipped.length} item dilewati:</span>{' '}
              {prefillSkipped.join('; ')}
            </div>
          )}
        </div>
      )}

      {successMsg && (
        <div role="status" aria-live="polite" className="bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded-md text-sm">
          {successMsg}
          {transactionResponse?.transactionNumber ? ` (${transactionResponse.transactionNumber})` : ''}
        </div>
      )}

      {transactionResponse?.transactionNumber && printableBulkSale && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
          <button
            type="button"
            onClick={() => { void cetakStruk() }}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
          >
            Cetak Struk
          </button>
          <ReceiptImageExport data={getReceiptSource()!} />
          <button
            type="button"
            onClick={printSuratJalan}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
          >
            Cetak Surat Jalan
          </button>
          <DeliveryNoteImageExport data={getDeliveryNoteData()!} />
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includePrice}
              onChange={(event) => setIncludePrice(event.target.checked)}
              className="h-4 w-4"
            />
            Sertakan harga di surat jalan
          </label>
          {completedIbt && (
            <button
              type="button"
              onClick={() => router.push(`/purchase-orders/internal/${completedIbt.id}`)}
              className="ml-auto rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-800 transition-colors hover:bg-blue-100"
            >
              Kembali ke PO Internal {completedIbt.ibtNumber}
            </button>
          )}
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
          <label className="mb-1 block text-xs font-medium text-foreground">Customer <span className="font-normal text-muted-foreground">(F4)</span></label>
          <input
            ref={customerSearchRef}
            value={customerQuery}
            onChange={(event) => {
              setCustomerQuery(event.target.value)
              setSelectedCustomer(null)
            }}
            onKeyDown={handleCustomerKeyDown}
            onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
            onFocus={() => !lockCustomerToIbt && customerResults.length > 0 && setShowCustomerDropdown(true)}
            disabled={isSubmitting || lockCustomerToIbt}
            readOnly={lockCustomerToIbt}
            placeholder="Cari nama atau telepon customer..."
            title={lockCustomerToIbt ? 'Terkunci ke customer cabang tujuan Internal PO. Klik "Batalkan & mulai kosong" untuk memilih customer lain.' : undefined}
            className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:bg-muted/40"
          />
          {isSearchingCustomers && <div className="absolute right-3 top-8 text-xs text-muted-foreground">Mencari...</div>}
          {!lockCustomerToIbt && showCustomerDropdown && customerResults.length > 0 && (
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
          {selectedCustomer && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {isLoadingSummary ? (
                <span className="text-xs text-muted-foreground">Memuat info pelanggan...</span>
              ) : customerSummary ? (
                <>
                  <span className="rounded bg-muted/60 px-2 py-0.5 text-xs text-foreground">
                    Belanja 30 hari: Rp {formatCurrency(customerSummary.total)}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      customerSummary.outstandingDebt > 0
                        ? 'bg-yellow-50 text-yellow-700'
                        : 'bg-muted/60 text-foreground'
                    }`}
                  >
                    Sisa hutang: Rp {formatCurrency(customerSummary.outstandingDebt)}
                  </span>
                </>
              ) : null}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">Metode Pembayaran</label>
          <select
            value={paymentMethodId}
            onChange={(event) => {
              const nextId = parseInt(event.target.value, 10)
              const nextMethod = paymentMethods.find((method) => method.id === nextId)
              setPaymentMethodId(nextId)
              if (nextMethod?.type === 'DEBT') setAmountPaid(0)
              else setDueAt('')
            }}
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

      <div>
        <label className="mb-1 block text-xs font-medium text-foreground">Cari Produk <span className="font-normal text-muted-foreground">(F2)</span></label>
        <input
          ref={productSearchRef}
          value={productQuery}
          onChange={(event) => {
            setProductQuery(event.target.value)
            openProductPicker()
          }}
          onKeyDown={handleProductKeyDown}
          onClick={openProductPicker}
          disabled={isSubmitting}
          placeholder="Ketik nama, SKU, atau barcode — daftar produk terbuka di jendela baru..."
          className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
        />
      </div>

      {showProductDropdown && (
        <BulkSaleProductPicker
          query={productQuery}
          onQueryChange={setProductQuery}
          results={productResults}
          isSearching={isSearchingProducts}
          highlightIndex={productHighlightIndex}
          onHighlightChange={setProductHighlightIndex}
          onPick={addProduct}
          internal={Boolean(sourceIbt)}
          onClose={closeProductPicker}
          addedProductIds={new Set(rows.map((row) => row.productId))}
          notice={pickerNotice}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="min-w-0 space-y-3">
      {stockShortages.size > 0 && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          <span className="font-semibold">⚠ {stockShortages.size} produk melebihi stok cabang.</span>{' '}
          Periksa baris bertanda merah. Transaksi tetap bisa disimpan, tapi stok produk tersebut akan tercatat minus.
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {rows.length} produk | {totals.itemCount} total qty
          </div>
          <button
            type="button"
            onClick={() => setShowTierDialog(true)}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            aria-label="Ubah tier harga semua item"
          >
            <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
            </svg>
            Ubah Tier Semua Item
          </button>
        </div>
      )}

      {showTierDialog && (
        <BulkSaleTierDialog
          rows={rows}
          onPick={(tier) => {
            setRows((previous) => applyTierToRows(previous, tier))
            setShowTierDialog(false)
            setSuccessMsg(`Tier harga diubah ke ${tier}`)
          }}
          onClose={() => setShowTierDialog(false)}
        />
      )}

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
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
                    internalTransfer={Boolean(sourceIbt)}
                    lastPrice={lastPrices.get(lastBulkPriceKey(row.productId, row.uomId)) ?? null}
                    stockWarning={(() => {
                      const shortage = stockShortages.get(row.productId)
                      return shortage ? describeStockShortage(shortage) : null
                    })()}
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

      </div>

        <div className="space-y-2 rounded-lg border border-border bg-card p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span>Rp {formatCurrency(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Total Diskon Item</span>
            <span>Rp {formatCurrency(totals.discountTotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>Diskon Transaksi <span className="text-xs">(F6)</span></span>
            <div className="flex items-center gap-1">
              <span>Rp</span>
              <input
                ref={transactionDiscountRef}
                type="text"
                inputMode="numeric"
                value={transactionDiscount === 0 ? '' : formatRupiahInput(transactionDiscount)}
                onChange={(event) => setTransactionDiscount(integerFromInput(event.target.value))}
                onFocus={(event) => event.target.select()}
                placeholder="0"
                disabled={isSubmitting || rows.length === 0}
                className="w-24 rounded-md border border-border bg-background px-2 py-1 text-right text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
            </div>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold text-foreground">
            <span>Grand Total</span>
            <span>Rp {formatCurrency(totals.grandTotal)}</span>
          </div>
          {isCredit && (
            <div className="flex items-center gap-2 border-t border-border pt-2 text-sm font-medium text-yellow-700">
              <span className="rounded bg-yellow-50 px-2 py-0.5 text-xs">Penjualan Kredit (Hutang)</span>
            </div>
          )}
          <div className={isCredit ? '' : 'border-t border-border pt-2'}>
            <label className="mb-1 block text-xs font-medium text-foreground">
              {isCredit ? 'Uang Muka (DP)' : 'Jumlah Bayar'}
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={amountPaid === 0 ? '' : formatRupiahInput(amountPaid)}
              onChange={(event) => setAmountPaid(integerFromInput(event.target.value))}
              onFocus={(event) => event.target.select()}
              placeholder="0"
              disabled={isSubmitting}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-right text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
          </div>
          {isCredit && amountPaid > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Metode Uang Muka (DP)</label>
              <select
                value={dpMethodId}
                onChange={(event) => setDpMethodId(parseInt(event.target.value, 10))}
                disabled={isSubmitting || nonDebtMethods.length === 0}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              >
                {nonDebtMethods.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.name}
                  </option>
                ))}
              </select>
            </div>
          )}
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
            onClick={openReview}
            disabled={isSubmitting || rows.length === 0}
            className="w-full rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? 'Menyimpan...' : 'Simpan Bulk Sale (F9)'}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={openPreview}
              disabled={isSubmitting || rows.length === 0}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
              title="Rincian pesanan untuk di-screenshot / dikirim ke pelanggan"
            >
              Preview (F7)
            </button>
            <button
              type="button"
              onClick={() => setShowHoldDialog(true)}
              disabled={isSubmitting || rows.length === 0}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
            >
              Tahan (F8)
            </button>
          </div>
        </div>
      </div>
      {showPreview && (
        <OrderPreviewModal
          items={previewItems}
          customerName={selectedCustomer?.name ?? null}
          transactionDiscount={String(totals.transactionDiscount)}
          storeName={branches.find((branch) => branch.id === branchId)?.receiptName || 'HAMMIELION'}
          storePhone={branches.find((branch) => branch.id === branchId)?.phone ?? null}
          onClose={() => setShowPreview(false)}
        />
      )}
      {showHoldDialog && (
        <BulkSaleHoldDialog
          defaultName={
            selectedCustomer?.name ??
            `Tunggu ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
          }
          itemCount={totals.itemCount}
          grandTotal={totals.grandTotal}
          onSave={holdBulkSale}
          onCancel={() => setShowHoldDialog(false)}
        />
      )}
      {showDrafts && (
        <BulkSaleDraftsDrawer
          drafts={drafts}
          currentBranchId={branchId}
          canChangeBranch={canChangeBranch}
          onResume={resumeDraft}
          onDelete={deleteDraft}
          onPrintDeliveryNote={(draft) => { void printDraftDeliveryNote(draft) }}
          onClose={() => setShowDrafts(false)}
        />
      )}
      {showReview && selectedCustomer && (
        <BulkSaleReviewDialog
          branchName={branches.find((branch) => branch.id === branchId)?.name ?? currentUser.branchName}
          customerName={selectedCustomer.name}
          customerPhone={selectedCustomer.phone}
          customerSummary={customerSummary}
          paymentMethodName={selectedPaymentMethod?.name ?? '-'}
          isCredit={isCredit}
          dpMethodName={nonDebtMethods.find((method) => method.id === dpMethodId)?.name ?? null}
          dueAt={dueAt}
          rows={rows}
          totals={totals}
          amountPaid={amountPaid}
          stockShortageCount={stockShortages.size}
          isSubmitting={isSubmitting}
          onConfirm={submitBulkSale}
          onCancel={() => setShowReview(false)}
        />
      )}
      {printableBulkSale && activePrintMode === 'receipt' && (
        <ReceiptPrint
          receiptNumber={printableBulkSale.transactionNumber}
          items={receiptItems}
          grandTotal={String(printableBulkSale.grandTotal)}
          amountPaid={String(printableBulkSale.amountPaid)}
          kembalian={String(printableBulkSale.change)}
          paymentMethodName={printableBulkSale.paymentMethodName}
          branchName={printableBulkSale.branchName}
          storeName={printableBulkSale.storeName}
          storeAddress={printableBulkSale.storeAddress}
          storePhone={printableBulkSale.storePhone}
          transactionDate={printableBulkSale.transactionDate}
          cashierName={printableBulkSale.cashierName}
          discountAmount={String(printableBulkSale.discountTotal)}
          customerName={printableBulkSale.customerName}
        />
      )}

      {draftDeliveryNote && <BulkSaleDeliveryNotePrint {...draftDeliveryNote} />}

      {printableBulkSale && activePrintMode === 'delivery-note' && (
        <BulkSaleDeliveryNotePrint
          transactionNumber={printableBulkSale.transactionNumber}
          transactionDate={formatPrintDate(printableBulkSale.transactionDate)}
          branchName={printableBulkSale.branchName}
          customerName={printableBulkSale.customerName}
          customerPhone={printableBulkSale.customerPhone}
          customerAddress={printableBulkSale.customerAddress}
          staffName={printableBulkSale.cashierName}
          withPrice={includePrice}
          grandTotal={printableBulkSale.grandTotal}
          items={printableBulkSale.items}
        />
      )}
    </div>
  )
}
