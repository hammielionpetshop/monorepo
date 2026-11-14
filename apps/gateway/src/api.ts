export type WebCode = 'pos' | 'hris' | 'finance'

export type WebEntry = { code: WebCode; name: string; description: string; url: string; needsPassword: boolean }

export type GatewayView = {
  name: string
  mustChangePassword: boolean
  changePasswordAt: 'pos' | 'hris' | null
  changePasswordUrl: string | null
  webs: WebEntry[]
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

async function csrfToken(): Promise<string> {
  const res = await fetch('/api/gateway/csrf', { cache: 'no-store', credentials: 'same-origin' })
  const data = await res.json().catch(() => null)
  if (!res.ok || typeof data?.token !== 'string') throw new ApiError('Layanan masuk belum tersedia. Coba lagi nanti.', res.status)
  return data.token
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const token = await csrfToken()
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(data?.error ?? 'Permintaan gagal. Coba lagi.', res.status)
  return data as T
}

/** Daftar web sesi ini, atau null bila belum masuk. */
export async function loadView(): Promise<GatewayView | null> {
  const res = await fetch('/api/gateway/apps', { cache: 'no-store', credentials: 'same-origin' })
  if (res.status === 401) return null
  const data = await res.json().catch(() => null)
  if (!res.ok || !data) throw new ApiError(data?.error ?? 'Gagal memuat daftar web.', res.status)
  return data as GatewayView
}

export const login = (identifier: string, password: string) =>
  post<{ mustChangePassword: boolean }>('/api/gateway/login', { identifier, password })

export const openWeb = (web: WebCode) => post<{ url: string }>('/api/gateway/open', { web })

export const logout = () => post<{ ok: true }>('/api/gateway/logout', {})

export type Step =
  | { kind: 'login' }
  | { kind: 'change-password'; url: string | null }
  | { kind: 'no-access' }
  | { kind: 'auto-open'; web: WebEntry }
  | { kind: 'list' }

/**
 * Langkah sesudah daftar web dimuat (spec F2-7a §2): satu web langsung dibuka; dua atau lebih tampil daftar.
 * Datang dari tombol Pindah web (`dari` terisi) selalu menampilkan daftar.
 */
export function nextStep(view: GatewayView | null, fromSwitcher: boolean): Step {
  if (!view) return { kind: 'login' }
  if (view.mustChangePassword) return { kind: 'change-password', url: view.changePasswordUrl }
  if (!view.webs.length) return { kind: 'no-access' }
  const [only] = view.webs
  if (view.webs.length === 1 && !fromSwitcher && !only.needsPassword) return { kind: 'auto-open', web: only }
  return { kind: 'list' }
}
