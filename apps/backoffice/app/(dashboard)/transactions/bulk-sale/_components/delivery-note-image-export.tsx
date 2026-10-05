'use client'

import type { ReactNode } from 'react'
import type { DeliveryNoteData } from '@/lib/delivery-note-layout'
import { renderDeliveryNoteImages } from '@/lib/delivery-note-image'
import DocumentImageExport from '../../_components/document-image-export'

export default function DeliveryNoteImageExport({
  data,
  customerName = data.customerName,
  label,
  icon,
  buttonClassName,
}: {
  data: DeliveryNoteData
  customerName?: string | null
  label?: string
  icon?: ReactNode
  buttonClassName?: string
}) {
  return (
    <DocumentImageExport
      data={{ ...data, filenameCustomerName: customerName }}
      label={label ?? (data.withPrice ? 'Simpan Nota PNG' : 'Simpan Surat Jalan PNG')}
      renderImages={renderDeliveryNoteImages}
      icon={icon}
      buttonClassName={buttonClassName}
    />
  )
}
