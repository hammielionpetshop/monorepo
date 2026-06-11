'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function NavigationProgress() {
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)
  const [width, setWidth] = useState(0)
  const prevPathnameRef = useRef(pathname)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)

  function clearTimers() {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }

  function startProgress() {
    clearTimers()
    setLoading(true)
    setWidth(10)

    let current = 10
    function advance() {
      if (current < 70) {
        current += Math.random() * 8 + 3
        setWidth(Math.min(current, 70))
        timerRef.current = setTimeout(() => {
          rafRef.current = requestAnimationFrame(advance)
        }, 300)
      } else if (current < 90) {
        current += Math.random() * 3 + 1
        setWidth(Math.min(current, 90))
        timerRef.current = setTimeout(() => {
          rafRef.current = requestAnimationFrame(advance)
        }, 600)
      }
    }

    timerRef.current = setTimeout(() => {
      rafRef.current = requestAnimationFrame(advance)
    }, 150)
  }

  function completeProgress() {
    clearTimers()
    setWidth(100)
    timerRef.current = setTimeout(() => {
      setLoading(false)
      setWidth(0)
    }, 300)
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest('a')
      if (!target) return

      const href = target.getAttribute('href')
      if (!href) return

      const isInternal =
        href.startsWith('/') &&
        !href.startsWith('//') &&
        !target.hasAttribute('download') &&
        target.getAttribute('target') !== '_blank'

      if (!isInternal) return

      if (href === pathname) return

      startProgress()
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    if (pathname !== prevPathnameRef.current) {
      prevPathnameRef.current = pathname
      completeProgress()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    return () => clearTimers()
  }, [])

  if (!loading && width === 0) return null

  return (
    <div
      role="progressbar"
      aria-label="Memuat halaman"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(width)}
      className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none"
    >
      <div
        className="h-full bg-primary shadow-[0_0_8px_0px_var(--color-primary)]"
        style={{
          width: `${width}%`,
          transition: width === 0 ? 'none' : width === 100 ? 'width 200ms ease-out' : 'width 400ms ease-out',
        }}
      />
    </div>
  )
}
