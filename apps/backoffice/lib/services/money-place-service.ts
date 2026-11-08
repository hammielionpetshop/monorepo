import {
  db, moneyPlaces, paymentMethodMoneyPlaces, paymentMethods, branches, auditLogs, eq, and, ne, asc, inArray, sql,
} from '../db'

// F2-1a Tempat Uang: daftar laci/kas/rekening + tautan metode bayar non-tunai per cabang.
// Spec: docs/work/specs/2026-11-08-f2-1-tempat-uang-design.md.

export type MoneyPlaceKind = 'DRAWER' | 'CASH' | 'BANK'
export type MoneyPlaceHeldBy = 'FINANCE' | 'STORE' | 'OTHER'

/** Jenis metode bayar yang uangnya masuk rekening dan perlu ditautkan. CASH → laci, DEBT bukan uang. */
export const LINKABLE_PAYMENT_TYPES = ['BANK_TRANSFER', 'E-WALLET', 'QRIS'] as const

export class MoneyPlaceError extends Error {
  constructor(
    readonly code:
      | 'NOT_FOUND' | 'DUPLICATE_NAME' | 'DRAWER_READONLY' | 'BANK_FIELDS_REQUIRED' | 'BRANCH_NOT_FOUND'
      | 'IN_USE' | 'METHOD_NOT_LINKABLE' | 'PLACE_NOT_BANK' | 'PLACE_INACTIVE',
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'MoneyPlaceError'
  }
}

interface Actor {
  userId: number
  branchId: number
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export interface MoneyPlaceRow {
  id: number
  name: string
  kind: MoneyPlaceKind
  branchId: number
  branchName: string
  bankName: string | null
  accountNumber: string | null
  accountHolder: string | null
  heldBy: MoneyPlaceHeldBy
  holderNote: string | null
  isActive: boolean
  sortOrder: number
  /** Jumlah tautan metode bayar yang menunjuk tempat ini. */
  linkCount: number
}

const linkCountSql = sql<number>`(
  SELECT count(*)::int FROM petshop.payment_method_money_places l WHERE l.money_place_id = ${moneyPlaces.id}
)`

const rowSelect = {
  id: moneyPlaces.id,
  name: moneyPlaces.name,
  kind: sql<MoneyPlaceKind>`${moneyPlaces.kind}`,
  branchId: moneyPlaces.branchId,
  branchName: branches.name,
  bankName: moneyPlaces.bankName,
  accountNumber: moneyPlaces.accountNumber,
  accountHolder: moneyPlaces.accountHolder,
  heldBy: sql<MoneyPlaceHeldBy>`${moneyPlaces.heldBy}`,
  holderNote: moneyPlaces.holderNote,
  isActive: moneyPlaces.isActive,
  sortOrder: moneyPlaces.sortOrder,
  linkCount: linkCountSql,
}

export async function listMoneyPlaces(options: { activeOnly?: boolean } = {}): Promise<MoneyPlaceRow[]> {
  return db
    .select(rowSelect)
    .from(moneyPlaces)
    .innerJoin(branches, eq(branches.id, moneyPlaces.branchId))
    .where(options.activeOnly ? eq(moneyPlaces.isActive, true) : undefined)
    .orderBy(asc(branches.name), asc(moneyPlaces.sortOrder), asc(moneyPlaces.name))
}

async function getRow(tx: Tx, id: number): Promise<MoneyPlaceRow> {
  const [row] = await tx
    .select(rowSelect)
    .from(moneyPlaces)
    .innerJoin(branches, eq(branches.id, moneyPlaces.branchId))
    .where(eq(moneyPlaces.id, id))
    .limit(1)
  if (!row) throw new MoneyPlaceError('NOT_FOUND', 'Tempat Uang tidak ditemukan', 404)
  return row
}

export interface MoneyPlaceInput {
  name: string
  kind: 'CASH' | 'BANK'
  branchId: number
  bankName?: string | null
  accountNumber?: string | null
  accountHolder?: string | null
  heldBy: MoneyPlaceHeldBy
  holderNote?: string | null
  sortOrder?: number
}

function clean(v: string | null | undefined): string | null {
  const t = v?.trim()
  return t ? t : null
}

function normalize(input: MoneyPlaceInput) {
  const isBank = input.kind === 'BANK'
  const values = {
    name: input.name.trim(),
    kind: input.kind,
    branchId: input.branchId,
    bankName: isBank ? clean(input.bankName) : null,
    accountNumber: isBank ? clean(input.accountNumber) : null,
    accountHolder: isBank ? clean(input.accountHolder) : null,
    heldBy: input.heldBy,
    holderNote: clean(input.holderNote),
    sortOrder: input.sortOrder ?? 0,
  }
  if (isBank && (!values.bankName || !values.accountNumber)) {
    throw new MoneyPlaceError('BANK_FIELDS_REQUIRED', 'Rekening wajib diisi nama bank dan nomor rekening', 400)
  }
  return values
}

async function assertNameFree(tx: Tx, name: string, exceptId?: number) {
  const [same] = await tx
    .select({ id: moneyPlaces.id })
    .from(moneyPlaces)
    .where(and(
      sql`lower(${moneyPlaces.name}) = ${name.toLowerCase()}`,
      exceptId ? ne(moneyPlaces.id, exceptId) : undefined,
    ))
    .limit(1)
  if (same) throw new MoneyPlaceError('DUPLICATE_NAME', `Tempat Uang bernama "${name}" sudah ada`, 409)
}

async function assertBranch(tx: Tx, branchId: number) {
  const [b] = await tx.select({ id: branches.id }).from(branches).where(eq(branches.id, branchId)).limit(1)
  if (!b) throw new MoneyPlaceError('BRANCH_NOT_FOUND', 'Cabang tidak ditemukan', 400)
}

/** Daftar "metode di cabang" yang menunjuk tempat ini — untuk pesan tolak yang jelas. */
async function linkLabels(tx: Tx, placeId: number): Promise<string[]> {
  const rows = await tx
    .select({ method: paymentMethods.name, branch: branches.name })
    .from(paymentMethodMoneyPlaces)
    .innerJoin(paymentMethods, eq(paymentMethods.id, paymentMethodMoneyPlaces.paymentMethodId))
    .innerJoin(branches, eq(branches.id, paymentMethodMoneyPlaces.branchId))
    .where(eq(paymentMethodMoneyPlaces.moneyPlaceId, placeId))
    .orderBy(asc(branches.name), asc(paymentMethods.name))
  return rows.map((r) => `${r.method} di ${r.branch}`)
}

function audit(tx: Tx, actor: Actor, action: string, recordId: string, oldData: unknown, newData: unknown) {
  return tx.insert(auditLogs).values({
    branchId: actor.branchId, userId: actor.userId, action, tableName: 'money_places', recordId,
    oldData: oldData == null ? null : JSON.stringify(oldData), newData: newData == null ? null : JSON.stringify(newData),
  })
}

export async function createMoneyPlace(input: MoneyPlaceInput, actor: Actor): Promise<MoneyPlaceRow> {
  const values = normalize(input)
  return db.transaction(async (tx) => {
    await assertBranch(tx, values.branchId)
    await assertNameFree(tx, values.name)
    const [created] = await tx
      .insert(moneyPlaces)
      .values({ ...values, createdBy: actor.userId, updatedBy: actor.userId })
      .returning({ id: moneyPlaces.id })
    await audit(tx, actor, 'MONEY_PLACE_CREATE', String(created.id), null, values)
    return getRow(tx, created.id)
  })
}

export async function updateMoneyPlace(id: number, input: MoneyPlaceInput, actor: Actor): Promise<MoneyPlaceRow> {
  const values = normalize(input)
  return db.transaction(async (tx) => {
    const before = await getRow(tx, id)
    if (before.kind === 'DRAWER') {
      throw new MoneyPlaceError('DRAWER_READONLY', 'Laci kasir dibuat dan dinamai otomatis dari cabang; tidak bisa diubah', 400)
    }
    if (values.kind !== before.kind || values.branchId !== before.branchId) {
      const used = await linkLabels(tx, id)
      if (used.length > 0) {
        throw new MoneyPlaceError(
          'IN_USE',
          `Jenis/cabang tidak bisa diubah karena masih dipakai: ${used.join(', ')}. Lepas tautannya dulu.`,
          409,
        )
      }
    }
    await assertBranch(tx, values.branchId)
    await assertNameFree(tx, values.name, id)
    await tx
      .update(moneyPlaces)
      .set({ ...values, updatedBy: actor.userId, updatedAt: new Date() })
      .where(eq(moneyPlaces.id, id))
    const after = await getRow(tx, id)
    await audit(tx, actor, 'MONEY_PLACE_UPDATE', String(id), before, after)
    return after
  })
}

export async function setMoneyPlaceActive(id: number, isActive: boolean, actor: Actor): Promise<MoneyPlaceRow> {
  return db.transaction(async (tx) => {
    const before = await getRow(tx, id)
    if (before.kind === 'DRAWER') {
      throw new MoneyPlaceError('DRAWER_READONLY', 'Laci kasir mengikuti cabangnya; tidak bisa dinonaktifkan', 400)
    }
    if (before.isActive === isActive) return before
    if (!isActive) {
      const used = await linkLabels(tx, id)
      if (used.length > 0) {
        throw new MoneyPlaceError(
          'IN_USE',
          `Tidak bisa dinonaktifkan karena masih dipakai: ${used.join(', ')}. Ganti tautannya dulu.`,
          409,
        )
      }
    }
    await tx
      .update(moneyPlaces)
      .set({ isActive, updatedBy: actor.userId, updatedAt: new Date() })
      .where(eq(moneyPlaces.id, id))
    await audit(tx, actor, isActive ? 'MONEY_PLACE_ACTIVATE' : 'MONEY_PLACE_DEACTIVATE', String(id), { isActive: before.isActive }, { isActive })
    return getRow(tx, id)
  })
}

// ── Tautan metode bayar per cabang ─────────────────────────────────────────

export interface PaymentLinkMatrix {
  branches: { id: number; name: string }[]
  methods: { id: number; name: string; type: string }[]
  links: { paymentMethodId: number; branchId: number; moneyPlaceId: number }[]
}

export async function getPaymentLinkMatrix(): Promise<PaymentLinkMatrix> {
  const [branchRows, methodRows, linkRows] = await Promise.all([
    db.select({ id: branches.id, name: branches.name }).from(branches).where(eq(branches.isActive, true)).orderBy(asc(branches.name)),
    db.select({ id: paymentMethods.id, name: paymentMethods.name, type: paymentMethods.type })
      .from(paymentMethods)
      .where(inArray(paymentMethods.type, [...LINKABLE_PAYMENT_TYPES]))
      .orderBy(asc(paymentMethods.name)),
    db.select({
      paymentMethodId: paymentMethodMoneyPlaces.paymentMethodId,
      branchId: paymentMethodMoneyPlaces.branchId,
      moneyPlaceId: paymentMethodMoneyPlaces.moneyPlaceId,
    }).from(paymentMethodMoneyPlaces),
  ])
  return { branches: branchRows, methods: methodRows, links: linkRows }
}

/** Tautkan (atau lepas bila `moneyPlaceId` null) metode bayar di satu cabang ke satu rekening. */
export async function setPaymentLink(
  input: { paymentMethodId: number; branchId: number; moneyPlaceId: number | null },
  actor: Actor,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [method] = await tx
      .select({ id: paymentMethods.id, type: paymentMethods.type })
      .from(paymentMethods)
      .where(eq(paymentMethods.id, input.paymentMethodId))
      .limit(1)
    if (!method || !(LINKABLE_PAYMENT_TYPES as readonly string[]).includes(method.type)) {
      throw new MoneyPlaceError('METHOD_NOT_LINKABLE', 'Hanya metode bayar non-tunai (transfer, e-wallet, QRIS) yang ditautkan', 400)
    }
    await assertBranch(tx, input.branchId)

    const key = and(
      eq(paymentMethodMoneyPlaces.paymentMethodId, input.paymentMethodId),
      eq(paymentMethodMoneyPlaces.branchId, input.branchId),
    )
    const [before] = await tx.select({ moneyPlaceId: paymentMethodMoneyPlaces.moneyPlaceId }).from(paymentMethodMoneyPlaces).where(key).limit(1)
    const recordId = `${input.paymentMethodId}:${input.branchId}`

    if (input.moneyPlaceId == null) {
      if (!before) return
      await tx.delete(paymentMethodMoneyPlaces).where(key)
      await audit(tx, actor, 'MONEY_PLACE_LINK_REMOVE', recordId, before, null)
      return
    }

    const place = await getRow(tx, input.moneyPlaceId)
    if (place.kind !== 'BANK') throw new MoneyPlaceError('PLACE_NOT_BANK', 'Metode non-tunai hanya bisa ditautkan ke Rekening', 400)
    if (!place.isActive) throw new MoneyPlaceError('PLACE_INACTIVE', `Tempat Uang "${place.name}" sedang nonaktif`, 400)
    if (before?.moneyPlaceId === input.moneyPlaceId) return

    await tx
      .insert(paymentMethodMoneyPlaces)
      .values({ ...input, moneyPlaceId: input.moneyPlaceId, updatedBy: actor.userId })
      .onConflictDoUpdate({
        target: [paymentMethodMoneyPlaces.paymentMethodId, paymentMethodMoneyPlaces.branchId],
        set: { moneyPlaceId: input.moneyPlaceId, updatedBy: actor.userId, updatedAt: new Date() },
      })
    await audit(tx, actor, 'MONEY_PLACE_LINK_SET', recordId, before ?? null, { moneyPlaceId: input.moneyPlaceId })
  })
}
