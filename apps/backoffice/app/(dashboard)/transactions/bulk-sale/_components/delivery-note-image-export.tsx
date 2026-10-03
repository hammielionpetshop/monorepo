'use client'

import type { DeliveryNoteData } from '@/lib/delivery-note-layout'
import { renderDeliveryNoteImages } from '@/lib/delivery-note-image'
import DocumentImageExport from '../../_components/document-image-export'

export default function DeliveryNoteImageExport({
  data,
  customerName = data.customerName,
}: {
  data: DeliveryNoteData
  customerName?: string | null
}) {
  return (
    <DocumentImageExport
      data={{ ...data, filenameCustomerName: customerName }}
      label={data.withPrice ? 'Simpan Nota PNG' : 'Simpan Surat Jalan PNG'}
      renderImages={renderDeliveryNoteImages}
    />
  )
}
