import { db, groomers, pets, customers, auditLogs, eq, and, or, ne, ilike, inArray, asc, sql } from '../db'
import { birthDateFromAge } from '../pet-age'
import { normalizePhone, phoneSearchDigits } from '../phone'

// Data induk jasa grooming (J2): daftar groomer dan data kucing + pemiliknya.
// Lihat docs/work/specs/2026-10-11-jasa-grooming-design.md.

export class GroomingMasterError extends Error {
  constructor(
    readonly code: 'NOT_FOUND' | 'ROLE_REQUIRED' | 'DUPLICATE_NAME' | 'DUPLICATE_PHONE' | 'OWNER_NOT_FOUND' | 'OWNER_INVALID',
    message: string,
    readonly status: number,
    /** Diisi pada DUPLICATE_PHONE: pemilik yang sudah memakai nomor itu. */
    readonly existingOwner?: { id: number; name: string; phone: string | null },
  ) {
    super(message)
    this.name = 'GroomingMasterError'
  }
}

interface Actor {
  userId: number
  branchId: number
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

const phoneDigits = sql<string>`regexp_replace(coalesce(${customers.phone}, ''), '\\D', '', 'g')`
// Sama dengan normalizePhone: awalan 62 dijadikan 0.
const phoneNormalized = sql<string>`regexp_replace(${phoneDigits}, '^62', '0')`

// ── Groomer ────────────────────────────────────────────────────────────────

export interface GroomerRow {
  id: number
  name: string
  isActive: boolean
  /** Bisa dipilih sebagai yang memandikan. */
  isGroomer: boolean
  /** Bisa dipilih sebagai pengantar-jemput (delivery). */
  isCourier: boolean
}

const groomerSelect = { id: groomers.id, name: groomers.name, isActive: groomers.isActive, isGroomer: groomers.isGroomer, isCourier: groomers.isCourier }

export async function listGroomers(options: { activeOnly?: boolean; role?: 'groomer' | 'courier' } = {}): Promise<GroomerRow[]> {
  return db
    .select(groomerSelect)
    .from(groomers)
    .where(and(
      options.activeOnly ? eq(groomers.isActive, true) : undefined,
      options.role === 'groomer' ? eq(groomers.isGroomer, true) : undefined,
      options.role === 'courier' ? eq(groomers.isCourier, true) : undefined,
    ))
    .orderBy(asc(groomers.name))
}

async function assertGroomerNameFree(tx: Tx, name: string, exceptId?: number) {
  const [same] = await tx
    .select({ id: groomers.id })
    .from(groomers)
    .where(and(sql`lower(${groomers.name}) = ${name.toLowerCase()}`, exceptId ? ne(groomers.id, exceptId) : undefined))
    .limit(1)
  if (same) throw new GroomingMasterError('DUPLICATE_NAME', `Groomer bernama "${name}" sudah terdaftar`, 409)
}

function assertHasRole(isGroomer: boolean, isCourier: boolean) {
  if (!isGroomer && !isCourier) {
    throw new GroomingMasterError('ROLE_REQUIRED', 'Pilih minimal satu tugas: Groomer atau Pengantar', 400)
  }
}

export async function createGroomer(input: { name: string; isGroomer?: boolean; isCourier?: boolean }, actor: Actor): Promise<GroomerRow> {
  const name = input.name.trim()
  const isGroomer = input.isGroomer ?? true
  const isCourier = input.isCourier ?? false
  assertHasRole(isGroomer, isCourier)
  return db.transaction(async (tx) => {
    await assertGroomerNameFree(tx, name)
    const [row] = await tx
      .insert(groomers)
      .values({ name, isGroomer, isCourier, createdById: actor.userId })
      .returning(groomerSelect)
    await tx.insert(auditLogs).values({
      branchId: actor.branchId, userId: actor.userId, action: 'GROOMER_CREATE', tableName: 'groomers',
      recordId: String(row.id), oldData: null, newData: JSON.stringify(row),
    })
    return row
  })
}

/** Ubah nama dan/atau status aktif. Tidak ada hapus: riwayat grooming & bonus menunjuk ke sini. */
export async function updateGroomer(
  id: number,
  input: { name?: string; isActive?: boolean; isGroomer?: boolean; isCourier?: boolean },
  actor: Actor,
): Promise<GroomerRow> {
  return db.transaction(async (tx) => {
    const [before] = await tx
      .select(groomerSelect)
      .from(groomers).where(eq(groomers.id, id)).for('update').limit(1)
    if (!before) throw new GroomingMasterError('NOT_FOUND', 'Groomer tidak ditemukan', 404)

    const name = input.name?.trim()
    if (name !== undefined && name.toLowerCase() !== before.name.toLowerCase()) await assertGroomerNameFree(tx, name, id)

    const isGroomer = input.isGroomer ?? before.isGroomer
    const isCourier = input.isCourier ?? before.isCourier
    assertHasRole(isGroomer, isCourier)

    const [row] = await tx
      .update(groomers)
      .set({ name: name ?? before.name, isActive: input.isActive ?? before.isActive, isGroomer, isCourier, updatedAt: new Date() })
      .where(eq(groomers.id, id))
      .returning(groomerSelect)
    await tx.insert(auditLogs).values({
      branchId: actor.branchId, userId: actor.userId, action: 'GROOMER_UPDATE', tableName: 'groomers',
      recordId: String(id), oldData: JSON.stringify(before), newData: JSON.stringify(row),
    })
    return row
  })
}

// ── Pemilik & kucing ───────────────────────────────────────────────────────

export interface PetRow {
  id: number
  name: string
  species: string
  color: string
  birthDate: string | null
  isActive: boolean
  customerId: number
  ownerName: string
  ownerPhone: string | null
}

const petSelect = {
  id: pets.id,
  name: pets.name,
  species: pets.species,
  color: pets.color,
  birthDate: pets.birthDate,
  isActive: pets.isActive,
  customerId: pets.customerId,
  ownerName: customers.name,
  ownerPhone: customers.phone,
}

/** Daftar kucing; `q` mencari di nama kucing, nama pemilik, dan nomor telepon pemilik. */
export async function listPets(options: { q?: string; customerId?: number; activeOnly?: boolean; limit?: number } = {}): Promise<PetRow[]> {
  const q = options.q?.trim()
  const digits = phoneSearchDigits(q)
  return db
    .select(petSelect)
    .from(pets)
    .innerJoin(customers, eq(customers.id, pets.customerId))
    .where(and(
      options.customerId ? eq(pets.customerId, options.customerId) : undefined,
      options.activeOnly ? eq(pets.isActive, true) : undefined,
      q
        ? or(
            ilike(pets.name, `%${q}%`),
            ilike(customers.name, `%${q}%`),
            digits.length >= 3 ? sql`${phoneNormalized} LIKE ${`%${digits}%`}` : undefined,
          )
        : undefined,
    ))
    .orderBy(asc(customers.name), asc(pets.name))
    .limit(Math.min(options.limit ?? 500, 1000))
}

export interface OwnerRow {
  id: number
  name: string
  phone: string | null
  pets: Omit<PetRow, 'customerId' | 'ownerName' | 'ownerPhone'>[]
}

/**
 * Cari pemilik dari nama atau nomor telepon, beserta kucingnya yang aktif — dipakai saat
 * menerima kucing: ketik nama/nomor yang sudah terdaftar → data kucing muncul.
 * Customer internal (cabang sendiri) tidak pernah menjadi pemilik kucing.
 */
export async function searchOwners(q: string, limit = 10): Promise<OwnerRow[]> {
  const term = q.trim()
  if (term.length < 2) return []
  const digits = phoneSearchDigits(term)
  const owners = await db
    .select({ id: customers.id, name: customers.name, phone: customers.phone })
    .from(customers)
    .where(and(
      eq(customers.isActive, true),
      eq(customers.isInternalBranch, false),
      or(ilike(customers.name, `%${term}%`), digits.length >= 3 ? sql`${phoneNormalized} LIKE ${`%${digits}%`}` : undefined),
    ))
    .orderBy(asc(customers.name))
    .limit(limit)
  if (owners.length === 0) return []
  const petRows = await db
    .select({ id: pets.id, name: pets.name, species: pets.species, color: pets.color, birthDate: pets.birthDate, isActive: pets.isActive, customerId: pets.customerId })
    .from(pets)
    .where(and(inArray(pets.customerId, owners.map((o) => o.id)), eq(pets.isActive, true)))
    .orderBy(asc(pets.name))
  return owners.map((o) => ({
    ...o,
    pets: petRows
      .filter((p) => p.customerId === o.id)
      .map((p) => ({ id: p.id, name: p.name, species: p.species, color: p.color, birthDate: p.birthDate, isActive: p.isActive })),
  }))
}

/**
 * Daftarkan pemilik baru sebagai pelanggan (golongan Retail). Nomor telepon yang sudah dipakai
 * pelanggan lain ditolak supaya satu orang tidak terdaftar dua kali — pemanggil menampilkan
 * pemilik yang sudah ada dan menawarkan untuk memakainya.
 */
async function createOwnerInTx(tx: Tx, input: { name: string; phone: string }): Promise<number> {
  const name = input.name.trim()
  const phone = input.phone.trim()
  const normalized = normalizePhone(phone)
  if (!name || normalized.length < 8) {
    throw new GroomingMasterError('OWNER_INVALID', 'Nama pemilik dan nomor telepon (minimal 8 angka) wajib diisi', 400)
  }
  const [existing] = await tx
    .select({ id: customers.id, name: customers.name, phone: customers.phone })
    .from(customers)
    .where(sql`${phoneNormalized} = ${normalized}`)
    .limit(1)
  if (existing) {
    throw new GroomingMasterError(
      'DUPLICATE_PHONE',
      `Nomor ${phone} sudah terdaftar atas nama ${existing.name}. Pakai pelanggan itu, atau periksa lagi nomornya.`,
      409,
      existing,
    )
  }
  const [owner] = await tx.insert(customers).values({ name, phone }).returning({ id: customers.id })
  return owner.id
}

export interface PetInput {
  name: string
  species: string
  color: string
  ageYears?: number | null
  ageMonths?: number | null
}

export async function createPet(
  input: PetInput & { customerId?: number | null; newOwner?: { name: string; phone: string } | null },
  actor: Actor,
): Promise<PetRow> {
  return db.transaction(async (tx) => {
    let customerId = input.customerId ?? null
    let ownerCreated = false
    if (customerId) {
      const [owner] = await tx
        .select({ id: customers.id, isInternalBranch: customers.isInternalBranch })
        .from(customers).where(eq(customers.id, customerId)).limit(1)
      if (!owner) throw new GroomingMasterError('OWNER_NOT_FOUND', 'Pemilik tidak ditemukan', 404)
      if (owner.isInternalBranch) throw new GroomingMasterError('OWNER_INVALID', 'Customer internal (cabang) tidak bisa menjadi pemilik kucing', 400)
    } else if (input.newOwner) {
      customerId = await createOwnerInTx(tx, input.newOwner)
      ownerCreated = true
    } else {
      throw new GroomingMasterError('OWNER_INVALID', 'Pemilik wajib dipilih atau didaftarkan', 400)
    }

    const [pet] = await tx.insert(pets).values({
      customerId,
      name: input.name.trim(),
      species: input.species.trim(),
      color: input.color.trim(),
      birthDate: birthDateFromAge(input.ageYears, input.ageMonths),
      createdById: actor.userId,
    }).returning({ id: pets.id })
    await tx.insert(auditLogs).values({
      branchId: actor.branchId, userId: actor.userId, action: 'PET_CREATE', tableName: 'pets',
      recordId: String(pet.id), oldData: null,
      newData: JSON.stringify({ customerId, ownerCreated, name: input.name.trim(), species: input.species.trim(), color: input.color.trim() }),
    })
    const [row] = await tx.select(petSelect).from(pets).innerJoin(customers, eq(customers.id, pets.customerId)).where(eq(pets.id, pet.id))
    return row
  })
}

/** Ubah data kucing / status aktif. Pemilik tidak bisa dipindah di sini (riwayat ikut kucing). */
export async function updatePet(id: number, input: Partial<PetInput> & { isActive?: boolean }, actor: Actor): Promise<PetRow> {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(pets).where(eq(pets.id, id)).for('update').limit(1)
    if (!before) throw new GroomingMasterError('NOT_FOUND', 'Data kucing tidak ditemukan', 404)
    const ageGiven = input.ageYears !== undefined || input.ageMonths !== undefined
    const next = {
      name: input.name?.trim() ?? before.name,
      species: input.species?.trim() ?? before.species,
      color: input.color?.trim() ?? before.color,
      birthDate: ageGiven ? birthDateFromAge(input.ageYears, input.ageMonths) : before.birthDate,
      isActive: input.isActive ?? before.isActive,
    }
    await tx.update(pets).set({ ...next, updatedAt: new Date() }).where(eq(pets.id, id))
    await tx.insert(auditLogs).values({
      branchId: actor.branchId, userId: actor.userId, action: 'PET_UPDATE', tableName: 'pets', recordId: String(id),
      oldData: JSON.stringify({ name: before.name, species: before.species, color: before.color, birthDate: before.birthDate, isActive: before.isActive }),
      newData: JSON.stringify(next),
    })
    const [row] = await tx.select(petSelect).from(pets).innerJoin(customers, eq(customers.id, pets.customerId)).where(eq(pets.id, id))
    return row
  })
}
