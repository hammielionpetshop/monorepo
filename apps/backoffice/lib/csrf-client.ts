/**
 * Header CSRF untuk mutasi sesi mode central. Mode legacy mengembalikan token null, jadi
 * hasilnya `{}` dan permintaan persis seperti sebelumnya.
 */
export async function csrfHeaders(): Promise<Record<string, string>> {
  try {
    const res = await fetch('/api/auth/csrf', { cache: 'no-store' })
    const data: { token?: string | null } = await res.json()
    return data.token ? { 'x-csrf-token': data.token } : {}
  } catch {
    return {}
  }
}
