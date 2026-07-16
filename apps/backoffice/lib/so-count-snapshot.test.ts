import { beforeAll, describe, expect, it } from 'vitest'
import { SignJWT } from 'jose'

import { signCountSnapshot, verifyCountSnapshot, resolveSnapshotQty } from './so-count-snapshot'
import { verifyAccessToken } from './auth'

const SECRET = 'rahasia-uji-yang-panjangnya-lebih-dari-32-karakter'

beforeAll(() => {
  process.env.JWT_SECRET = SECRET
})

const base = { branchId: 2, productId: 11, uomId: 1, systemQty: 100, countedAt: '2026-07-16T03:00:00.000Z' }

describe('snapshot hitungan stock opname', () => {
  it('menandatangani lalu memverifikasi kembali isinya', async () => {
    const token = await signCountSnapshot(base)
    await expect(verifyCountSnapshot(token)).resolves.toEqual(base)
  })

  it('menolak token yang diubah', async () => {
    const token = await signCountSnapshot(base)
    const tampered = token.slice(0, -3) + 'AAA'
    await expect(verifyCountSnapshot(tampered)).resolves.toBeNull()
  })

  it('menolak token yang ditandatangani JWT_SECRET langsung', async () => {
    // Kunci snapshot adalah turunan JWT_SECRET, jadi token buatan sendiri
    // memakai JWT_SECRET tidak boleh diterima sebagai snapshot.
    const forged = await new SignJWT({ ...base, typ: 'so-count-snapshot-v1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(SECRET))

    await expect(verifyCountSnapshot(forged)).resolves.toBeNull()
  })

  it('token snapshot tidak bisa dipakai sebagai access token', async () => {
    // verifyAccessToken menerima JWT apa pun bertanda tangan JWT_SECRET dan meng-cast-nya
    // jadi JWTPayload tanpa cek bentuk; kunci terpisah yang mencegah token tertukar.
    const token = await signCountSnapshot(base)
    await expect(verifyAccessToken(token)).resolves.toBeNull()
  })

  it('resolveSnapshotQty mengembalikan systemQty saat cocok', async () => {
    const token = await signCountSnapshot(base)
    await expect(
      resolveSnapshotQty(token, { branchId: 2, productId: 11, uomId: 1 })
    ).resolves.toBe(100)
  })

  it.each([
    ['produk lain', { branchId: 2, productId: 12, uomId: 1 }],
    ['UOM lain', { branchId: 2, productId: 11, uomId: 5 }],
    ['cabang lain', { branchId: 3, productId: 11, uomId: 1 }],
  ])('resolveSnapshotQty menolak token milik %s', async (_label, expected) => {
    const token = await signCountSnapshot(base)
    await expect(resolveSnapshotQty(token, expected)).resolves.toBeNull()
  })

  it('menolak token yang sudah kedaluwarsa', async () => {
    const { createHmac } = await import('node:crypto')
    const key = createHmac('sha256', SECRET).update('so-count-snapshot-v1').digest()
    const expired = await new SignJWT({ ...base, typ: 'so-count-snapshot-v1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(key)

    await expect(verifyCountSnapshot(expired)).resolves.toBeNull()
  })
})
