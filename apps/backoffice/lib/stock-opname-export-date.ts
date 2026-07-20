export function validateStockOpnameExportDate(startDate: string, endDate: string): string | null {
  if (startDate !== endDate) {
    return 'Ekspor laporan stock opname hanya dapat dilakukan untuk satu tanggal'
  }

  return null
}
