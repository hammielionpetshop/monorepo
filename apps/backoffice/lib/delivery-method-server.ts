import type { JWTPayload } from '@petshop/shared'
import {
  db,
  appSettings,
  transactions,
  interBranchTransfers,
  serviceDeliveries,
  deliveryMethodChanges,
  users,
  eq,
  and,
  isNull,
  inArray,
  desc,
} from '@/lib/db'
import {
  DeliveryMethodError,
  REQUIRED_SETTING_KEY,
  TRUCK_FIRST_SETTING_KEY,
  deliveryChangeProblem,
  isSaleDeliveryMethod,
  isTransferDeliveryMethod,
  parseDeliverySettings,
} from '@/lib/delivery-method'

export type DeliverySettings = ReturnType<typeof parseDeliverySettings>

export async function getDeliverySettings(): Promise<DeliverySettings> {
  const rows = await db
    .select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings)
    .where(inArray(appSettings.key, [REQUIRED_SETTING_KEY, TRUCK_FIRST_SETTING_KEY]))
  const map = new Map(rows.map((r) => [r.key, r.value]))
  return parseDeliverySettings(map.get(REQUIRED_SETTING_KEY) ?? null, map.get(TRUCK_FIRST_SETTING_KEY) ?? null)
}

export async function setDeliverySettings(next: DeliverySettings, userId: number): Promise<DeliverySettings> {
  const values = [
    { key: REQUIRED_SETTING_KEY, value: next.required ? 'true' : 'false' },
    { key: TRUCK_FIRST_SETTING_KEY, value: [...new Set(next.truckFirstBranchIds)].sort((a, b) => a - b).join(',') },
  ]
  await db.transaction(async (tx) => {
    for (const v of values) {
      await tx
        .insert(appSettings)
        .values({ ...v, updatedBy: userId, updatedAt: new Date() })
        .onConflictDoUpdate({ target: appSettings.key, set: { value: v.value, updatedBy: userId, updatedAt: new Date() } })
    }
  })
  return getDeliverySettings()
}

const isPrivileged = (payload: JWTPayload) => ['OWNER', 'GM'].includes(payload.role)

/** Ubah cara kirim satu nota (jalan keluar salah tandai), tercatat di riwayat. */
export async function changeTransactionDeliveryMethod(
  payload: JWTPayload,
  input: { transactionId: number; newMethod: string; reason: string },
) {
  if (!isSaleDeliveryMethod(input.newMethod)) throw new DeliveryMethodError('Cara kirim tidak dikenal')
  return db.transaction(async (tx) => {
    const [trx] = await tx
      .select({
        id: transactions.id,
        branchId: transactions.branchId,
        customerId: transactions.customerId,
        sourceIbtId: transactions.sourceIbtId,
        status: transactions.status,
        createdAt: transactions.createdAt,
        deliveryMethod: transactions.deliveryMethod,
      })
      .from(transactions)
      .where(eq(transactions.id, input.transactionId))
      .for('update')
      .limit(1)
    if (!trx) throw new DeliveryMethodError('Nota tidak ditemukan', 404)
    if (trx.status !== 'COMPLETED') throw new DeliveryMethodError('Nota yang sudah dibatalkan tidak bisa diubah cara kirimnya.')
    if (trx.sourceIbtId != null) throw new DeliveryMethodError('Nota PO Internal: ubah cara kirim di PO Internal-nya.')
    if (trx.customerId == null) {
      throw new DeliveryMethodError('Nota Umum tidak punya cara kirim. Isi pelanggannya lewat koreksi nota dulu.')
    }
    const problem = deliveryChangeProblem({
      isPrivileged: isPrivileged(payload),
      sameBranch: trx.branchId === payload.branchId,
      createdAt: trx.createdAt,
      now: new Date(),
      oldMethod: trx.deliveryMethod,
      newMethod: input.newMethod,
      reason: input.reason,
    })
    if (problem) throw new DeliveryMethodError(problem, 403)

    // Ongkir & bonus pengantar milik kasir: antar yang masih aktif harus dibatalkan dulu.
    if (input.newMethod !== 'BRANCH_COURIER') {
      const [activeCourier] = await tx
        .select({ id: serviceDeliveries.id })
        .from(serviceDeliveries)
        .where(and(eq(serviceDeliveries.transactionId, trx.id), isNull(serviceDeliveries.cancelledAt)))
        .limit(1)
      if (activeCourier) {
        throw new DeliveryMethodError('Nota ini masih punya antar + ongkir aktif. Batalkan antarnya dulu di kasir, baru ubah cara kirim.')
      }
    }

    await tx.update(transactions).set({ deliveryMethod: input.newMethod, updatedAt: new Date() }).where(eq(transactions.id, trx.id))
    await tx.insert(deliveryMethodChanges).values({
      documentType: 'TRANSACTION',
      documentId: trx.id,
      branchId: trx.branchId,
      oldMethod: trx.deliveryMethod,
      newMethod: input.newMethod,
      reason: input.reason.trim(),
      changedById: payload.userId,
    })
    return { id: trx.id, deliveryMethod: input.newMethod }
  })
}

/** Ubah cara kirim PO Internal yang sudah dikirim, tercatat di riwayat. */
export async function changeTransferDeliveryMethod(
  payload: JWTPayload,
  input: { transferId: number; newMethod: string; reason: string },
) {
  if (!isTransferDeliveryMethod(input.newMethod)) throw new DeliveryMethodError('Cara kirim PO Internal tidak dikenal')
  return db.transaction(async (tx) => {
    const [ibt] = await tx
      .select({
        id: interBranchTransfers.id,
        sourceBranchId: interBranchTransfers.sourceBranchId,
        status: interBranchTransfers.status,
        createdAt: interBranchTransfers.createdAt,
        deliveryMethod: interBranchTransfers.deliveryMethod,
      })
      .from(interBranchTransfers)
      .where(eq(interBranchTransfers.id, input.transferId))
      .for('update')
      .limit(1)
    if (!ibt) throw new DeliveryMethodError('PO Internal tidak ditemukan', 404)
    if (ibt.status === 'CANCELLED') throw new DeliveryMethodError('PO Internal yang dibatalkan tidak bisa diubah cara kirimnya.')
    if (ibt.deliveryMethod == null) {
      throw new DeliveryMethodError('Cara kirim PO Internal dipilih saat menekan Kirim.')
    }
    const problem = deliveryChangeProblem({
      isPrivileged: isPrivileged(payload),
      sameBranch: ibt.sourceBranchId === payload.branchId,
      createdAt: ibt.createdAt,
      now: new Date(),
      oldMethod: ibt.deliveryMethod,
      newMethod: input.newMethod,
      reason: input.reason,
    })
    if (problem) throw new DeliveryMethodError(problem, 403)

    await tx
      .update(interBranchTransfers)
      .set({ deliveryMethod: input.newMethod, updatedAt: new Date() })
      .where(eq(interBranchTransfers.id, ibt.id))
    await tx.insert(deliveryMethodChanges).values({
      documentType: 'INTERNAL_TRANSFER',
      documentId: ibt.id,
      branchId: ibt.sourceBranchId,
      oldMethod: ibt.deliveryMethod,
      newMethod: input.newMethod,
      reason: input.reason.trim(),
      changedById: payload.userId,
    })
    return { id: ibt.id, deliveryMethod: input.newMethod }
  })
}

export async function listDeliveryMethodChanges(documentType: 'TRANSACTION' | 'INTERNAL_TRANSFER', documentId: number) {
  return db
    .select({
      id: deliveryMethodChanges.id,
      oldMethod: deliveryMethodChanges.oldMethod,
      newMethod: deliveryMethodChanges.newMethod,
      reason: deliveryMethodChanges.reason,
      changedByName: users.name,
      createdAt: deliveryMethodChanges.createdAt,
    })
    .from(deliveryMethodChanges)
    .innerJoin(users, eq(users.id, deliveryMethodChanges.changedById))
    .where(and(eq(deliveryMethodChanges.documentType, documentType), eq(deliveryMethodChanges.documentId, documentId)))
    .orderBy(desc(deliveryMethodChanges.createdAt))
}
