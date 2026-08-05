'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  decideStatus,
  nextProbeDelay,
  FAILURES_BEFORE_OFFLINE,
  type ConnectionStatus,
} from './connection-logic'

export type { ConnectionStatus }

interface ConnectionContextValue {
  status: ConnectionStatus
  /** true hanya bila server benar-benar terjangkau — pakai ini untuk mengunci tombol simpan. */
  isOnline: boolean
  /** Probe sedang berjalan (untuk spinner tombol "Coba Lagi"). */
  isChecking: boolean
  /** Kapan koneksi mulai bermasalah (epoch ms), null saat normal. */
  offlineSince: number | null
  /** Jadwal probe otomatis berikutnya (epoch ms), null saat normal. */
  nextProbeAt: number | null
  /** Baru saja pulih — dipakai banner untuk notifikasi hijau sesaat. */
  justRecovered: boolean
  /** Paksa probe sekarang (tombol "Coba Lagi"). */
  checkNow: () => void
  /** Lapor dari catch fetch: percepat verifikasi status koneksi. */
  reportFailure: () => void
}

const PROBE_URL = '/api/health/ping'
const PROBE_TIMEOUT_MS = 6000
const PING_HEADER = 'x-hammielion-ping'
const RECOVERED_NOTICE_MS = 5000

const ConnectionContext = createContext<ConnectionContextValue | null>(null)

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  // Awal selalu 'online' agar render server & klien identik (tanpa mismatch
  // hidrasi); probe pertama berjalan segera setelah mount dan mengoreksinya.
  const [status, setStatus] = useState<ConnectionStatus>('online')
  const [isChecking, setIsChecking] = useState(false)
  const [offlineSince, setOfflineSince] = useState<number | null>(null)
  const [nextProbeAt, setNextProbeAt] = useState<number | null>(null)
  const [justRecovered, setJustRecovered] = useState(false)

  const statusRef = useRef<ConnectionStatus>('online')
  const failureCountRef = useRef(0)
  const attemptRef = useRef(0)
  const recoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const checkNowRef = useRef<() => void>(() => {})

  const applyStatus = useCallback((next: ConnectionStatus) => {
    const prev = statusRef.current
    if (prev === next) return
    statusRef.current = next
    setStatus(next)

    if (next === 'online') {
      setOfflineSince(null)
      setNextProbeAt(null)
      if (recoverTimerRef.current) clearTimeout(recoverTimerRef.current)
      setJustRecovered(true)
      recoverTimerRef.current = setTimeout(() => setJustRecovered(false), RECOVERED_NOTICE_MS)
      return
    }

    setJustRecovered(false)
    // Pertahankan stempel waktu awal saat status berpindah offline ↔ server-down.
    setOfflineSince((current) => current ?? Date.now())
  }, [])

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout> | null = null
    let inFlight = false

    const schedule = (delayMs: number) => {
      if (!alive) return
      if (timer) clearTimeout(timer)
      // Hitung mundur hanya relevan saat bermasalah; saat sehat dibiarkan null
      // supaya konsumen konteks tidak ikut re-render tiap siklus probe.
      setNextProbeAt(statusRef.current === 'online' ? null : Date.now() + delayMs)
      timer = setTimeout(() => void runProbe(false), delayMs)
    }

    const nextDelay = () => {
      if (statusRef.current === 'online') {
        attemptRef.current = 0
        return nextProbeDelay('online', failureCountRef.current, 0)
      }
      const delay = nextProbeDelay(statusRef.current, failureCountRef.current, attemptRef.current)
      attemptRef.current += 1
      return delay
    }

    const applyDecision = (decision: ReturnType<typeof decideStatus>) => {
      failureCountRef.current = decision.failureCount
      applyStatus(decision.status)
    }

    const runProbe = async (manual: boolean) => {
      if (!alive || inFlight) return

      // navigator.onLine === false bersifat definitif: perangkat memang tidak
      // punya jalur jaringan sama sekali, tak perlu buang waktu 6 detik menunggu
      // fetch timeout. Kebalikannya (true) tidak bisa dipercaya, karena hanya
      // berarti "ada kabel/WiFi tersambung", bukan "internet jalan".
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        failureCountRef.current = FAILURES_BEFORE_OFFLINE
        applyStatus('offline')
        schedule(nextDelay())
        return
      }

      inFlight = true
      setIsChecking(true)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)

      try {
        const res = await fetch(`${PROBE_URL}?t=${Date.now()}`, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        })

        applyDecision(
          decideStatus(
            {
              ok: res.ok,
              fromOurServer: res.headers.get(PING_HEADER) === '1',
              failed: false,
            },
            { current: statusRef.current, failureCount: failureCountRef.current, manual }
          )
        )
      } catch {
        // Fetch gagal total / timeout → jaringan tidak sampai ke server.
        applyDecision(
          decideStatus(
            { ok: false, fromOurServer: false, failed: true },
            { current: statusRef.current, failureCount: failureCountRef.current, manual }
          )
        )
      } finally {
        clearTimeout(timeoutId)
        inFlight = false
        if (alive) {
          setIsChecking(false)
          schedule(nextDelay())
        }
      }
    }

    const handleBrowserOffline = () => {
      failureCountRef.current = FAILURES_BEFORE_OFFLINE
      applyStatus('offline')
      schedule(nextDelay())
    }
    // Event 'online' hanya berarti antarmuka jaringan hidup — tetap verifikasi.
    const handleBrowserOnline = () => {
      attemptRef.current = 0
      void runProbe(true)
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void runProbe(true)
    }

    checkNowRef.current = () => {
      attemptRef.current = 0
      void runProbe(true)
    }

    window.addEventListener('offline', handleBrowserOffline)
    window.addEventListener('online', handleBrowserOnline)
    document.addEventListener('visibilitychange', handleVisibility)

    void runProbe(false)

    return () => {
      alive = false
      if (timer) clearTimeout(timer)
      window.removeEventListener('offline', handleBrowserOffline)
      window.removeEventListener('online', handleBrowserOnline)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [applyStatus])

  useEffect(() => {
    return () => {
      if (recoverTimerRef.current) clearTimeout(recoverTimerRef.current)
    }
  }, [])

  const checkNow = useCallback(() => checkNowRef.current(), [])
  const reportFailure = useCallback(() => checkNowRef.current(), [])

  const value = useMemo<ConnectionContextValue>(
    () => ({
      status,
      isOnline: status === 'online',
      isChecking,
      offlineSince,
      nextProbeAt,
      justRecovered,
      checkNow,
      reportFailure,
    }),
    [status, isChecking, offlineSince, nextProbeAt, justRecovered, checkNow, reportFailure]
  )

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>
}

const FALLBACK: ConnectionContextValue = {
  status: 'online',
  isOnline: true,
  isChecking: false,
  offlineSince: null,
  nextProbeAt: null,
  justRecovered: false,
  checkNow: () => {},
  reportFailure: () => {},
}

/**
 * Status koneksi ke server. Di luar ConnectionProvider mengembalikan nilai
 * netral (dianggap online) supaya komponen tetap bisa dipakai/di-test terpisah.
 */
export function useConnection(): ConnectionContextValue {
  return useContext(ConnectionContext) ?? FALLBACK
}
