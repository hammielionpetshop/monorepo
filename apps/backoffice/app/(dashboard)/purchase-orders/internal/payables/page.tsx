import { redirect } from 'next/navigation'
import { getAuth, hasPermission, scopeFilterAny } from '@/lib/authz'
import { todayWibDate } from '@/lib/payment-date'
import { NewBadge } from '@/components/ui/new-badge'
import {
  db,
  interBranchPayables,
  interBranchPayments,
  interBranchTransfers,
  branches,
  paymentMethods,
  users,
  auditLogs,
  eq,
  ne,
  and,
  desc,
  asc,
  inArray,
} from '@/lib/db'
import { alias } from 'drizzle-orm/pg-core'
import { listInternalCreditBalances } from '@/lib/services/internal-credit-service'
import { PayablesClient } from './_components/payables-client'
import type { PayablePayment, WaiveInfo } from './_components/types'

export const dynamic = 'force-dynamic'

export default async function InterBranchPayablesPage() {
  const payload = await getAuth()
  if (!payload) redirect('/login')

  const debtorBranch = alias(branches, 'debtor_branch')
  const creditorBranch = alias(branches, 'creditor_branch')

  // Pembatasan cabang di level query, bukan di UI: user non-global hanya melihat hutang
  // yang cabangnya jadi debitur ATAU kreditur. Dropdown cabang di client menyaring
  // di atas hasil ini, jadi ia mempersempit — tidak pernah melebarkan.
  const branchScope = scopeFilterAny(
    payload,
    interBranchPayables.debtorBranchId,
    interBranchPayables.creditorBranchId
  )

  const payables = await db
    .select({
      id: interBranchPayables.id,
      transferId: interBranchPayables.transferId,
      ibtNumber: interBranchTransfers.ibtNumber,
      debtorBranchId: interBranchPayables.debtorBranchId,
      debtorBranchName: debtorBranch.name,
      creditorBranchId: interBranchPayables.creditorBranchId,
      creditorBranchName: creditorBranch.name,
      totalAmount: interBranchPayables.totalAmount,
      paidAmount: interBranchPayables.paidAmount,
      status: interBranchPayables.status,
      notes: interBranchPayables.notes,
      dueAt: interBranchPayables.dueAt,
      createdAt: interBranchPayables.createdAt,
    })
    .from(interBranchPayables)
    .leftJoin(interBranchTransfers, eq(interBranchPayables.transferId, interBranchTransfers.id))
    .leftJoin(debtorBranch, eq(interBranchPayables.debtorBranchId, debtorBranch.id))
    .leftJoin(creditorBranch, eq(interBranchPayables.creditorBranchId, creditorBranch.id))
    .where(branchScope)
    // Urut by No. IBT terbaru dulu (format IBT-YYYYMMDD-XXXX, jadi lexicographic = kronologis).
    // id sebagai tie-breaker supaya urutan stabil. Client memakai urutan ini apa adanya.
    .orderBy(desc(interBranchTransfers.ibtNumber), desc(interBranchPayables.id))

  const ids = payables.map(p => p.id)

  const paymentRows = ids.length === 0 ? [] : await db
    .select({
      id: interBranchPayments.id,
      payableId: interBranchPayments.payableId,
      amount: interBranchPayments.amount,
      methodName: paymentMethods.name,
      sourceType: interBranchPayments.sourceType,
      referenceNumber: interBranchPayments.referenceNumber,
      notes: interBranchPayments.notes,
      paidAt: interBranchPayments.paidAt,
      paidByName: users.name,
    })
    .from(interBranchPayments)
    .leftJoin(paymentMethods, eq(interBranchPayments.paymentMethodId, paymentMethods.id))
    .leftJoin(users, eq(interBranchPayments.paidByUserId, users.id))
    .where(inArray(interBranchPayments.payableId, ids))
    .orderBy(asc(interBranchPayments.paidAt), asc(interBranchPayments.id))

  const INTERNAL_PAYMENT_SOURCE_LABELS: Record<string, string> = {
    RETUR_INTERNAL: 'RETUR INTERNAL',
    SALDO_INTERNAL: 'SALDO INTERNAL',
    BATAL_RETUR: 'BATAL RETUR INTERNAL',
  }
  const paymentsByPayable = new Map<number, PayablePayment[]>()
  for (const p of paymentRows) {
    const list = paymentsByPayable.get(p.payableId) ?? []
    list.push({
      id: p.id,
      amount: p.amount,
      // Baris otomatis Retur/Saldo Internal tidak punya metode bayar — bukan uang kas.
      methodName: p.sourceType ? (INTERNAL_PAYMENT_SOURCE_LABELS[p.sourceType] ?? p.sourceType) : p.methodName,
      referenceNumber: p.referenceNumber,
      notes: p.notes,
      paidAt: p.paidAt.toISOString(),
      paidByName: p.paidByName,
    })
    paymentsByPayable.set(p.payableId, list)
  }

  // Siapa & kapan menghapus hutang — dari audit IBP_WAIVED. Hutang yang dihapus sebelum
  // audit ini ada tidak punya baris, dan tampil sebagai "tidak tercatat".
  const waivedIds = payables.filter(p => p.status === 'WAIVED').map(p => String(p.id))
  const waiveRows = waivedIds.length === 0 ? [] : await db
    .select({
      recordId: auditLogs.recordId,
      newData: auditLogs.newData,
      createdAt: auditLogs.createdAt,
      userName: users.name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(and(
      eq(auditLogs.action, 'IBP_WAIVED'),
      eq(auditLogs.tableName, 'inter_branch_payables'),
      inArray(auditLogs.recordId, waivedIds),
    ))
    .orderBy(desc(auditLogs.createdAt))

  const waiveByPayable = new Map<number, WaiveInfo>()
  for (const w of waiveRows) {
    const pid = Number(w.recordId)
    if (waiveByPayable.has(pid)) continue
    let reason: string | null = null
    try {
      reason = JSON.parse(w.newData ?? '{}').reason ?? null
    } catch {
      reason = null
    }
    waiveByPayable.set(pid, { byName: w.userName, at: w.createdAt.toISOString(), reason })
  }

  const serialized = payables.map(p => ({
    ...p,
    dueAt: p.dueAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    payments: paymentsByPayable.get(p.id) ?? [],
    waive: waiveByPayable.get(p.id) ?? null,
  }))

  // Saldo Internal yang belum terpakai (RI7) — hanya tersisa bila pasangan cabang itu sedang tidak
  // punya tagihan terbuka; akan memotong tagihan berikutnya secara otomatis.
  const branchNames = new Map((await db.select({ id: branches.id, name: branches.name }).from(branches)).map(b => [b.id, b.name]))
  const creditBalances = (await listInternalCreditBalances())
    .filter(c => payload.branchScope === 'ALL' || c.debtorBranchId === payload.branchId || c.creditorBranchId === payload.branchId)
    .map(c => ({
      ...c,
      debtorBranchName: branchNames.get(c.debtorBranchId) ?? `Cabang #${c.debtorBranchId}`,
      creditorBranchName: branchNames.get(c.creditorBranchId) ?? `Cabang #${c.creditorBranchId}`,
    }))

  const methods = await db
    .select({ id: paymentMethods.id, name: paymentMethods.name })
    .from(paymentMethods)
    .where(ne(paymentMethods.type, 'DEBT'))
    .orderBy(asc(paymentMethods.id))

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Hutang Piutang Transfer Internal</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {payload.branchScope === 'ALL'
            ? 'Pencatatan hutang antar cabang dari transfer stok internal, seluruh cabang'
            : `Pencatatan hutang antar cabang dari transfer stok internal yang melibatkan ${payload.branchName}`}
        </p>
      </div>
      {creditBalances.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <p className="flex items-center gap-2 font-medium text-foreground">Saldo Internal yang belum terpakai <NewBadge feature="fitur/saldo-internal" /></p>
          <ul className="mt-1 space-y-0.5">
            {creditBalances.map(c => (
              <li key={`${c.debtorBranchId}-${c.creditorBranchId}`} className="text-foreground">
                {c.debtorBranchName} di {c.creditorBranchName}: <b>Rp {c.balance.toLocaleString('id-ID')}</b>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted-foreground">
            Berasal dari Retur Internal. Otomatis memotong tagihan internal berikutnya (tercatat sebagai SALDO INTERNAL di
            Riwayat pembayaran) — bukan uang kas.
          </p>
        </div>
      )}
      <PayablesClient
        payables={serialized}
        canPay={hasPermission(payload, 'payable.pay')}
        canWaive={hasPermission(payload, 'payable.waive')}
        paymentMethods={methods}
        today={todayWibDate()}
      />
    </div>
  )
}
