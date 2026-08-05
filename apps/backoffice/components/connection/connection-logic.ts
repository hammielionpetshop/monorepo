export type ConnectionStatus = 'online' | 'offline' | 'server-down'

export interface ProbeOutcome {
  /** Respons diterima dengan status 2xx. */
  ok: boolean
  /** Respons benar-benar berasal dari server kita (header penanda cocok). */
  fromOurServer: boolean
  /** Fetch gagal total / timeout — tidak ada respons sama sekali. */
  failed: boolean
}

export interface ProbeContext {
  current: ConnectionStatus
  /** Jumlah kegagalan beruntun SEBELUM probe ini. */
  failureCount: number
  /** Probe dipicu manual (tombol "Coba Lagi", tab kembali aktif, event online). */
  manual: boolean
}

export interface ProbeDecision {
  status: ConnectionStatus
  failureCount: number
}

/** Satu kegagalan bisa cuma paket hilang; dua kali baru dianggap putus. */
export const FAILURES_BEFORE_OFFLINE = 2

export const HEALTHY_INTERVAL_MS = 25000
export const SUSPECT_INTERVAL_MS = 2000
export const RETRY_BACKOFF_MS = [3000, 5000, 10000, 15000, 30000]

/**
 * Menerjemahkan hasil satu probe menjadi status koneksi berikutnya.
 *
 * Dua hal yang tidak boleh tertukar:
 * - Respons 2xx tapi tanpa header penanda = captive portal (WiFi hotel/kafe yang
 *   membajak request dan membalas halaman login). Praktis sama saja offline.
 * - Respons error TAPI berheader penanda = server kita hidup namun bermasalah;
 *   internet kasir baik-baik saja, jadi pesannya harus berbeda.
 */
export function decideStatus(outcome: ProbeOutcome, ctx: ProbeContext): ProbeDecision {
  if (!outcome.failed && outcome.ok && outcome.fromOurServer) {
    return { status: 'online', failureCount: 0 }
  }

  const failureCount = ctx.failureCount + 1
  const candidate: ConnectionStatus =
    !outcome.failed && outcome.fromOurServer ? 'server-down' : 'offline'

  // Saat masih 'online', tahan satu kegagalan pertama agar banner tidak
  // berkedip karena satu paket hilang. Probe manual & kondisi yang sudah
  // terlanjur bermasalah langsung dipercaya.
  const confirmed =
    ctx.manual || failureCount >= FAILURES_BEFORE_OFFLINE || ctx.current !== 'online'

  return { status: confirmed ? candidate : ctx.current, failureCount }
}

/**
 * Jeda sebelum probe berikutnya. Saat sehat jarang (hemat), saat sudah
 * dicurigai putus jadi cepat, saat terkonfirmasi putus memakai backoff.
 */
export function nextProbeDelay(
  status: ConnectionStatus,
  failureCount: number,
  attempt: number
): number {
  if (status === 'online') {
    return failureCount > 0 ? SUSPECT_INTERVAL_MS : HEALTHY_INTERVAL_MS
  }
  return RETRY_BACKOFF_MS[Math.min(Math.max(attempt, 0), RETRY_BACKOFF_MS.length - 1)]
}
