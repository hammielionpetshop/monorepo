'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useCallback } from 'react'

const REFRESH_INTERVAL_MS = 60_000

export function DashboardAutoRefresh() {
  const router = useRouter()
  const isRefreshing = useRef(false)

  const doRefresh = useCallback(async () => {
    if (document.hidden) return
    if (isRefreshing.current) return

    isRefreshing.current = true
    try {
      await router.refresh()
    } catch (err) {
      console.error('[Dashboard] Auto-refresh failed:', err)
    } finally {
      isRefreshing.current = false
    }
  }, [router])

  useEffect(() => {
    const timer = setInterval(() => {
      doRefresh()
    }, REFRESH_INTERVAL_MS)

    const handleManualRefresh = () => {
      // Reset backpressure flag agar manual refresh tidak di-block
      isRefreshing.current = false
    }
    window.addEventListener('dashboard-manual-refresh', handleManualRefresh)

    return () => {
      clearInterval(timer)
      window.removeEventListener('dashboard-manual-refresh', handleManualRefresh)
    }
  }, [doRefresh])

  return null
}
