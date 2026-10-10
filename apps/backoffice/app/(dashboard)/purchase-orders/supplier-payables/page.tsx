import { redirect } from 'next/navigation'
import { getAuth, hasPermission, scopeFilter } from '@/lib/authz'
import { todayWibDate } from '@/lib/payment-date'
import { supplierDueDate } from '@/lib/supplier-due-date'
import { loadPendingPriceEstimates } from '@/lib/po-pending-estimate'
import { supplierCreditBalances } from '@/lib/services/supplier-return-service'
import {
  db,
  supplierPayables,
  supplierPayablePayments,
  purchaseOrders,
  suppliers,
  branches,
  users,
  paymentMethods,
  eq,
  ne,
  asc,
  desc,
  inArray,
} from '@/lib/db'
import { SupplierPayablesClient } from './_components/supplier-payables-client'
import type { SupplierPayable, SupplierPayment } from './_components/types'

export const dynamic = 'force-dynamic'

export default async function SupplierPayablesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const payload = await getAuth()
  if (!payload) redirect('/login')
  const { q } = await searchParams

  const rows = await db
    .select({
      id: supplierPayables.id,
      poId: supplierPayables.poId,
      poNumber: purchaseOrders.poNumber,
      invoiceNumber: purchaseOrders.invoiceNumber,
      supplierId: supplierPayables.supplierId,
      supplierName: suppliers.name,
      branchId: purchaseOrders.branchId,
      branchName: branches.name,
      totalAmount: supplierPayables.totalAmount,
      paidAmount: supplierPayables.paidAmount,
      status: supplierPayables.status,
      createdAt: supplierPayables.createdAt,
      dueAt: supplierPayables.dueAt,
      paymentTermDays: suppliers.paymentTermDays,
    })
    .from(supplierPayables)
    .innerJoin(purchaseOrders, eq(supplierPayables.poId, purchaseOrders.id))
    .leftJoin(suppliers, eq(supplierPayables.supplierId, suppliers.id))
    .leftJoin(branches, eq(purchaseOrders.branchId, branches.id))
    .where(scopeFilter(payload, purchaseOrders.branchId))
    .orderBy(desc(supplierPayables.createdAt), desc(supplierPayables.id))

  const ids = rows.map(r => r.id)
  const paymentRows = ids.length === 0 ? [] : await db
    .select({
      id: supplierPayablePayments.id,
      payableId: supplierPayablePayments.payableId,
      amount: supplierPayablePayments.amount,
      method: supplierPayablePayments.method,
      referenceNumber: supplierPayablePayments.referenceNumber,
      note: supplierPayablePayments.note,
      paidAt: supplierPayablePayments.paidAt,
      paidByName: users.name,
    })
    .from(supplierPayablePayments)
    .leftJoin(users, eq(supplierPayablePayments.paidById, users.id))
    .where(inArray(supplierPayablePayments.payableId, ids))
    .orderBy(asc(supplierPayablePayments.paidAt), asc(supplierPayablePayments.id))

  const paymentsByPayable = new Map<number, SupplierPayment[]>()
  for (const p of paymentRows) {
    const list = paymentsByPayable.get(p.payableId) ?? []
    list.push({
      id: p.id,
      amount: p.amount,
      method: p.method,
      referenceNumber: p.referenceNumber,
      note: p.note,
      paidAt: p.paidAt.toISOString(),
      paidByName: p.paidByName,
    })
    paymentsByPayable.set(p.payableId, list)
  }

  const pendingByPo = await loadPendingPriceEstimates(rows.map(r => r.poId))

  const payables: SupplierPayable[] = rows.map(({ dueAt, ...r }) => {
    const pending = pendingByPo.get(r.poId)
    return {
      ...r,
      createdAt: r.createdAt.toISOString(),
      dueDate: supplierDueDate(r.createdAt, r.paymentTermDays, dueAt),
      pricePendingItems: pending?.pendingItems ?? 0,
      estimatedTotal: r.totalAmount + (pending?.extraEstimate ?? 0),
      payments: paymentsByPayable.get(r.id) ?? [],
    }
  })

  // Saldo supplier (kelebihan retur) — hanya yang masih tersisa.
  const balances = await supplierCreditBalances(db)
  const supplierNames = new Map(rows.map(r => [r.supplierId, r.supplierName]))
  const missingNames = [...balances.keys()].filter(id => !supplierNames.has(id))
  if (missingNames.length > 0) {
    const extra = await db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(inArray(suppliers.id, missingNames))
    for (const s of extra) supplierNames.set(s.id, s.name)
  }
  const supplierCredits = [...balances.entries()]
    .filter(([, balance]) => balance > 0)
    .map(([supplierId, balance]) => ({ supplierId, supplierName: supplierNames.get(supplierId) ?? '-', balance }))
    .sort((a, b) => b.balance - a.balance)

  const methods = await db
    .select({ id: paymentMethods.id, name: paymentMethods.name })
    .from(paymentMethods)
    .where(ne(paymentMethods.type, 'DEBT'))
    .orderBy(asc(paymentMethods.id))

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Hutang Supplier</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tagihan dari PO supplier yang sudah diterima. Catat setiap pembayaran ke supplier di sini
          {payload.branchScope === 'ALL' ? ' — seluruh cabang.' : ` — cabang ${payload.branchName}.`}
        </p>
      </div>
      <SupplierPayablesClient
        payables={payables}
        canPay={hasPermission(payload, 'payable.pay')}
        paymentMethods={methods}
        supplierCredits={supplierCredits}
        today={todayWibDate()}
        initialSearch={q ?? null}
      />
    </div>
  )
}
