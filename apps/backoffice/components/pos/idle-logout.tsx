'use client'

import { useEffect, useRef } from 'react'

interface Props {
  timeoutMs: number
  onTimeout: () => Promise<void>
}

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'wheel'] as const

export default function IdleLogout({ timeoutMs, onTimeout }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firingRef = useRef(false)

  useEffect(() => {
    function reset() {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        if (firingRef.current) return
        firingRef.current = true
        // logoutAction me-redirect lewat exception khusus Next.js — biarkan lolos, jangan ditangkap di sini.
        void onTimeout()
      }, timeoutMs)
    }

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, reset, { passive: true }))
    reset()

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, reset))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [timeoutMs, onTimeout])

  return null
}
