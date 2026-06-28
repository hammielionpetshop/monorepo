'use client'

import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

interface BarcodeSvgProps {
  value: string
  heightMm?: number
  showValue?: boolean
}

export default function BarcodeSvg({ value, heightMm = 12, showValue = true }: BarcodeSvgProps) {
  const ref = useRef<SVGSVGElement | null>(null)

  useEffect(() => {
    if (!ref.current) return
    try {
      JsBarcode(ref.current, value, {
        format: 'EAN13',
        height: heightMm * 3.78, // mm -> px (96dpi)
        width: 1.4,
        fontSize: 11,
        margin: 0,
        displayValue: showValue,
      })
    } catch {
      // Nilai barcode tidak valid — biarkan kosong
    }
  }, [value, heightMm, showValue])

  return <svg ref={ref} className="max-w-full" />
}
