import {
  db,
  internalCreditEntries,
  internalReturns,
  interBranchPayables,
  interBranchPayments,
  interBranchTransfers,
  transactions,
  auditLogs,
  eq,
  and,
  asc,
  inArray,
  isNotNull,
  sql,
} from '@/lib/db'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Executor = typeof db | Tx

/**
 * Saldo Internal (RI7, docs/work/specs/2026-10-11-retur-internal-design.md "Rancangan Saldo Internal
 * otomatis"). Saldo milik pasangan cabang penerima (debitur) → pengirim (kreditur), berasal dari
 * Retur Internal yang nilainya melebihi sisa hutang kirimannya. Saldo TIDAK dibiarkan mengendap
 * selama pasangan itu masih punya tagihan internal terbuka: langsung memotong tagihan tertua, dan
 * tagihan baru ikut dipotong saat muncul. Bukan uang kas — tanpa metode bayar dan tanpa catatan
 * Pendapatan & Pengeluaran.
 */

/** Kunci saldo satu pasangan cabang — penjaga tunggal Saldo Internal (masuk, dipakai, dibatalkan). */
export async function lockInternalCreditPair(tx: Tx, debtorBranchId: number, creditorBranchId: number) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('internal_credit:' || ${debtorBranchId} || ':' || ${creditorBranchId}))`)
}

export async function internalCreditBalance(executor: Executor, debtorBranchId: number, creditorBranchId: number): Promise<number> {
  const [row] = await executor
    .select({ balance: sql<number>`CAST(COALESCE(SUM(${internalCreditEntries.amount}), 0) AS INTEGER)` })
    .from(internalCreditEntries)
    .where(and(eq(internalCreditEntries.debtorBranchId, debtorBranchId), eq(internalCreditEntries.creditorBranchId, creditorBranchId)))
  return Number(row?.balance ?? 0)
}

/** Sisa saldo yang berasal dari SATU dokumen retur (masuk − dipakai − dibatalkan). */
export async function internalCreditRemainingOfReturn(executor: Executor, internalReturnId: number): Promise<number> {
  const [row] = await executor
    .select({ remaining: sql<number>`CAST(COALESCE(SUM(${internalCreditEntries.amount}), 0) AS INTEGER)` })
    .from(internalCreditEntries)
    .where(eq(internalCreditEntries.internalReturnId, internalReturnId))
  return Number(row?.remaining ?? 0)
}

export interface InternalCreditUsage {
  payableId: number
  ibtNumber: string | null
  amount: number
  internalReturnId: number
  returnNumber: string
  /** Kiriman & nota Bulk Sale yang diretur — asal saldo, supaya bisa dilacak tanpa membuka dokumen retur. */
  sourceIbtNumber: string | null
  sourceTrxNumber: string | null
  paymentId: number
}

/**
 * Pakai Saldo Internal pasangan cabang untuk tagihan internal terbuka, dari yang TERTUA. Dipanggil
 * di dalam transaksi setiap kali saldo bertambah atau tagihan pasangan itu muncul/terbuka lagi.
 * Tiap pemakaian = satu baris pembayaran `SALDO_INTERNAL` + satu entri saldo `PAKAI` (negatif) yang
 * menunjuk dokumen retur sumbernya (retur tertua dipakai lebih dulu) + audit. Keterangan baris
 * pembayaran menyebut nomor Retur Internal, nomor IBT, dan nomor nota Bulk Sale asal saldo.
 */
export async function applyInternalCredit(
  tx: Tx,
  params: { debtorBranchId: number; creditorBranchId: number; userId: number; now?: Date },
): Promise<InternalCreditUsage[]> {
  const { debtorBranchId, creditorBranchId, userId } = params
  const now = params.now ?? new Date()
  await lockInternalCreditPair(tx, debtorBranchId, creditorBranchId)

  let balance = await internalCreditBalance(tx, debtorBranchId, creditorBranchId)
  if (balance <= 0) return []

  const sources = await tx
    .select({
      internalReturnId: internalReturns.id,
      returnNumber: internalReturns.returnNumber,
      sourceIbtNumber: interBranchTransfers.ibtNumber,
      sourceTrxNumber: transactions.trxNumber,
      remaining: sql<number>`CAST(SUM(${internalCreditEntries.amount}) AS INTEGER)`,
    })
    .from(internalCreditEntries)
    .innerJoin(internalReturns, eq(internalReturns.id, internalCreditEntries.internalReturnId))
    .leftJoin(interBranchTransfers, eq(interBranchTransfers.id, internalReturns.transferId))
    .leftJoin(transactions, eq(transactions.id, internalReturns.saleTransactionId))
    .where(and(
      eq(internalCreditEntries.debtorBranchId, debtorBranchId),
      eq(internalCreditEntries.creditorBranchId, creditorBranchId),
      isNotNull(internalCreditEntries.internalReturnId),
    ))
    .groupBy(internalReturns.id, internalReturns.returnNumber, interBranchTransfers.ibtNumber, transactions.trxNumber)
    .having(sql`SUM(${internalCreditEntries.amount}) > 0`)
    .orderBy(asc(internalReturns.id))
  if (sources.length === 0) return []

  const openPayables = await tx
    .select()
    .from(interBranchPayables)
    .where(and(
      eq(interBranchPayables.debtorBranchId, debtorBranchId),
      eq(interBranchPayables.creditorBranchId, creditorBranchId),
      inArray(interBranchPayables.status, ['UNPAID', 'PARTIAL']),
    ))
    .orderBy(asc(interBranchPayables.createdAt), asc(interBranchPayables.id))
    .for('update')
  if (openPayables.length === 0) return []

  const transferRows = await tx
    .select({ id: interBranchTransfers.id, ibtNumber: interBranchTransfers.ibtNumber })
    .from(interBranchTransfers)
    .where(inArray(interBranchTransfers.id, openPayables.map(p => p.transferId)))
  const ibtNumberOf = new Map(transferRows.map(t => [t.id, t.ibtNumber]))

  const usages: InternalCreditUsage[] = []
  let sourceIndex = 0
  for (const payable of openPayables) {
    let payableRemaining = payable.totalAmount - payable.paidAmount
    const ibtNumber = ibtNumberOf.get(payable.transferId) ?? null
    while (payableRemaining > 0 && balance > 0 && sourceIndex < sources.length) {
      const source = sources[sourceIndex]
      const amount = Math.min(payableRemaining, balance, Number(source.remaining))
      if (amount <= 0) {
        sourceIndex++
        continue
      }

      const [updated] = await tx
        .update(interBranchPayables)
        .set({
          paidAmount: sql`${interBranchPayables.paidAmount} + ${amount}`,
          status: sql`CASE WHEN ${interBranchPayables.paidAmount} + ${amount} >= ${interBranchPayables.totalAmount} THEN 'PAID' ELSE 'PARTIAL' END`,
          updatedAt: now,
        })
        .where(and(
          eq(interBranchPayables.id, payable.id),
          sql`${interBranchPayables.status} NOT IN ('PAID', 'WAIVED')`,
          sql`${interBranchPayables.paidAmount} + ${amount} <= ${interBranchPayables.totalAmount}`,
        ))
        .returning({ id: interBranchPayables.id })
      if (!updated) throw new Error('INTERNAL_CREDIT_CONFLICT')

      const origin = [source.sourceIbtNumber && `kiriman ${source.sourceIbtNumber}`, source.sourceTrxNumber && `nota ${source.sourceTrxNumber}`]
        .filter(Boolean)
        .join(' / ')
      const [payment] = await tx
        .insert(interBranchPayments)
        .values({
          payableId: payable.id,
          amount,
          paidByUserId: userId,
          sourceType: 'SALDO_INTERNAL',
          referenceNumber: source.returnNumber,
          notes: `Dipotong otomatis dari Saldo Internal — asal Retur Internal ${source.returnNumber}${origin ? ` atas ${origin}` : ''}. Bukan uang kas.`,
          paidAt: now,
        })
        .returning({ id: interBranchPayments.id })

      await tx.insert(internalCreditEntries).values({
        debtorBranchId,
        creditorBranchId,
        amount: -amount,
        sourceType: 'PAKAI',
        internalReturnId: source.internalReturnId,
        payableId: payable.id,
        paymentId: payment.id,
        note: `Dipakai otomatis untuk hutang internal ${ibtNumber ?? `#${payable.id}`} (saldo asal ${source.returnNumber}${origin ? `, ${origin}` : ''})`,
        createdById: userId,
        createdAt: now,
      })

      await tx.insert(auditLogs).values({
        branchId: debtorBranchId,
        userId,
        action: 'INTERNAL_CREDIT_APPLY',
        tableName: 'inter_branch_payables',
        recordId: String(payable.id),
        newData: JSON.stringify({
          ibtNumber,
          amount,
          returnNumber: source.returnNumber,
          sourceIbtNumber: source.sourceIbtNumber,
          sourceTrxNumber: source.sourceTrxNumber,
          paymentId: payment.id,
          debtorBranchId,
          creditorBranchId,
        }),
      })

      usages.push({
        payableId: payable.id,
        ibtNumber,
        amount,
        internalReturnId: source.internalReturnId,
        returnNumber: source.returnNumber,
        sourceIbtNumber: source.sourceIbtNumber,
        sourceTrxNumber: source.sourceTrxNumber,
        paymentId: payment.id,
      })
      payableRemaining -= amount
      balance -= amount
      source.remaining = Number(source.remaining) - amount
      if (source.remaining <= 0) sourceIndex++
    }
    if (balance <= 0 || sourceIndex >= sources.length) break
  }
  return usages
}

/** Saldo Internal yang masih tersisa per pasangan cabang (hanya yang > 0) — untuk layar Hutang Piutang Internal. */
export async function listInternalCreditBalances(executor: Executor = db) {
  const rows = await executor
    .select({
      debtorBranchId: internalCreditEntries.debtorBranchId,
      creditorBranchId: internalCreditEntries.creditorBranchId,
      balance: sql<number>`CAST(SUM(${internalCreditEntries.amount}) AS INTEGER)`,
    })
    .from(internalCreditEntries)
    .groupBy(internalCreditEntries.debtorBranchId, internalCreditEntries.creditorBranchId)
    .having(sql`SUM(${internalCreditEntries.amount}) > 0`)
  return rows.map(r => ({ ...r, balance: Number(r.balance) }))
}
