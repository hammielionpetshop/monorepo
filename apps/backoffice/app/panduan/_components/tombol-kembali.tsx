'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

const KUNCI = 'panduan:dari'

const TUJUAN = {
  pos: { href: '/pos', label: 'Kembali ke POS' },
  bo: { href: '/', label: 'Kembali ke Backoffice' },
} as const

type Asal = keyof typeof TUJUAN

function bacaAsal(nilai: string | null): Asal | null {
  return nilai === 'pos' || nilai === 'bo' ? nilai : null
}

// `?dari=` cuma ada di tautan masuk; disimpan supaya tombol ini tetap benar setelah pembaca
// berpindah antar halaman panduan.
export default function TombolKembali() {
  const params = useSearchParams()
  const [asal, setAsal] = useState<Asal | null>(null)

  useEffect(() => {
    const dariUrl = bacaAsal(params.get('dari'))
    try {
      if (dariUrl) sessionStorage.setItem(KUNCI, dariUrl)
      setAsal(dariUrl ?? bacaAsal(sessionStorage.getItem(KUNCI)))
    } catch {
      setAsal(dariUrl)
    }
  }, [params])

  if (!asal) return null
  const t = TUJUAN[asal]
  return (
    <Link
      href={t.href}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      {t.label}
    </Link>
  )
}
