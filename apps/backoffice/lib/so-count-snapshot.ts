import { SignJWT, jwtVerify } from 'jose'
import { createHmac } from 'node:crypto'

/**
 * Snapshot stok saat kasir menghitung sebuah produk.
 *
 * Toko tetap melayani penjualan selama stock opname berjalan, jadi `systemQty` harus
 * dibekukan pada saat MENGHITUNG — bukan dihitung ulang saat submit (yang bisa terjadi
 * berjam-jam kemudian, setelah stok bergerak). Angka dibaca dan distempel server, lalu
 * ditandatangani agar tidak bisa diubah klien saat dikirim balik ketika submit.
 *
 * Selisih yang tersimpan diterapkan sebagai delta saat approve, sehingga penjualan
 * SETELAH submit tetap aman dengan sendirinya.
 */

const SNAPSHOT_TYP = 'so-count-snapshot-v1'
const SNAPSHOT_TTL = '24h'

/**
 * Kunci turunan dari JWT_SECRET, bukan JWT_SECRET itu sendiri: `verifyAccessToken`
 * menerima JWT apa pun yang ditandatangani JWT_SECRET dan meng-cast-nya jadi JWTPayload
 * tanpa memeriksa bentuk, jadi token snapshot yang ditandatangani kunci yang sama bisa
 * lolos sebagai access token. Kunci berbeda membuat keduanya mustahil tertukar.
 */
function snapshotKey() {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET belum dikonfigurasi')
  }
  return createHmac('sha256', secret).update(SNAPSHOT_TYP).digest()
}

export interface CountSnapshot {
  branchId: number
  productId: number
  uomId: number
  systemQty: number
  countedAt: string
}

export async function signCountSnapshot(snapshot: CountSnapshot): Promise<string> {
  return new SignJWT({ ...snapshot, typ: SNAPSHOT_TYP })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SNAPSHOT_TTL)
    .sign(snapshotKey())
}

/**
 * Mengembalikan `null` bila token tidak valid, kedaluwarsa, bukan token snapshot,
 * atau isinya tidak berbentuk snapshot yang benar.
 */
export async function verifyCountSnapshot(token: string): Promise<CountSnapshot | null> {
  try {
    const { payload } = await jwtVerify(token, snapshotKey())
    if (payload.typ !== SNAPSHOT_TYP) return null

    const { branchId, productId, uomId, systemQty, countedAt } = payload as Record<string, unknown>
    if (
      typeof branchId !== 'number' ||
      typeof productId !== 'number' ||
      typeof uomId !== 'number' ||
      typeof systemQty !== 'number' ||
      !Number.isFinite(systemQty) ||
      typeof countedAt !== 'string'
    ) {
      return null
    }

    return { branchId, productId, uomId, systemQty, countedAt }
  } catch {
    return null
  }
}

/**
 * Ambil systemQty dari token snapshot, dengan syarat token itu memang milik cabang,
 * produk, dan UOM yang sedang disubmit. Tanpa pencocokan ini, token snapshot produk
 * murah bisa dipakai ulang untuk produk mahal.
 *
 * Mengembalikan `null` bila token tidak valid atau tidak cocok — pemanggil wajib
 * menolak item tersebut, bukan diam-diam jatuh ke stok saat ini.
 */
export async function resolveSnapshotQty(
  token: string,
  expected: { branchId: number; productId: number; uomId: number }
): Promise<number | null> {
  const snapshot = await verifyCountSnapshot(token)
  if (!snapshot) return null

  if (
    snapshot.branchId !== Number(expected.branchId) ||
    snapshot.productId !== expected.productId ||
    snapshot.uomId !== expected.uomId
  ) {
    return null
  }

  return snapshot.systemQty
}
