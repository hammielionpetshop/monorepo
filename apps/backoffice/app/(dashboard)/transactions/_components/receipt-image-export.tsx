'use client'

import type { ReactNode } from 'react'
import type { ReceiptSource } from '@/lib/receipt-data'
import { renderReceiptImages } from '@/lib/receipt-image'
import DocumentImageExport from './document-image-export'

export default function ReceiptImageExport({
  data,
  label = 'Simpan Struk PNG',
  icon,
  buttonClassName,
}: {
  data: ReceiptSource
  label?: string
  icon?: ReactNode
  buttonClassName?: string
}) {
  return (
    <DocumentImageExport
      data={data}
      label={label}
      renderImages={renderReceiptImages}
      icon={icon}
      buttonClassName={buttonClassName}
    />
  )
}
