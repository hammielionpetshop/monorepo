import { buildImagePdf } from './image-pdf'
import { documentImageFileName } from './document-image-filename'
import { buildPoDocumentPages, PO_DOC_LINES, PO_DOC_WIDTH, type PoDocumentData } from './po-document-layout'

// A4 pada ±150 dpi.
const PAGE_WIDTH = 1240
const PAGE_HEIGHT = 1754
const PADDING_X = 72
const PADDING_TOP = 80
const FONT_FAMILY = '"Courier New", Courier, monospace'

const failure = () => new Error('Dokumen gagal dibuat di perangkat ini. Silakan coba lagi.')

async function renderCanvases(data: PoDocumentData): Promise<HTMLCanvasElement[]> {
  await document.fonts?.ready
  const pages = buildPoDocumentPages(data)
  const lineHeight = Math.floor((PAGE_HEIGHT - PADDING_TOP * 2) / PO_DOC_LINES)

  return pages.map((page) => {
    const canvas = document.createElement('canvas')
    canvas.width = PAGE_WIDTH
    canvas.height = PAGE_HEIGHT
    const ctx = canvas.getContext('2d')
    if (!ctx) throw failure()

    // Ukuran huruf disesuaikan supaya PO_DOC_WIDTH karakter tepat memenuhi lebar isi.
    let fontSize = 22
    ctx.font = `bold ${fontSize}px ${FONT_FAMILY}`
    const measured = ctx.measureText('M'.repeat(PO_DOC_WIDTH)).width
    if (measured > 0) fontSize = Math.floor((fontSize * (PAGE_WIDTH - PADDING_X * 2)) / measured)

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)
    ctx.fillStyle = '#000000'
    ctx.textBaseline = 'top'
    page.forEach((line, i) => {
      ctx.font = `${line.bold ? 'bold ' : ''}${fontSize}px ${FONT_FAMILY}`
      ctx.fillText(line.text, PADDING_X, PADDING_TOP + i * lineHeight)
    })
    return canvas
  })
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(failure())), type, quality),
  )
}

/** PO sebagai foto PNG per halaman — untuk dikirim lewat WhatsApp. */
export async function renderPoDocumentImages(data: PoDocumentData): Promise<{ blob: Blob; fileName: string }[]> {
  const canvases = await renderCanvases(data)
  return Promise.all(
    canvases.map(async (canvas, i) => ({
      blob: await toBlob(canvas, 'image/png'),
      fileName: documentImageFileName(data.supplierName, data.poNumber, i, canvases.length),
    })),
  )
}

/** PO sebagai satu file PDF (semua halaman). */
export async function renderPoDocumentPdf(data: PoDocumentData): Promise<{ blob: Blob; fileName: string }> {
  const canvases = await renderCanvases(data)
  const pages = await Promise.all(
    canvases.map(async (canvas) => ({
      jpeg: new Uint8Array(await (await toBlob(canvas, 'image/jpeg', 0.92)).arrayBuffer()),
      widthPx: canvas.width,
      heightPx: canvas.height,
    })),
  )
  const pdf = buildImagePdf(pages)
  return {
    blob: new Blob([pdf as BlobPart], { type: 'application/pdf' }),
    fileName: documentImageFileName(data.supplierName, data.poNumber).replace(/\.png$/, '.pdf'),
  }
}
