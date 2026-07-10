import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import {
  db, transactions, transactionItems, transactionPayments,
  products, unitsOfMeasure, paymentMethods, users, customers, branches,
  eq, and, inArray, sql,
} from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ trxNumber: string }> }
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid' }, { status: 401 })
    }

    const { trxNumber } = await params

    // Non-privileged users can only see their own branch
    const isPrivileged = ['OWNER', 'GM'].includes(payload.role)
    const branchConditions = isPrivileged
      ? [eq(transactions.trxNumber, trxNumber)]
      : [eq(transactions.trxNumber, trxNumber), eq(transactions.branchId, payload.branchId)]

    const [trx] = await db
      .select({
        id: transactions.id,
        trxNumber: transactions.trxNumber,
        branchId: transactions.branchId,
        branchName: branches.name,
        cashierId: transactions.cashierId,
        cashierName: users.name,
        customerId: transactions.customerId,
        customerName: customers.name,
        totalAmount: transactions.totalAmount,
        discountAmount: transactions.discountAmount,
        payableAmount: transactions.payableAmount,
        paidAmount: transactions.paidAmount,
        changeAmount: transactions.changeAmount,
        status: transactions.status,
        saleType: transactions.saleType,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .leftJoin(branches, eq(transactions.branchId, branches.id))
      .leftJoin(users, eq(transactions.cashierId, users.id))
      .leftJoin(customers, eq(transactions.customerId, customers.id))
      .where(and(...branchConditions))
      .limit(1)

    if (!trx) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 })
    }

    // Fetch items
    const items = await db
      .select({
        id: transactionItems.id,
        productId: transactionItems.productId,
        productName: sql<string>`COALESCE(${transactionItems.productName}, ${products.name})`,
        uomId: transactionItems.uomId,
        uomCode: unitsOfMeasure.code,
        qty: transactionItems.qty,
        unitPrice: transactionItems.unitPrice,
        totalPrice: transactionItems.totalPrice,
        discountAmount: transactionItems.discountAmount,
        priceTier: transactionItems.priceTier,
        productSku: sql<string>`COALESCE(${transactionItems.productSku}, ${products.sku})`,
      })
      .from(transactionItems)
      .leftJoin(products, eq(transactionItems.productId, products.id))
      .leftJoin(unitsOfMeasure, eq(transactionItems.uomId, unitsOfMeasure.id))
      .where(eq(transactionItems.transactionId, trx.id))

    // Fetch payments
    const payments = await db
      .select({
        id: transactionPayments.id,
        paymentMethodId: transactionPayments.paymentMethodId,
        paymentMethodName: paymentMethods.name,
        amount: transactionPayments.amount,
      })
      .from(transactionPayments)
      .leftJoin(paymentMethods, eq(transactionPayments.paymentMethodId, paymentMethods.id))
      .where(eq(transactionPayments.transactionId, trx.id))

    return NextResponse.json({
      ...trx,
      branchName: trx.branchName ?? '-',
      cashierName: trx.cashierName ?? '-',
      customerName: trx.customerName ?? null,
      createdAt: trx.createdAt instanceof Date ? trx.createdAt.toISOString() : String(trx.createdAt),
      items: items.map(i => ({
        ...i,
        productName: i.productName ?? 'Produk Tidak Dikenal',
        uomCode: i.uomCode ?? '-',
        productSku: i.productSku ?? '',
      })),
      payments: payments.map(p => ({
        ...p,
        paymentMethodName: p.paymentMethodName ?? '-',
      })),
    })
  } catch (error: unknown) {
    console.error('[bo/transactions/detail] GET error:', error)
    return NextResponse.json({ error: 'Gagal mengambil detail transaksi' }, { status: 500 })
  }
}
