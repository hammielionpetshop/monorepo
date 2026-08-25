import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import {
  db,
  voidRequests,
  transactions,
  transactionItems,
  transactionPayments,
  products,
  unitsOfMeasure,
  paymentMethods,
  customers,
  branches,
  users,
  eq,
  and,
  inArray,
} from '@/lib/db'
import { transactionEditPayloadSchema } from '@/lib/transaction-edit-schema'

export const dynamic = 'force-dynamic'

interface ItemSnapshot {
  transactionItemId: number | null
  productId: number | null
  productName: string
  uomId: number | null
  uomCode: string
  qty: number
  unitPrice: number
  discountAmount: number
  totalPrice: number
}

type DiffKind = 'UNCHANGED' | 'CHANGED' | 'ADDED' | 'REMOVED'

interface ItemDiffRow {
  kind: DiffKind
  before: ItemSnapshot | null
  after: ItemSnapshot | null
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requirePermission('void.approve')
  if (gate instanceof NextResponse) return gate

  const { id } = await params
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'ID pengajuan tidak valid' }, { status: 400 })
  }
  const requestId = parseInt(id, 10)

  try {
    const [request] = await db
      .select({
        id: voidRequests.id,
        status: voidRequests.status,
        kind: voidRequests.kind,
        payload: voidRequests.payload,
        reason: voidRequests.reason,
        createdAt: voidRequests.createdAt,
        updatedAt: voidRequests.updatedAt,
        transactionId: voidRequests.transactionId,
        requestByName: users.name,
      })
      .from(voidRequests)
      .leftJoin(users, eq(voidRequests.requestById, users.id))
      .where(eq(voidRequests.id, requestId))
      .limit(1)

    if (!request) {
      return NextResponse.json({ error: 'Permintaan tidak ditemukan' }, { status: 404 })
    }

    const [trx] = await db
      .select({
        id: transactions.id,
        trxNumber: transactions.trxNumber,
        branchId: transactions.branchId,
        branchName: branches.name,
        cashierName: users.name,
        customerId: transactions.customerId,
        customerName: customers.name,
        status: transactions.status,
        totalAmount: transactions.totalAmount,
        discountAmount: transactions.discountAmount,
        payableAmount: transactions.payableAmount,
        paidAmount: transactions.paidAmount,
        changeAmount: transactions.changeAmount,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .leftJoin(branches, eq(transactions.branchId, branches.id))
      .leftJoin(users, eq(transactions.cashierId, users.id))
      .leftJoin(customers, eq(transactions.customerId, customers.id))
      .where(eq(transactions.id, request.transactionId))
      .limit(1)

    if (!trx) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 })
    }

    // Item aktif nota saat ini — dasar "sebelum" untuk kedua jenis permintaan.
    const currentItemRows = await db
      .select({
        id: transactionItems.id,
        productId: transactionItems.productId,
        productName: transactionItems.productName,
        uomId: transactionItems.uomId,
        uomCode: unitsOfMeasure.code,
        qty: transactionItems.qty,
        unitPrice: transactionItems.unitPrice,
        discountAmount: transactionItems.discountAmount,
        totalPrice: transactionItems.totalPrice,
      })
      .from(transactionItems)
      .leftJoin(unitsOfMeasure, eq(transactionItems.uomId, unitsOfMeasure.id))
      .where(and(eq(transactionItems.transactionId, trx.id), eq(transactionItems.isRemoved, false)))

    const currentItems: ItemSnapshot[] = currentItemRows.map((i) => ({
      transactionItemId: i.id,
      productId: i.productId,
      productName: i.productName ?? 'Produk Tidak Dikenal',
      uomId: i.uomId,
      uomCode: i.uomCode ?? '-',
      qty: i.qty,
      unitPrice: i.unitPrice,
      discountAmount: i.discountAmount,
      totalPrice: i.totalPrice,
    }))

    const currentPaymentRows = await db
      .select({
        id: transactionPayments.id,
        paymentMethodId: transactionPayments.paymentMethodId,
        paymentMethodName: paymentMethods.name,
        amount: transactionPayments.amount,
      })
      .from(transactionPayments)
      .leftJoin(paymentMethods, eq(transactionPayments.paymentMethodId, paymentMethods.id))
      .where(eq(transactionPayments.transactionId, trx.id))

    const base = {
      request: {
        id: request.id,
        status: request.status,
        kind: request.kind,
        reason: request.reason,
        createdAt: request.createdAt instanceof Date ? request.createdAt.toISOString() : String(request.createdAt),
        updatedAt: request.updatedAt instanceof Date ? request.updatedAt.toISOString() : String(request.updatedAt),
        requestByName: request.requestByName ?? 'Tidak diketahui',
      },
      transaction: {
        id: trx.id,
        trxNumber: trx.trxNumber,
        branchName: trx.branchName ?? '-',
        cashierName: trx.cashierName ?? '-',
        customerName: trx.customerName ?? null,
        status: trx.status,
        totalAmount: trx.totalAmount,
        discountAmount: trx.discountAmount,
        payableAmount: trx.payableAmount,
        paidAmount: trx.paidAmount,
        changeAmount: trx.changeAmount,
        createdAt: trx.createdAt instanceof Date ? trx.createdAt.toISOString() : String(trx.createdAt),
      },
      currentItems,
      currentPayments: currentPaymentRows.map((p) => ({
        ...p,
        paymentMethodName: p.paymentMethodName ?? '-',
      })),
    }

    if (request.kind !== 'KOREKSI') {
      return NextResponse.json(base)
    }

    // Muatan koreksi divalidasi lagi di sini murni untuk ditampilkan — kalau sudah basi,
    // tetap tunjukkan datanya apa adanya dengan tanda "tidak valid lagi", jangan disembunyikan.
    const parsed = transactionEditPayloadSchema.safeParse(request.payload)
    if (!parsed.success) {
      return NextResponse.json({
        ...base,
        payloadInvalid: true,
        payloadInvalidReason: parsed.error.issues[0]?.message ?? 'Bentuk data koreksi tidak dikenali',
      })
    }

    const payloadItems = parsed.data.items
    const productIds = Array.from(new Set(payloadItems.map((i) => i.productId)))
    const uomIds = Array.from(new Set(payloadItems.map((i) => i.uomId)))
    const paymentMethodIds = Array.from(new Set(parsed.data.payments.map((p) => p.paymentMethodId)))

    const [productRows, uomRows, methodRows, newCustomer] = await Promise.all([
      productIds.length > 0
        ? db.select({ id: products.id, name: products.name }).from(products).where(inArray(products.id, productIds))
        : Promise.resolve([]),
      uomIds.length > 0
        ? db.select({ id: unitsOfMeasure.id, code: unitsOfMeasure.code }).from(unitsOfMeasure).where(inArray(unitsOfMeasure.id, uomIds))
        : Promise.resolve([]),
      paymentMethodIds.length > 0
        ? db.select({ id: paymentMethods.id, name: paymentMethods.name }).from(paymentMethods).where(inArray(paymentMethods.id, paymentMethodIds))
        : Promise.resolve([]),
      parsed.data.customerId
        ? db.select({ id: customers.id, name: customers.name }).from(customers).where(eq(customers.id, parsed.data.customerId)).limit(1)
        : Promise.resolve([]),
    ])

    const productNameById = new Map(productRows.map((p) => [p.id, p.name]))
    const uomCodeById = new Map(uomRows.map((u) => [u.id, u.code]))
    const methodNameById = new Map(methodRows.map((m) => [m.id, m.name]))

    function toGross(qty: number, unitPrice: number): number {
      return qty * unitPrice
    }
    function toNet(qty: number, unitPrice: number, discount: number): number {
      return Math.max(0, toGross(qty, unitPrice) - discount)
    }

    const afterItems: ItemSnapshot[] = payloadItems.map((i) => ({
      transactionItemId: i.transactionItemId,
      productId: i.productId,
      productName: productNameById.get(i.productId) ?? 'Produk Tidak Dikenal',
      uomId: i.uomId,
      uomCode: uomCodeById.get(i.uomId) ?? '-',
      qty: i.qty,
      unitPrice: i.unitPrice,
      discountAmount: i.discountAmount,
      totalPrice: toNet(i.qty, i.unitPrice, i.discountAmount),
    }))

    // Cocokkan dengan `transactionItemId` — sama seperti yang dipakai
    // `TransactionEditService.editTransaction` saat benar-benar diterapkan: ganti
    // produk/satuan diperlakukan sebagai hapus baris lama + tambah baris baru.
    const currentById = new Map(currentItems.map((i) => [i.transactionItemId, i]))
    const keptIds = new Set<number>()
    const itemDiff: ItemDiffRow[] = []

    for (const after of afterItems) {
      const before = after.transactionItemId != null ? currentById.get(after.transactionItemId) : undefined
      if (!before || before.productId !== after.productId || before.uomId !== after.uomId) {
        itemDiff.push({ kind: 'ADDED', before: null, after })
        continue
      }
      keptIds.add(before.transactionItemId as number)
      const changed =
        before.qty !== after.qty ||
        before.unitPrice !== after.unitPrice ||
        before.discountAmount !== after.discountAmount
      itemDiff.push({ kind: changed ? 'CHANGED' : 'UNCHANGED', before, after })
    }

    for (const before of currentItems) {
      if (before.transactionItemId != null && !keptIds.has(before.transactionItemId)) {
        itemDiff.push({ kind: 'REMOVED', before, after: null })
      }
    }

    return NextResponse.json({
      ...base,
      payloadInvalid: false,
      afterItems,
      itemDiff,
      afterPayments: parsed.data.payments.map((p) => ({
        paymentMethodId: p.paymentMethodId,
        paymentMethodName: methodNameById.get(p.paymentMethodId) ?? '-',
        amount: p.amount,
        referenceNumber: p.referenceNumber ?? null,
      })),
      afterCustomerName: newCustomer[0]?.name ?? (parsed.data.customerId ? 'Pelanggan Tidak Dikenal' : null),
      afterDueAt: parsed.data.dueAt ?? null,
    })
  } catch (error: unknown) {
    console.error('[void-requests/detail] GET error:', error)
    return NextResponse.json({ error: 'Gagal mengambil detail permintaan' }, { status: 500 })
  }
}
