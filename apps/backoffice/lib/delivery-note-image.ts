import {
  buildDeliveryNotePages,
  NOTE_WIDTH,
  PAGE_LINES,
  type DeliveryNoteData,
} from './delivery-note-layout'
import { documentImageFileName } from './document-image-filename'

export type DeliveryNoteImage = { blob: Blob; fileName: string }

export async function renderDeliveryNoteImages(
  data: DeliveryNoteData & { filenameCustomerName?: string | null }
): Promise<DeliveryNoteImage[]> {
  await document.fonts?.ready
  const pages = buildDeliveryNotePages(data)
  const customerName =
    data.filenameCustomerName === undefined
      ? data.customerName
      : data.filenameCustomerName
  const images: DeliveryNoteImage[] = []
  const padding = 48
  const lineHeight = 40
  const font = '32px "Courier New", Courier, monospace'

  for (const [pageIndex, page] of pages.entries()) {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx)
      throw new Error(
        'Gambar gagal dibuat di perangkat ini. Silakan gunakan fitur cetak.'
      )
    ctx.font = `bold ${font}`
    let contentWidth = ctx.measureText('M'.repeat(NOTE_WIDTH)).width
    for (const line of page) {
      ctx.font = `${line.bold ? 'bold ' : ''}${font}`
      contentWidth = Math.max(contentWidth, ctx.measureText(line.text).width * (line.wide ? 2 : 1))
    }
    canvas.width = Math.ceil(contentWidth + padding * 2)
    canvas.height = Math.max(PAGE_LINES, page.length) * lineHeight + padding * 2
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#000000'
    ctx.textBaseline = 'top'
    page.forEach((line, lineIndex) => {
      ctx.font = `${line.bold ? 'bold ' : ''}${font}`
      const y = padding + lineIndex * lineHeight
      if (!line.wide) return ctx.fillText(line.text, padding, y)
      ctx.save()
      ctx.translate(padding, y)
      ctx.scale(2, 1)
      ctx.fillText(line.text, 0, 0)
      ctx.restore()
    })
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png')
    )
    if (!blob)
      throw new Error(
        'Gambar gagal dibuat di perangkat ini. Silakan gunakan fitur cetak.'
      )
    images.push({
      blob,
      fileName: documentImageFileName(
        customerName,
        data.transactionNumber,
        pageIndex,
        pages.length
      ),
    })
  }
  return images
}
