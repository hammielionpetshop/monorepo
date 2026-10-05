'use client'

import { useEffect, useRef, useState } from 'react'
import {
  IDLE_WARNING_MS,
  idleRemainingMs,
  readLastActivity,
  writeLastActivity,
} from '@/lib/idle-timeout'

interface Props {
  timeoutMs: number
  /** Waktu token diterbitkan (ms epoch) — lihat `idleRemainingMs`. */
  sessionStartedAt: number
  onTimeout: () => Promise<void>
}

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'wheel'] as const
const WRITE_THROTTLE_MS = 5_000
const TICK_MS = 1_000

/**
 * Keluar otomatis setelah tidak ada aktivitas selama `timeoutMs`.
 *
 * Waktu aktivitas terakhir disimpan di localStorage, bukan hanya di timer memori: timer
 * berhenti saat PC tidur atau browser ditutup, dan tanpa catatan itu orang yang membuka
 * lagi besok paginya masih masuk dengan token kemarin. Catatan yang sama juga dipakai
 * bersama antar-tab, jadi tab yang sedang dipakai menjaga tab lain tetap hidup.
 */
export default function IdleLogout({ timeoutMs, sessionStartedAt, onTimeout }: Props) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null)
  const lastActivityRef = useRef(Date.now())
  const lastWriteRef = useRef(0)
  const firingRef = useRef(false)

  useEffect(() => {
    lastActivityRef.current = readLastActivity() ?? 0

    function markActive() {
      const now = Date.now()
      lastActivityRef.current = now
      if (now - lastWriteRef.current >= WRITE_THROTTLE_MS) {
        lastWriteRef.current = now
        writeLastActivity(now)
      }
    }

    function tick() {
      if (firingRef.current) return
      const stored = readLastActivity()
      const remaining = idleRemainingMs({
        now: Date.now(),
        lastActivityAt: Math.max(stored ?? 0, lastActivityRef.current) || null,
        sessionStartedAt,
        timeoutMs,
      })
      if (remaining <= 0) {
        firingRef.current = true
        // logoutAction me-redirect lewat exception khusus Next.js — biarkan lolos, jangan ditangkap di sini.
        void onTimeout()
        return
      }
      setRemainingMs(remaining <= IDLE_WARNING_MS ? remaining : null)
    }

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, markActive, { passive: true }))
    document.addEventListener('visibilitychange', tick)
    tick()
    const interval = setInterval(tick, TICK_MS)

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, markActive))
      document.removeEventListener('visibilitychange', tick)
      clearInterval(interval)
    }
  }, [timeoutMs, sessionStartedAt, onTimeout])

  if (remainingMs === null) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-2xl">
        <h3 className="text-lg font-bold text-foreground">Tidak ada aktivitas</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Anda akan keluar otomatis dalam{' '}
          <span className="font-semibold text-foreground">{Math.ceil(remainingMs / 1000)} detik</span>.
        </p>
        <button
          type="button"
          onClick={() => {
            const now = Date.now()
            lastActivityRef.current = now
            lastWriteRef.current = now
            writeLastActivity(now)
            setRemainingMs(null)
          }}
          className="mt-5 min-h-[44px] w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Tetap masuk
        </button>
      </div>
    </div>
  )
}
