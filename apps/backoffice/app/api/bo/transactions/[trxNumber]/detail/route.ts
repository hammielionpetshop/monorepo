import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/authz'
import {
  db, transactions, transactionItems, transactionPayments, transactionEdits,
  products, unitsOfMeasure, paymentMethods, users, customers, branches,
  productUomConversions,
  eq, and, inArray, desc, sql,
} from '@/lib/db'
import { resolveUomWeightGram } from '@/lib/delivery-note-weight'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ trxNumber: string }> }
) {
  try {
    const payload = await getAuth()
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid' }, { status: 401 })
    }

    const { trxNumber } = await params

    // Non-privileged users can only see their own branch
    const isPrivileged = payload.branchScope === 'ALL'
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
        // Bahan tonase surat jalan. Konversi hanya ada untuk UOM non-base;
        // UOM base tidak punya baris konversi → ratio dianggap 1.
        baseWeightGram: products.weightGram,
        uomWeightGram: productUomConversions.weightGram,
        conversionRate: productUomConversions.ratio,
      })
      .from(transactionItems)
      .leftJoin(products, eq(transactionItems.productId, products.id))
      .leftJoin(unitsOfMeasure, eq(transactionItems.uomId, unitsOfMeasure.id))
      .leftJoin(
        productUomConversions,
        and(
          eq(productUomConversions.productId, transactionItems.productId),
          eq(productUomConversions.uomId, transactionItems.uomId),
        ),
      )
      // Item yang dihapus lewat koreksi tetap tersimpan (menahan mutasi stok aslinya)
      // tapi bukan lagi bagian dari nota
      .where(and(eq(transactionItems.transactionId, trx.id), eq(transactionItems.isRemoved, false)))

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

    // Riwayat koreksi — ditampilkan agar perubahan qty/produk setelah nota terbit bisa ditelusuri
    const edits = await db
      .select({
        id: transactionEdits.id,
        revision: transactionEdits.revision,
        reason: transactionEdits.reason,
        createdAt: transactionEdits.createdAt,
        editedByName: users.name,
        beforeData: transactionEdits.beforeData,
        afterData: transactionEdits.afterData,
      })
      .from(transactionEdits)
      .leftJoin(users, eq(users.id, transactionEdits.editedById))
      .where(eq(transactionEdits.transactionId, trx.id))
      .orderBy(desc(transactionEdits.revision))

    return NextResponse.json({
      ...trx,
      branchName: trx.branchName ?? '-',
      cashierName: trx.cashierName ?? '-',
      customerName: trx.customerName ?? null,
      createdAt: trx.createdAt instanceof Date ? trx.createdAt.toISOString() : String(trx.createdAt),
      items: items.map(({ baseWeightGram, uomWeightGram, conversionRate, ...i }) => ({
        ...i,
        productName: i.productName ?? 'Produk Tidak Dikenal',
        uomCode: i.uomCode ?? '-',
        productSku: i.productSku ?? '',
        weightGram: resolveUomWeightGram(uomWeightGram, baseWeightGram, conversionRate ?? 1),
      })),
      payments: payments.map(p => ({
        ...p,
        paymentMethodName: p.paymentMethodName ?? '-',
      })),
      edits: edits.map(e => ({
        ...e,
        editedByName: e.editedByName ?? 'Tidak diketahui',
        createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : String(e.createdAt),
      })),
    })
  } catch (error: unknown) {
    console.error('[bo/transactions/detail] GET error:', error)
    return NextResponse.json({ error: 'Gagal mengambil detail transaksi' }, { status: 500 })
  }
}
