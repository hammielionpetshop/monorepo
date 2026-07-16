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
