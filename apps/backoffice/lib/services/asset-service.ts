import { alias } from 'drizzle-orm/pg-core'
import {
  db, fixedAssets, cashFlowCategories, cashFlowEntries, moneyPlaces, branches, users,
  eq, and, desc, isNull, inArray, sql,
} from '@/lib/db'
import { todayWibDate } from '@/lib/payment-date'
import { checkOccurredOn, monthStart } from './cash-flow-rules'
import {
  bookValueAt, checkDisposal, checkPurchase, depreciationSchedule, disposalResult, monthlyPortion,
  type AssetStatus, type AssetType, type DepreciationRow, type DisposalStatus,
} from './asset-rules'

/**
 * F2-6d-1 Aset & Penyusutan (spec docs/work/specs/2026-11-12-f2-6d-aset-penyusutan-design.md §1).
 * Catat pembelian = satu aset + satu catatan Arus Kas "Beli aset" (Bukan biaya) dalam satu transaksi DB.
 * Dijual = catatan Arus Kas "Jual aset" (Bukan pendapatan). Batal = isi pembatalan di aset & catatan tertaut.
 */

export class AssetError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export interface AssetActor {
  userId: number
  /** Owner/GM: boleh tanggal beli mundur > 7 hari (sampai 1 Nov 2026). */
  canBackdate: boolean
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export const BUY_CATEGORY = 'Beli aset'
export const SELL_CATEGORY = 'Jual aset'

async function systemCategory(tx: Tx, name: string, type: 'INCOME' | 'EXPENSE'): Promise<number> {
  const [c] = await tx
    .select({ id: cashFlowCategories.id })
    .from(cashFlowCategories)
    .where(and(eq(cashFlowCategories.name, name), eq(cashFlowCategories.type, type)))
    .limit(1)
  if (!c) throw new AssetError(`Kategori "${name}" belum ada; jalankan migrasi 0068`, 500)
  return c.id
}

async function checkPlace(tx: Tx, id: number, label: string) {
  const [place] = await tx
    .select({ kind: moneyPlaces.kind, isActive: moneyPlaces.isActive })
    .from(moneyPlaces)
    .where(eq(moneyPlaces.id, id))
    .limit(1)
  if (!place) throw new AssetError(`Pilih "${label}" (Tempat Uang)`, 400)
  if (place.kind === 'DRAWER') throw new AssetError('Laci kasir tidak bisa dipakai untuk aset', 400)
  if (!place.isActive) throw new AssetError('Tempat Uang sudah nonaktif', 400)
}

export interface PurchaseInput {
  name: string
  assetType: AssetType
  usefulLifeMonths: number
  branchId: number | null
  purchasedOn: string
  purchasePrice: number
  moneyPlaceId: number
  proofPhotoUrl: string | null
  note: string | null
}

export async function recordAssetPurchase(input: PurchaseInput, actor: AssetActor) {
  const today = todayWibDate()
  const error = checkPurchase({ ...input, today })
    // Finance: tanggal beli mundur paling jauh 7 hari, sama dengan Arus Kas.
    ?? (actor.canBackdate ? null : checkOccurredOn(input.purchasedOn, today, false)?.replace('Tanggal uang', 'Tanggal beli') ?? null)
  if (error) throw new AssetError(error, 400)
  const name = input.name.trim()
  return db.transaction(async (tx) => {
    await checkPlace(tx, input.moneyPlaceId, 'Dibayar dari')
    if (input.branchId !== null) {
      const [branch] = await tx.select({ id: branches.id }).from(branches).where(eq(branches.id, input.branchId)).limit(1)
      if (!branch) throw new AssetError('Cabang tidak ditemukan', 400)
    }
    const categoryId = await systemCategory(tx, BUY_CATEGORY, 'EXPENSE')
    const [entry] = await tx
      .insert(cashFlowEntries)
      .values({
        type: 'EXPENSE',
        categoryId,
        branchId: input.branchId,
        amount: input.purchasePrice,
        note: `Beli aset: ${name}${input.note ? ` — ${input.note}` : ''}`.slice(0, 255),
        occurredOn: input.purchasedOn,
        forMonth: monthStart(input.purchasedOn.slice(0, 7)),
        moneyPlaceId: input.moneyPlaceId,
        proofPhotoUrl: input.proofPhotoUrl,
        createdBy: actor.userId,
      })
      .returning({ id: cashFlowEntries.id })
    const [asset] = await tx
      .insert(fixedAssets)
      .values({
        name,
        assetType: input.assetType,
        branchId: input.branchId,
        purchasePrice: input.purchasePrice,
        purchasedOn: input.purchasedOn,
        usefulLifeMonths: input.usefulLifeMonths,
        purchaseCashFlowEntryId: entry.id,
        proofPhotoUrl: input.proofPhotoUrl,
        note: input.note,
        createdBy: actor.userId,
      })
      .returning({ id: fixedAssets.id })
    return { id: asset.id, cashFlowEntryId: entry.id }
  })
}

async function lockAsset(tx: Tx, id: number) {
  const [asset] = await tx.select().from(fixedAssets).where(eq(fixedAssets.id, id)).for('update').limit(1)
  if (!asset) throw new AssetError('Aset tidak ditemukan', 404)
  return asset
}

export interface DisposalInput {
  status: DisposalStatus
  disposedOn: string
  reason: string
  saleAmount: number | null
  /** Wajib bila dijual dengan uang > 0. */
  moneyPlaceId: number | null
}

export async function disposeAsset(id: number, input: DisposalInput, actor: AssetActor): Promise<void> {
  const reason = input.reason.trim()
  await db.transaction(async (tx) => {
    const asset = await lockAsset(tx, id)
    const error = checkDisposal({
      current: asset.status as AssetStatus,
      isCancelled: asset.cancelledAt !== null,
      next: input.status,
      disposedOn: input.disposedOn,
      purchasedOn: asset.purchasedOn,
      today: todayWibDate(),
      reason,
      saleAmount: input.saleAmount,
    })
    if (error) throw new AssetError(error, 409)

    let saleEntryId: number | null = null
    if (input.status === 'SOLD' && (input.saleAmount ?? 0) > 0) {
      if (!input.moneyPlaceId) throw new AssetError('Pilih "Masuk ke" (Tempat Uang) untuk uang hasil jual', 400)
      await checkPlace(tx, input.moneyPlaceId, 'Masuk ke')
      const [entry] = await tx
        .insert(cashFlowEntries)
        .values({
          type: 'INCOME',
          categoryId: await systemCategory(tx, SELL_CATEGORY, 'INCOME'),
          branchId: asset.branchId,
          amount: input.saleAmount!,
          note: `Jual aset: ${asset.name} — ${reason}`.slice(0, 255),
          occurredOn: input.disposedOn,
          forMonth: monthStart(input.disposedOn.slice(0, 7)),
          moneyPlaceId: input.moneyPlaceId,
          createdBy: actor.userId,
        })
        .returning({ id: cashFlowEntries.id })
      saleEntryId = entry.id
    }
    await tx
      .update(fixedAssets)
      .set({
        status: input.status,
        disposedOn: input.disposedOn,
        disposalReason: reason,
        saleAmount: input.status === 'SOLD' ? input.saleAmount : null,
        saleCashFlowEntryId: saleEntryId,
        disposedBy: actor.userId,
        disposedAt: sql`now()`,
      })
      .where(eq(fixedAssets.id, id))
  })
}

export async function cancelAsset(id: number, reason: string, actor: AssetActor): Promise<void> {
  const trimmed = reason.trim()
  if (trimmed.length < 3) throw new AssetError('Alasan pembatalan wajib diisi (minimal 3 huruf)', 400)
  await db.transaction(async (tx) => {
    const asset = await lockAsset(tx, id)
    if (asset.cancelledAt) throw new AssetError('Aset sudah dibatalkan', 409)
    await tx
      .update(fixedAssets)
      .set({ cancelledAt: sql`now()`, cancelledBy: actor.userId, cancelReason: trimmed })
      .where(eq(fixedAssets.id, id))
    const entryIds = [asset.purchaseCashFlowEntryId, asset.saleCashFlowEntryId].filter((v): v is number => v !== null)
    await tx
      .update(cashFlowEntries)
      .set({ cancelledAt: sql`now()`, cancelledBy: actor.userId, cancelReason: `Aset dibatalkan: ${trimmed}` })
      .where(and(inArray(cashFlowEntries.id, entryIds), isNull(cashFlowEntries.cancelledAt)))
  })
}

export interface AssetRow {
  id: number
  name: string
  assetType: AssetType
  branchId: number | null
  branchName: string | null
  purchasePrice: number
  purchasedOn: string
  usefulLifeMonths: number
  monthlyPortion: number
  bookValueNow: number
  status: AssetStatus
  disposedOn: string | null
  disposalReason: string | null
  saleAmount: number | null
  /** Kerugian (positif) / untung (negatif) di bulan pelepasan. */
  disposalLoss: number | null
  moneyPlaceName: string | null
  proofPhotoUrl: string | null
  note: string | null
  createdByName: string | null
  createdAt: string
  disposedByName: string | null
  cancelledAt: string | null
  cancelledByName: string | null
  cancelReason: string | null
  purchaseCashFlowEntryId: number
  saleCashFlowEntryId: number | null
  schedule: DepreciationRow[]
}

export async function listAssets(): Promise<AssetRow[]> {
  const creator = alias(users, 'creator')
  const disposer = alias(users, 'disposer')
  const canceller = alias(users, 'canceller')
  const rows = await db
    .select({
      a: fixedAssets,
      branchName: branches.name,
      moneyPlaceName: moneyPlaces.name,
      createdByName: creator.name,
      disposedByName: disposer.name,
      cancelledByName: canceller.name,
    })
    .from(fixedAssets)
    .leftJoin(branches, eq(branches.id, fixedAssets.branchId))
    .leftJoin(cashFlowEntries, eq(cashFlowEntries.id, fixedAssets.purchaseCashFlowEntryId))
    .leftJoin(moneyPlaces, eq(moneyPlaces.id, cashFlowEntries.moneyPlaceId))
    .leftJoin(creator, eq(creator.id, fixedAssets.createdBy))
    .leftJoin(disposer, eq(disposer.id, fixedAssets.disposedBy))
    .leftJoin(canceller, eq(canceller.id, fixedAssets.cancelledBy))
    .orderBy(desc(fixedAssets.purchasedOn), desc(fixedAssets.id))
  const nowMonth = todayWibDate().slice(0, 7)
  return rows.map(({ a, ...r }) => {
    const dep = {
      purchasePrice: a.purchasePrice,
      usefulLifeMonths: a.usefulLifeMonths,
      purchasedOn: a.purchasedOn,
      status: a.status as AssetStatus,
      disposedOn: a.disposedOn,
      saleAmount: a.saleAmount,
    }
    const schedule = depreciationSchedule(dep)
    return {
      id: a.id,
      name: a.name,
      assetType: a.assetType as AssetType,
      branchId: a.branchId,
      branchName: r.branchName,
      purchasePrice: a.purchasePrice,
      purchasedOn: a.purchasedOn,
      usefulLifeMonths: a.usefulLifeMonths,
      monthlyPortion: monthlyPortion(a.purchasePrice, a.usefulLifeMonths, 1),
      bookValueNow: bookValueAt(dep, nowMonth),
      status: a.status as AssetStatus,
      disposedOn: a.disposedOn,
      disposalReason: a.disposalReason,
      saleAmount: a.saleAmount,
      disposalLoss: disposalResult(dep)?.loss ?? null,
      moneyPlaceName: r.moneyPlaceName,
      proofPhotoUrl: a.proofPhotoUrl,
      note: a.note,
      createdByName: r.createdByName,
      createdAt: a.createdAt.toISOString(),
      disposedByName: r.disposedByName,
      cancelledAt: a.cancelledAt ? a.cancelledAt.toISOString() : null,
      cancelledByName: r.cancelledByName,
      cancelReason: a.cancelReason,
      purchaseCashFlowEntryId: a.purchaseCashFlowEntryId,
      saleCashFlowEntryId: a.saleCashFlowEntryId,
      schedule,
    }
  })
}
