import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessTokenCached } from '@/lib/auth-cache'
import { getPosBranchId } from '@/lib/pos-branch'
import {
  db,
  transactions,
  transactionItems,
  transactionPayments,
  products,
  unitsOfMeasure,
  paymentMethods,
  shifts,
  eq,
  and,
  desc,
  inArray,
  gte,
  lte,
  ilike,
} from '@/lib/db'
import TransactionHistoryClient from '@/components/pos/transaction-history-client'

export interface TransactionListItem {
  id: number
  trxNumber: string
  createdAt: string
  payableAmount: number
  paidAmount: number
  changeAmount: number
  status: string
  discountAmount: number
  totalAmount: number
  shiftId: number
}

export interface TransactionItemDetail {
  id: number
  productId: number
  productName: string
  uomId: number
  uomCode: string
  qty: number
  unitPrice: number
  totalPrice: number
  discountAmount: number
  priceTier: string
}

export interface TransactionPaymentDetail {
  id: number
  paymentMethodId: number
  paymentMethodName: string
  amount: number
}

export interface TransactionWithDetails extends TransactionListItem {
  items: TransactionItemDetail[]
  payments: TransactionPaymentDetail[]
}

interface DbTransactionRow {
  id: number
  trxNumber: string
  createdAt: Date
  payableAmount: number
  paidAmount: number
  changeAmount: number
  status: string
  discountAmount: number
  totalAmount: number
  shiftId: number
}

// Fungsi helper untuk memvalidasi format tanggal YYYY-MM-DD
const isValidDateString = (str?: string): boolean => {
  if (!str) return false
  const reg = /^\d{4}-\d{2}-\d{2}$/
  if (!reg.test(str)) return false
  const d = new Date(str + 'T00:00:00')
  return !isNaN(d.getTime())
}

// Fungsi helper untuk mendapatkan tanggal hari ini (WIB / GMT+7)
const getTodayString = (): string => {
  const tzOffset = 7 * 60 * 60 * 1000 // WIB offset
  const localTime = new Date(Date.now() + tzOffset)
  return localTime.toISOString().split('T')[0]
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; mode?: string; q?: string }>
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value

  let payload: any = null
  try {
    payload = token ? await verifyAccessTokenCached(token) : null
  } catch (error) {
    console.error('Error verifying access token:', error)
    redirect('/pos/login')
  }

  if (!payload || !payload.branchId || !payload.userId) {
    redirect('/pos/login')
  }

  const branchId = getPosBranchId(payload, cookieStore)
  const params = (await searchParams) || {}
  const mode = params.mode === 'date' ? 'date' : 'shift'
  const fromParam = params.from
  const toParam = params.to
  const qParam = params.q || ''

  const activeShift = await db.query.shifts.findFirst({
    where: and(eq(shifts.branchId, branchId), eq(shifts.status, 'OPEN')),
  })

  // Mode shift membutuhkan shift aktif
  if (mode === 'shift' && !activeShift) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px-44px)] p-6 text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-foreground mb-2">Tidak Ada Shift Aktif</h2>
        <p className="text-base text-muted-foreground max-w-sm">
          Tidak ada shift aktif untuk cabang ini. Hubungi manager untuk membuka shift terlebih dahulu.
        </p>
      </div>
    )
  }

  let txList: DbTransactionRow[]

  if (mode === 'shift' && activeShift) {
    const conditions = [
      eq(transactions.shiftId, activeShift.id),
      eq(transactions.branchId, branchId),
      eq(transactions.cashierId, payload.userId),
      inArray(transactions.status, ['COMPLETED', 'VOIDED', 'PENDING_VOID']),
    ]
    if (qParam.trim()) {
      conditions.push(ilike(transactions.trxNumber, `%${qParam.trim()}%`))
    }

    // Query default: transaksi di shift aktif milik kasir ini
    const rows = await db
      .select({
        id: transactions.id,
        trxNumber: transactions.trxNumber,
        createdAt: transactions.createdAt,
        payableAmount: transactions.payableAmount,
        paidAmount: transactions.paidAmount,
        changeAmount: transactions.changeAmount,
        status: transactions.status,
        discountAmount: transactions.discountAmount,
        totalAmount: transactions.totalAmount,
        shiftId: transactions.shiftId,
      })
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.createdAt))
      .limit(qParam.trim() ? 10000 : 50)

    txList = rows
  } else {
    // Mode date: query berdasarkan rentang tanggal, tanpa filter shiftId
    const todayStr = getTodayString()
    const resolvedFrom = isValidDateString(fromParam) ? fromParam! : todayStr
    const resolvedTo = isValidDateString(toParam) ? toParam! : todayStr

    const fromDate = new Date(resolvedFrom + 'T00:00:00')
    const toDate = new Date(resolvedTo + 'T23:59:59')

    const conditions = [
      eq(transactions.branchId, branchId),
      eq(transactions.cashierId, payload.userId),
      inArray(transactions.status, ['COMPLETED', 'VOIDED', 'PENDING_VOID']),
    ]
    conditions.push(gte(transactions.createdAt, fromDate))
    conditions.push(lte(transactions.createdAt, toDate))

    if (qParam.trim()) {
      conditions.push(ilike(transactions.trxNumber, `%${qParam.trim()}%`))
    }

    const rows = await db
      .select({
        id: transactions.id,
        trxNumber: transactions.trxNumber,
        createdAt: transactions.createdAt,
        payableAmount: transactions.payableAmount,
        paidAmount: transactions.paidAmount,
        changeAmount: transactions.changeAmount,
        status: transactions.status,
        discountAmount: transactions.discountAmount,
        totalAmount: transactions.totalAmount,
        shiftId: transactions.shiftId,
      })
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.createdAt))
      .limit(qParam.trim() ? 10000 : 100)

    txList = rows
  }

  const txIds = txList.map((t) => t.id)

  const [allItems, allPayments] = await Promise.all([
    txIds.length > 0
      ? db
          .select({
            id: transactionItems.id,
            transactionId: transactionItems.transactionId,
            productId: transactionItems.productId,
            productName: products.name,
            uomId: transactionItems.uomId,
            uomCode: unitsOfMeasure.code,
            qty: transactionItems.qty,
            unitPrice: transactionItems.unitPrice,
            totalPrice: transactionItems.totalPrice,
            discountAmount: transactionItems.discountAmount,
            priceTier: transactionItems.priceTier,
          })
          .from(transactionItems)
          .leftJoin(products, eq(transactionItems.productId, products.id))
          .leftJoin(unitsOfMeasure, eq(transactionItems.uomId, unitsOfMeasure.id))
          .where(inArray(transactionItems.transactionId, txIds))
      : Promise.resolve([]),
    txIds.length > 0
      ? db
          .select({
            id: transactionPayments.id,
            transactionId: transactionPayments.transactionId,
            paymentMethodId: transactionPayments.paymentMethodId,
            paymentMethodName: paymentMethods.name,
            amount: transactionPayments.amount,
          })
          .from(transactionPayments)
          .leftJoin(paymentMethods, eq(transactionPayments.paymentMethodId, paymentMethods.id))
          .where(inArray(transactionPayments.transactionId, txIds))
      : Promise.resolve([]),
  ])

  const itemsByTxId = new Map<number, TransactionItemDetail[]>()
  for (const item of allItems) {
    const list = itemsByTxId.get(item.transactionId) ?? []
    list.push({
      id: item.id,
      productId: item.productId,
      productName: item.productName ?? 'Produk Tidak Dikenal',
      uomId: item.uomId,
      uomCode: item.uomCode ?? '-',
      qty: item.qty,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      discountAmount: item.discountAmount,
      priceTier: item.priceTier,
    })
    itemsByTxId.set(item.transactionId, list)
  }

  const paymentsByTxId = new Map<number, TransactionPaymentDetail[]>()
  for (const payment of allPayments) {
    const list = paymentsByTxId.get(payment.transactionId) ?? []
    list.push({
      id: payment.id,
      paymentMethodId: payment.paymentMethodId,
      paymentMethodName: payment.paymentMethodName ?? '-',
      amount: payment.amount,
    })
    paymentsByTxId.set(payment.transactionId, list)
  }

  const transactionsWithDetails: TransactionWithDetails[] = txList.map((tx) => ({
    ...tx,
    createdAt: tx.createdAt.toISOString(),
    items: itemsByTxId.get(tx.id) ?? [],
    payments: paymentsByTxId.get(tx.id) ?? [],
  }))

  return (
    <TransactionHistoryClient
      transactions={transactionsWithDetails}
      branchName={payload.branchName}
      cashierName={payload.userName}
      activeShiftId={activeShift?.id ?? null}
      currentMode={mode}
      currentFrom={mode === 'date' && isValidDateString(fromParam) ? fromParam : undefined}
      currentTo={mode === 'date' && isValidDateString(toParam) ? toParam : undefined}
      currentQ={qParam}
    />
  )
}
