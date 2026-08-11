import type { JWTPayload } from '@petshop/shared'
import {
  canSwitchBranch,
  resolveActiveBranchId,
  resolveActiveBranchName,
} from '@/lib/active-branch'

type CookieGetter = { get: (name: string) => { value: string } | undefined }

/**
 * Cabang aktif POS. Tipis di atas `lib/active-branch.ts` — dipertahankan sebagai nama sendiri
 * karena ±45 berkas sisi POS sudah memanggilnya.
 *
 * Yang berubah dari versi sebelumnya: gerbangnya bukan lagi daftar role hardcode
 * (`OWNER`/`GM`/`MANAGER`) melainkan penugasan cabang orangnya. Versi lama menerima cookie
 * `posBranchId` berisi cabang APA PUN asal role-nya cocok, sehingga MANAGER cabang A bisa
 * menyetel cookie ke cabang B lalu bertransaksi di sana.
 */
export function getPosBranchId(payload: JWTPayload, cookieStore: CookieGetter): number {
  return resolveActiveBranchId(payload, cookieStore)
}

export function getPosBranchName(payload: JWTPayload, cookieStore: CookieGetter): string {
  return resolveActiveBranchName(payload, cookieStore)
}

/** Apakah user ini punya lebih dari satu cabang untuk dipilih. */
export function canSelectPosBranch(payload: JWTPayload): boolean {
  return canSwitchBranch(payload)
}
