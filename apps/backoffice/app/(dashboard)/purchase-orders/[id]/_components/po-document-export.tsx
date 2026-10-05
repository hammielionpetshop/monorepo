'use client'

import { useState } from 'react'
import { FileDown, ImageDown } from 'lucide-react'
import type { PoDocumentData } from '@/lib/po-document-layout'
import { renderPoDocumentImages, renderPoDocumentPdf } from '@/lib/po-document-image'
import DocumentImageExport from '../../../transactions/_components/document-image-export'

const BUTTON =
  'inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50'

/** Simpan PO untuk dikirim ke supplier — PDF atau foto, keduanya tanpa harga. */
export default function PoDocumentExport({ data }: { data: PoDocumentData }) {
  const [savingPdf, setSavingPdf] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function savePdf() {
    setSavingPdf(true)
    setError(null)
    try {
      const { blob, fileName } = await renderPoDocumentPdf(data)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch {
      setError('PDF gagal dibuat. Silakan coba lagi.')
    } finally {
      setSavingPdf(false)
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-2">
      <div className="flex flex-col gap-1">
        <button type="button" onClick={() => void savePdf()} disabled={savingPdf} className={BUTTON}>
          <FileDown className="h-4 w-4" />
          {savingPdf ? 'Menyiapkan PDF…' : 'Simpan PDF'}
        </button>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </div>
      <DocumentImageExport
        data={data}
        label="Simpan Foto"
        renderImages={renderPoDocumentImages}
        icon={<ImageDown className="h-4 w-4" />}
        buttonClassName={BUTTON}
      />
    </div>
  )
}
