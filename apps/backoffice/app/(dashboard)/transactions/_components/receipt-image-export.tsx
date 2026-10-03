'use client'

import type { ReceiptSource } from '@/lib/receipt-data'
import { renderReceiptImages } from '@/lib/receipt-image'
import DocumentImageExport from './document-image-export'

export default function ReceiptImageExport({ data }: { data: ReceiptSource }) {
  return (
    <DocumentImageExport
      data={data}
      label="Simpan Struk PNG"
      renderImages={renderReceiptImages}
    />
  )
}
