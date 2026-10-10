'use client'

import { useEffect, useRef } from 'react'

export interface RequiredChoiceAction {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'destructive'
  disabled?: boolean
}

/**
 * Jendela yang WAJIB dijawab dengan salah satu tombol: klik di luar kotak dan tombol Esc
 * sengaja tidak menutupnya (permintaan owner — peringatan tidak boleh terlewat tanpa dibaca).
 */
export function RequiredChoiceDialog({
  title,
  tone = 'default',
  children,
  actions,
}: {
  title: string
  tone?: 'default' | 'warning' | 'danger' | 'success'
  children: React.ReactNode
  actions: RequiredChoiceAction[]
}) {
  const firstButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    firstButton.current?.focus()
    // Esc ditelan di sini supaya tidak ikut menutup jendela lain di belakangnya.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey, true)
    }
  }, [])

  const toneBar = {
    default: 'bg-primary',
    warning: 'bg-amber-500',
    danger: 'bg-destructive',
    success: 'bg-green-600',
  }[tone]

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="required-choice-title"
        className="bg-background rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden"
      >
        <div className={`h-1.5 ${toneBar}`} />
        <div className="p-6">
          <h3 id="required-choice-title" className="text-base font-semibold text-foreground mb-3">
            {title}
          </h3>
          <div className="text-sm text-foreground space-y-2">{children}</div>
          <div className="flex flex-wrap items-center justify-end gap-3 pt-5">
            {actions.map((a, i) => (
              <button
                key={a.label}
                ref={i === 0 ? firstButton : undefined}
                type="button"
                onClick={a.onClick}
                disabled={a.disabled}
                className={`px-4 py-2 text-sm rounded-md transition-colors disabled:opacity-50 ${
                  a.variant === 'primary'
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : a.variant === 'destructive'
                      ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                      : 'border border-border text-foreground hover:bg-muted'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
