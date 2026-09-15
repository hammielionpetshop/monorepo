'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor } from 'lucide-react'

const OPTIONS = [
  { value: 'light', label: 'Terang', icon: Sun },
  { value: 'system', label: 'Ikuti Sistem', icon: Monitor },
  { value: 'dark', label: 'Gelap', icon: Moon },
] as const

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  // next-themes butuh render pertama identik server/client (theme belum diketahui saat SSR) —
  // baru tampilkan pilihan aktif yang benar setelah mount, supaya tidak ada flash/mismatch.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <div
      className="flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5"
      role="radiogroup"
      aria-label="Tema tampilan"
    >
      {OPTIONS.map((opt) => {
        const active = mounted && theme === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.label}
            title={opt.label}
            onClick={() => setTheme(opt.value)}
            className={[
              'flex-1 flex items-center justify-center rounded py-1.5 transition-colors',
              active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            ].join(' ')}
          >
            <opt.icon size={14} />
          </button>
        )
      })}
    </div>
  )
}
