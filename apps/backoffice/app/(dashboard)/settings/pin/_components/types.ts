export interface StaffPinItem {
  id: number
  name: string
  username: string | null
  staffNumber: string | null
  roleName: string
  branchName: string
  isActive: boolean
  /** Punya `pin_hash` — false berarti belum pernah punya PIN sama sekali. */
  hasPin: boolean
  /** PIN sedang di-reset, staf wajib memilih PIN sendiri saat login berikutnya. */
  mustChangePin: boolean
  /** Belum tuntas onboarding login pertama — PIN akan diisi di sana. */
  mustChangeCredentials: boolean
  /** Kapan PIN terakhir dipilih pemiliknya. null → PIN sekarang bukan pilihan dia. */
  pinSetAt: Date | null
}

export type PinStatus = 'AKTIF' | 'PERLU_GANTI' | 'BELUM_ADA' | 'ONBOARDING'
