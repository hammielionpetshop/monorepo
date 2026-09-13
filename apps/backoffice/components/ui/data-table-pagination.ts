export function clampPageIndex(pageIndex: number, pageSize: number, rowCount: number): number {
  if (rowCount === 0) return 0

  const lastPageIndex = Math.max(Math.ceil(rowCount / pageSize) - 1, 0)

  if (pageIndex < 0) return 0
  if (pageIndex > lastPageIndex) return lastPageIndex

  return pageIndex
}

export function getPaginationSummary(pageIndex: number, pageSize: number, rowCount: number): string {
  if (rowCount === 0) return 'Menampilkan 0 dari 0 data'

  const start = pageIndex * pageSize + 1
  const end = Math.min(start + pageSize - 1, rowCount)

  return `Menampilkan ${start}-${end} dari ${rowCount} data`
}

const PAGE_INDEX_STORAGE_PREFIX = 'dataTablePageIndex:'

/**
 * pageIndex disimpan per `persistKey` di sessionStorage supaya balik dari halaman
 * detail (yang me-remount komponen tabel) tidak mereset ke halaman pertama.
 * Sengaja sessionStorage (bukan localStorage) agar tab/sesi baru mulai dari awal.
 */
export function readPersistedPageIndex(persistKey: string | undefined): number {
  if (!persistKey || typeof window === 'undefined') return 0

  try {
    const raw = window.sessionStorage.getItem(PAGE_INDEX_STORAGE_PREFIX + persistKey)
    const parsed = raw === null ? 0 : Number(raw)
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0
  } catch {
    return 0
  }
}

export function writePersistedPageIndex(persistKey: string | undefined, pageIndex: number): void {
  if (!persistKey || typeof window === 'undefined') return

  try {
    window.sessionStorage.setItem(PAGE_INDEX_STORAGE_PREFIX + persistKey, String(pageIndex))
  } catch {
    // sessionStorage bisa gagal (mis. mode privat) - ini cuma pelengkap, aman diabaikan
  }
}
