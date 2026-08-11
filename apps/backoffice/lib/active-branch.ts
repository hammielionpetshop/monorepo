import type { JWTPayload } from '@petshop/shared'

/**
 * Cabang aktif — cabang yang sedang dikerjakan seseorang saat ini.
 *
 * Satu orang bisa ditugaskan di beberapa cabang (`user_branch_assignments`), tapi yang AKTIF
 * selalu satu. Token selalu jadi sumber "boleh di cabang mana" (`branchIds`); yang berbeda
 * adalah di mana "sedang di cabang mana" disimpan, dan itu sengaja tidak sama di dua sisi:
 *
 *   - **POS** menyimpannya di cookie `posBranchId`. Seluruh sisi POS (±45 berkas) sudah membaca
 *     lewat `getPosBranchId()`, jadi satu titik baca itu cukup untuk menjamin konsistensi.
 *   - **Backoffice** menyimpannya di TOKEN — `payload.branchId` memang berarti cabang aktif.
 *     Alasannya konkret: hanya 31 berkas BO yang lewat `getAuth()`, sementara 42 lainnya
 *     memanggil `verifyAccessToken` sendiri (32 di antaranya memakai `branchId`). Menaruh
 *     cabang aktif BO di cookie berarti hanya jalur `getAuth()` yang ikut berpindah dan
 *     sisanya diam-diam tetap di cabang asal — separuh layar pindah, separuh tidak, tanpa
 *     ada yang error. Menaruhnya di token membuat SEMUA pembaca ikut tanpa kecuali.
 *
 * Konsekuensi yang diterima: cabang aktif POS dan backoffice bisa berbeda untuk orang yang
 * sama. Itu memang diinginkan — kasir yang sedang membuka shift di cabang A tidak boleh ikut
 * terseret gara-gara ia menelusuri laporan cabang B di tab backoffice.
 *
 * Cookie POS tidak pernah dipercaya sendirian: setiap pembacaan diperiksa ulang terhadap
 * `branchIds` di token, sehingga cookie yang dipalsukan hanya menghasilkan cabang utama —
 * bukan akses ke cabang orang lain.
 */

type CookieGetter = { get: (name: string) => { value: string } | undefined }

export const POS_BRANCH_COOKIE = { id: 'posBranchId', name: 'posBranchName' } as const

/**
 * Cabang yang boleh dijadikan cabang aktif. `'ALL'` = bebas (OWNER/GM).
 *
 * Token lama tanpa `branchIds` jatuh ke `[branchId]` — persis perilaku sebelum penugasan
 * multi-cabang ada, jadi sesi yang belum login ulang tidak berubah perilakunya.
 */
export function allowedBranchIds(payload: JWTPayload): number[] | 'ALL' {
  if (payload.branchScope === 'ALL') return 'ALL'
  const ids = payload.branchIds?.length ? payload.branchIds : [payload.branchId]
  return ids.includes(payload.branchId) ? ids : [payload.branchId, ...ids]
}

/** Apakah user ini punya lebih dari satu cabang untuk dipilih — penentu tampil/tidaknya
 *  pemilih cabang. Menggantikan gerbang lama yang berbasis daftar role hardcode. */
export function canSwitchBranch(payload: JWTPayload): boolean {
  const allowed = allowedBranchIds(payload)
  return allowed === 'ALL' || allowed.length > 1
}

/** Apakah `branchId` boleh dijadikan cabang aktif oleh user ini. */
export function isBranchAllowed(payload: JWTPayload, branchId: number): boolean {
  const allowed = allowedBranchIds(payload)
  return allowed === 'ALL' || allowed.includes(branchId)
}

/**
 * Cabang aktif dari cookie, sudah divalidasi terhadap izin di token.
 * Jatuh ke cabang utama bila cookie kosong, tidak berbentuk angka, atau menunjuk cabang
 * yang bukan haknya.
 */
export function resolveActiveBranchId(payload: JWTPayload, cookieStore: CookieGetter): number {
  const raw = cookieStore.get(POS_BRANCH_COOKIE.id)?.value
  const parsed = raw ? parseInt(raw, 10) : NaN
  if (Number.isNaN(parsed) || parsed <= 0) return payload.branchId
  return isBranchAllowed(payload, parsed) ? parsed : payload.branchId
}

/**
 * Nama cabang aktif POS. Sengaja mengikuti hasil `resolveActiveBranchId`: kalau id-nya ditolak
 * dan jatuh ke cabang di token, namanya ikut jatuh — supaya layar tidak pernah menampilkan nama
 * cabang yang berbeda dari data yang sebenarnya ditarik.
 */
export function resolveActiveBranchName(payload: JWTPayload, cookieStore: CookieGetter): string {
  const activeId = resolveActiveBranchId(payload, cookieStore)
  if (activeId === payload.branchId) return payload.branchName
  return cookieStore.get(POS_BRANCH_COOKIE.name)?.value || payload.branchName
}
