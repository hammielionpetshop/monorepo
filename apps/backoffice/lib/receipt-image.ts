import Big from 'big.js'
import { wrapLines } from '@/components/pos/cart-preview-image'
import { toReceiptPrintData, type ReceiptSource } from './receipt-data'
import { documentImageFileName } from './document-image-filename'

type ReceiptLine = {
  text: string
  right?: string
  bold?: boolean
  center?: boolean
  rule?: boolean
}

export async function renderReceiptImages(
  source: ReceiptSource
): Promise<{ blob: Blob; fileName: string }[]> {
  await document.fonts?.ready
  const data = toReceiptPrintData(source)
  const width = 960
  const padding = 40
  const contentWidth = width - padding * 2
  const lineHeight = 36
  const maxLines = 120
  const font =
    '28px "Arial Narrow", "Liberation Sans Narrow", Arial, sans-serif'
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx)
    throw new Error(
      'Gambar gagal dibuat di perangkat ini. Silakan gunakan fitur cetak.'
    )
  const lines: ReceiptLine[] = []
  const money = (value: number) =>
    `Rp ${new Big(value).toNumber().toLocaleString('id-ID')}`

  function addText(
    text: string,
    options: Pick<ReceiptLine, 'bold' | 'center'> = {}
  ) {
    ctx!.font = `${options.bold ? 'bold ' : ''}${font}`
    wrapLines(
      text,
      contentWidth,
      (text) => ctx!.measureText(text).width
    ).forEach((text) => lines.push({ text, ...options }))
  }

  function addPair(label: string, value: string, bold = false) {
    ctx!.font = `${bold ? 'bold ' : ''}${font}`
    if (
      ctx!.measureText(label).width + ctx!.measureText(value).width + 24 <=
      contentWidth
    ) {
      lines.push({ text: label, right: value, bold })
    } else {
      addText(label, { bold })
      wrapLines(
        value,
        contentWidth,
        (text) => ctx!.measureText(text).width
      ).forEach((text) => lines.push({ text: '', right: text, bold }))
    }
  }

  const rule = () => lines.push({ text: '', rule: true })
  addText(data.storeName, { bold: true, center: true })
  if (data.storeAddress) addText(data.storeAddress, { center: true })
  if (data.storePhone) addText(`Telp: ${data.storePhone}`, { center: true })
  rule()
  addText('STRUK PENJUALAN', { center: true })
  if (data.isVoided)
    addText('*** VOID / BATAL ***', { bold: true, center: true })
  else if (data.isReprint)
    addText('*** COPY / CETAK ULANG ***', { bold: true, center: true })
  addText(`No: ${data.receiptNumber}`)
  addText(`Tgl: ${data.transactionDate}`)
  addText(`Kasir: ${data.cashierName}`)
  if (data.customerName) addText(`Pelanggan: ${data.customerName}`)
  rule()
  for (const item of data.items) {
    addText(item.productName, { bold: true })
    addPair(
      `${item.qty.toString().replace('.', ',')} ${item.uomCode} x ${money(item.unitPrice)}`,
      money(item.subtotal)
    )
  }
  rule()
  if (data.discountAmount > 0) {
    addPair(
      'Subtotal',
      money(new Big(data.grandTotal).plus(data.discountAmount).toNumber())
    )
    addPair('Diskon', `-${money(data.discountAmount)}`)
  }
  addPair('TOTAL', money(data.grandTotal), true)
  if (data.payments?.length) {
    data.payments.forEach((payment) =>
      addPair(payment.name, money(payment.amount))
    )
  } else {
    addPair(data.paymentMethodName, money(data.amountPaid))
  }
  addPair('Kembalian', money(data.change))
  rule()
  addText('Terima kasih telah berbelanja!', { center: true })
  addText('Barang yang sudah dibeli', { center: true })
  addText('tidak dapat dikembalikan.', { center: true })

  const pageCount = Math.ceil(lines.length / maxLines)
  const images: { blob: Blob; fileName: string }[] = []
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const pageCanvas =
      pageIndex === 0 ? canvas : document.createElement('canvas')
    const pageCtx = pageIndex === 0 ? ctx : pageCanvas.getContext('2d')
    if (!pageCtx)
      throw new Error(
        'Gambar gagal dibuat di perangkat ini. Silakan gunakan fitur cetak.'
      )
    const page = lines.slice(pageIndex * maxLines, (pageIndex + 1) * maxLines)
    if (pageCount > 1)
      page.unshift({
        text: `Halaman ${pageIndex + 1}/${pageCount}`,
        center: true,
      })
    pageCanvas.width = width
    pageCanvas.height = page.length * lineHeight + padding * 2
    pageCtx.fillStyle = '#ffffff'
    pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
    pageCtx.fillStyle = '#000000'
    pageCtx.textBaseline = 'top'
    page.forEach((line, lineIndex) => {
      const y = padding + lineIndex * lineHeight
      if (line.rule) {
        pageCtx.fillRect(padding, y + lineHeight / 2, contentWidth, 1)
        return
      }
      pageCtx.font = `${line.bold ? 'bold ' : ''}${font}`
      pageCtx.textAlign = line.center ? 'center' : 'left'
      pageCtx.fillText(line.text, line.center ? width / 2 : padding, y)
      if (line.right) {
        pageCtx.textAlign = 'right'
        pageCtx.fillText(line.right, width - padding, y)
      }
    })
    const blob = await new Promise<Blob | null>((resolve) =>
      pageCanvas.toBlob(resolve, 'image/png')
    )
    if (!blob)
      throw new Error(
        'Gambar gagal dibuat di perangkat ini. Silakan gunakan fitur cetak.'
      )
    images.push({
      blob,
      fileName: documentImageFileName(
        data.customerName,
        data.receiptNumber,
        pageIndex,
        pageCount
      ),
    })
  }
  return images
}
