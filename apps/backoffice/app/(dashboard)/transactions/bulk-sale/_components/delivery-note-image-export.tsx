'use client'

import type { DeliveryNoteData } from '@/lib/delivery-note-layout'
import { renderDeliveryNoteImages } from '@/lib/delivery-note-image'
import DocumentImageExport from '../../_components/document-image-export'

export default function DeliveryNoteImageExport({
  data,
}: {
  data: DeliveryNoteData
}) {
  return (
    <DocumentImageExport
      data={data}
      label={data.withPrice ? 'Simpan Nota PNG' : 'Simpan Surat Jalan PNG'}
      renderImages={renderDeliveryNoteImages}
    />
  )
}
