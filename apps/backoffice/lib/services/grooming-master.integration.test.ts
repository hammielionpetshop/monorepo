import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { db, branches, roles, users, customers, groomers, pets, auditLogs, permissions, rolePermissions, eq, and, inArray } from '../db'
import {
  GroomingMasterError, createGroomer, updateGroomer, listGroomers, createPet, updatePet, listPets, searchOwners,
} from './grooming-master-service'

// Jasa grooming J2: daftar groomer dan data kucing + pemilik. Tidak ada hapus; pemilik baru
// otomatis menjadi pelanggan; nomor telepon yang sama tidak boleh terdaftar dua kali.
const run = randomUUID().slice(0, 8)
// Nomor unik per run: 08 + 10 angka dari uuid.
const nomor = (n: number) => `08${(parseInt(run, 16) % 100000000).toString().padStart(8, '0')}${n}${n}`
let actor: { userId: number; branchId: number }

beforeAll(async () => {
  const branchId = (await db.insert(branches).values({ code: `GM${run}`, name: `Toko Groomer ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `GM${run}` }).returning())[0].id
  const userId = (await db.insert(users).values({ name: `GM${run}`, roleId, branchId }).returning())[0].id
  actor = { userId, branchId }
})

describe('Groomer (DB lokal)', () => {
  it('tambah, nama kembar ditolak (tanpa peduli huruf besar-kecil), ubah nama, nonaktifkan — semuanya berjejak', async () => {
    const dedi = await createGroomer({ name: `  Dedi ${run} ` }, actor)
    expect(dedi).toMatchObject({ name: `Dedi ${run}`, isActive: true })

    await expect(createGroomer({ name: `dedi ${run}` }, actor)).rejects.toMatchObject({ code: 'DUPLICATE_NAME', status: 409 })

    const asep = await createGroomer({ name: `Asep ${run}` }, actor)
    await expect(updateGroomer(asep.id, { name: `DEDI ${run}` }, actor)).rejects.toBeInstanceOf(GroomingMasterError)

    const renamed = await updateGroomer(asep.id, { name: `Asep S ${run}` }, actor)
    expect(renamed.name).toBe(`Asep S ${run}`)

    const off = await updateGroomer(dedi.id, { isActive: false }, actor)
    expect(off.isActive).toBe(false)

    const aktif = (await listGroomers({ activeOnly: true })).map((g) => g.id)
    expect(aktif).toContain(asep.id)
    expect(aktif).not.toContain(dedi.id)
    expect((await listGroomers()).map((g) => g.id)).toContain(dedi.id) // tidak pernah dihapus

    const jejak = await db.select().from(auditLogs)
      .where(and(eq(auditLogs.tableName, 'groomers'), inArray(auditLogs.recordId, [String(dedi.id), String(asep.id)])))
    expect(jejak.map((j) => j.action).sort()).toEqual(['GROOMER_CREATE', 'GROOMER_CREATE', 'GROOMER_UPDATE', 'GROOMER_UPDATE'])

    await expect(updateGroomer(99999999, { isActive: false }, actor)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('Data kucing & pemilik (DB lokal)', () => {
  it('pemilik baru otomatis jadi pelanggan Retail; kucing tersimpan dengan perkiraan tanggal lahir', async () => {
    const mochi = await createPet({
      name: ' Mochi ', species: 'Persia', color: 'putih', ageYears: 2, ageMonths: 3,
      newOwner: { name: `Ibu Rina ${run}`, phone: nomor(1) },
    }, actor)

    expect(mochi).toMatchObject({ name: 'Mochi', species: 'Persia', color: 'putih', ownerName: `Ibu Rina ${run}`, isActive: true })
    expect(mochi.birthDate).toMatch(/^\d{4}-\d{2}-01$/)

    const [owner] = await db.select().from(customers).where(eq(customers.id, mochi.customerId))
    expect(owner).toMatchObject({ name: `Ibu Rina ${run}`, phone: nomor(1), defaultTierType: 'RETAIL', isActive: true, isInternalBranch: false })
  })

  it('nomor telepon yang sudah terdaftar ditolak (apa pun cara menulisnya) dan menunjukkan pemilik lamanya; tidak ada pelanggan kembar', async () => {
    const phone = nomor(2)
    const oyen = await createPet({ name: 'Oyen', species: 'Domestik', color: 'oranye', ageMonths: 8, newOwner: { name: `Pak Budi ${run}`, phone } }, actor)

    const lain = `+62 ${phone.slice(1, 4)}-${phone.slice(4)}`
    const err = await createPet({ name: 'Kimi', species: 'Anggora', color: 'abu', ageYears: 1, newOwner: { name: `Budi lagi ${run}`, phone: lain } }, actor)
      .catch((e) => e)
    expect(err).toBeInstanceOf(GroomingMasterError)
    expect(err).toMatchObject({ code: 'DUPLICATE_PHONE', status: 409, existingOwner: { id: oyen.customerId, name: `Pak Budi ${run}` } })

    expect(await db.select().from(customers).where(eq(customers.name, `Budi lagi ${run}`))).toHaveLength(0)
    expect(await db.select().from(pets).where(eq(pets.name, 'Kimi')).then((r) => r.filter((p) => p.customerId === oyen.customerId))).toHaveLength(0)

    // jalan keluarnya: pakai pemilik yang sudah ada
    const kimi = await createPet({ name: 'Kimi', species: 'Anggora', color: 'abu', ageYears: 1, customerId: oyen.customerId }, actor)
    expect(kimi.customerId).toBe(oyen.customerId)
  })

  it('ketik nama atau nomor yang terdaftar → pemilik muncul beserta kucingnya yang aktif', async () => {
    const phone = nomor(3)
    const luna = await createPet({ name: 'Luna', species: 'Persia', color: 'hitam', ageYears: 3, newOwner: { name: `Bu Sari ${run}`, phone } }, actor)
    const tua = await createPet({ name: 'Tua', species: 'Domestik', color: 'belang', ageYears: 9, customerId: luna.customerId }, actor)
    await updatePet(tua.id, { isActive: false }, actor)

    const lewatNama = await searchOwners(`sari ${run}`)
    expect(lewatNama).toHaveLength(1)
    expect(lewatNama[0]).toMatchObject({ id: luna.customerId, phone })
    expect(lewatNama[0].pets.map((p) => p.name)).toEqual(['Luna']) // yang nonaktif tidak ditawarkan

    const lewatNomor = await searchOwners(phone.slice(2, 12))
    expect(lewatNomor.map((o) => o.id)).toContain(luna.customerId)

    expect(await searchOwners('a')).toEqual([]) // terlalu pendek
    expect((await listPets({ q: `Sari ${run}` })).map((p) => p.name).sort()).toEqual(['Luna', 'Tua']) // daftar Back Office tetap menampilkan yang nonaktif
    expect((await listPets({ customerId: luna.customerId, activeOnly: true })).map((p) => p.name)).toEqual(['Luna'])
  })

  it('ubah data kucing berjejak; pemilik tidak valid ditolak; customer internal bukan pemilik', async () => {
    const pet = await createPet({ name: 'Bubu', species: 'Domestik', color: 'putih', ageMonths: 5, newOwner: { name: `Bu Ani ${run}`, phone: nomor(4) } }, actor)
    const updated = await updatePet(pet.id, { color: 'putih abu', ageYears: 1, ageMonths: 0 }, actor)
    expect(updated).toMatchObject({ name: 'Bubu', color: 'putih abu' })
    expect(updated.birthDate).not.toBe(pet.birthDate)

    const jejak = await db.select().from(auditLogs).where(and(eq(auditLogs.tableName, 'pets'), eq(auditLogs.recordId, String(pet.id))))
    expect(jejak.map((j) => j.action).sort()).toEqual(['PET_CREATE', 'PET_UPDATE'])

    await expect(createPet({ name: 'X', species: 'x', color: 'x', ageYears: 1, customerId: 99999999 }, actor)).rejects.toMatchObject({ code: 'OWNER_NOT_FOUND' })
    await expect(createPet({ name: 'X', species: 'x', color: 'x', ageYears: 1, newOwner: { name: 'Tanpa Nomor', phone: '123' } }, actor)).rejects.toMatchObject({ code: 'OWNER_INVALID' })
    await expect(createPet({ name: 'X', species: 'x', color: 'x', ageYears: 1 }, actor)).rejects.toMatchObject({ code: 'OWNER_INVALID' })

    const [internal] = await db.insert(customers).values({ name: `Cabang ${run}`, isInternalBranch: true }).returning()
    await expect(createPet({ name: 'X', species: 'x', color: 'x', ageYears: 1, customerId: internal.id }, actor)).rejects.toMatchObject({ code: 'OWNER_INVALID' })
    await expect(updatePet(99999999, { name: 'x' }, actor)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('Izin jasa grooming terpasang oleh migrasi (DB lokal)', () => {
  it('groomer: OWNER & GM; data kucing: OWNER, GM, MANAGER, KASIR', async () => {
    const rows = await db
      .select({ code: permissions.code, role: roles.name })
      .from(rolePermissions)
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .innerJoin(roles, eq(roles.id, rolePermissions.roleId))
      .where(inArray(permissions.code, ['grooming.groomer.manage', 'grooming.pet.manage']))
    const by = (code: string) => rows.filter((r) => r.code === code).map((r) => r.role).sort()
    expect(by('grooming.groomer.manage')).toEqual(['GM', 'OWNER'])
    expect(by('grooming.pet.manage')).toEqual(['GM', 'KASIR', 'MANAGER', 'OWNER'])
    expect(await db.select().from(groomers).limit(1)).toBeDefined()
  })
})
