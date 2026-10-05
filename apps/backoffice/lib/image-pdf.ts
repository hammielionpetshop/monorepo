/**
 * PDF minimal: satu gambar JPEG memenuhi satu halaman A4. Cukup untuk dokumen yang sudah
 * dirender ke canvas (mis. PO untuk supplier) tanpa menambah library PDF ke bundel.
 * JPEG disematkan apa adanya lewat filter DCTDecode — PDF reader yang men-decode-nya.
 */

export type PdfJpegPage = { jpeg: Uint8Array; widthPx: number; heightPx: number }

const A4_WIDTH_PT = 595.28
const A4_HEIGHT_PT = 841.89

export function buildImagePdf(pages: PdfJpegPage[]): Uint8Array {
  if (pages.length === 0) throw new Error('PDF butuh minimal satu halaman')

  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0

  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === 'string' ? encoder.encode(part) : part
    chunks.push(bytes)
    length += bytes.length
  }
  const object = (id: number, body: () => void) => {
    offsets[id] = length
    push(`${id} 0 obj\n`)
    body()
    push('\nendobj\n')
  }

  // Objek: 1 katalog, 2 daftar halaman, lalu per halaman 3 objek (halaman, gambar, konten).
  const pageId = (i: number) => 3 + i * 3
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')
  object(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'))
  object(2, () =>
    push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${pageId(i)} 0 R`).join(' ')}] /Count ${pages.length} >>`),
  )

  pages.forEach((page, i) => {
    const id = pageId(i)
    const content = `q ${A4_WIDTH_PT} 0 0 ${A4_HEIGHT_PT} 0 0 cm /Im0 Do Q`
    object(id, () =>
      push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_WIDTH_PT} ${A4_HEIGHT_PT}] ` +
          `/Resources << /XObject << /Im0 ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`,
      ),
    )
    object(id + 1, () => {
      push(
        `<< /Type /XObject /Subtype /Image /Width ${page.widthPx} /Height ${page.heightPx} ` +
          `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`,
      )
      push(page.jpeg)
      push('\nendstream')
    })
    object(id + 2, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`))
  })

  const objectCount = 2 + pages.length * 3
  const xrefOffset = length
  push(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`)
  for (let id = 1; id <= objectCount; id++) push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`)
  push(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`)

  const out = new Uint8Array(length)
  let pos = 0
  for (const c of chunks) {
    out.set(c, pos)
    pos += c.length
  }
  return out
}
