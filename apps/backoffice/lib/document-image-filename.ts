function fileNamePart(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
    .replace(/[. ]+$/g, '')
}

export function documentImageFileName(
  customerName: string | null | undefined,
  transactionNumber: string,
  pageIndex = 0,
  pageCount = 1
): string {
  const customer = fileNamePart(customerName)
  const transaction = fileNamePart(transactionNumber) || 'transaksi'
  const base = (customer ? `${customer}-${transaction}` : transaction).replace(
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?=\.|$)/i,
    '$1_'
  )
  const suffix = pageCount > 1 ? `-halaman-${pageIndex + 1}` : ''
  return `${base}${suffix}.png`
}
