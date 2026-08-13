'use client'

/**
 * Pemuat badge navigasi yang membedakan "gagal sesaat" dari "sesi sudah habis".
 *
 * Badge di-polling tiap 60 detik selama tab terbuka, jadi tab yang ditinggal semalam akan
 * terus memanggil endpoint ini dengan token yang sudah mati (umur access token 1 hari, dan
 * tidak ada route refresh) — atau dengan sesi yang dicabut karena orangnya login di perangkat
 * lain. Dulu 401-nya ditelan diam-diam lewat `if (!res.ok) return`, sehingga tabnya memantul
 * selamanya: sidebar basi di layar tanpa pernah mendarat di login, dan satu 401 per menit per
 * tab di log server.
 *
 * Pengalihannya memakai `window.location`, BUKAN `router.push`: yang memutus lingkaran login
 * adalah penghapusan cookie di `/api/auth/session-ended`, dan itu route handler — navigasi
 * client-side tidak menjalankannya. Alasan lengkapnya ada di route tersebut.
 */

// Beberapa poller bisa kena 401 pada detik yang sama (sidebar + tab POS). Tanpa penjaga ini
// masing-masing menyetel `window.location` dan pengalihannya saling menimpa.
let redirecting = false

export async function loadNavBadges(
  endpoint: string,
  from?: 'pos',
): Promise<Record<string, number> | null> {
  let res: Response
  try {
    res = await fetch(endpoint)
  } catch {
    // Jaringan putus — badge bersifat informatif, tidak perlu mengganggu siapa pun.
    return null
  }

  if (res.status === 401) {
    if (!redirecting) {
      redirecting = true
      window.location.href = from === 'pos'
        ? '/api/auth/session-ended?from=pos'
        : '/api/auth/session-ended'
    }
    return null
  }

  if (!res.ok) return null

  try {
    const data = (await res.json()) as Record<string, number>
    return data && typeof data === 'object' ? data : null
  } catch {
    return null
  }
}
