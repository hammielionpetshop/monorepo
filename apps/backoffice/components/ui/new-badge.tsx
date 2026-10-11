'use client'

import { useEffect, useState } from 'react'
import { isNewFeature } from '@/lib/new-features'

/**
 * Tanda "Baru" untuk menu / kotak fitur yang baru rilis (lihat `lib/new-features.ts`).
 * Dihitung di browser setelah halaman tampil, supaya halaman statis tidak membekukan tanda ini
 * pada tanggal build dan tanda hilang sendiri setelah masa tampilnya lewat.
 */
export function NewBadge({ feature, className = '' }: { feature: string; className?: string }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    setShow(isNewFeature(feature))
  }, [feature])
  if (!show) return null
  return (
    <span
      className={`inline-flex items-center rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-white ${className}`}
    >
      Baru
    </span>
  )
}
