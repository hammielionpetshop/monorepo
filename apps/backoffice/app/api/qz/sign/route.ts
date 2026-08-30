import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSign } from 'node:crypto'
import { verifyAccessTokenCached } from '@/lib/auth-cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Tanda tangan request QZ Tray. Browser mengirim string yang perlu ditandatangani,
// server menandatanganinya dengan QZ_PRIVATE_KEY (RSA, SHA-512) — private key tidak
// pernah sampai ke klien.
//
// Bila QZ_PRIVATE_KEY belum diisi: balas 501, dan qz-tray.js otomatis jatuh ke mode
// anonim (dialog izin muncul) — sama seperti sebelum fitur ini ada.
export async function POST(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessTokenCached(token) : null
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }

  const privateKey = readPem(process.env.QZ_PRIVATE_KEY)
  if (!privateKey) {
    return new NextResponse('QZ signing belum dikonfigurasi', { status: 501 })
  }

  let request: string
  try {
    const body = await req.json()
    request = typeof body?.request === 'string' ? body.request : ''
  } catch {
    return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 })
  }
  if (!request) {
    return NextResponse.json({ error: 'Field "request" wajib diisi' }, { status: 400 })
  }

  try {
    const signer = createSign('SHA512')
    signer.update(request)
    signer.end()
    const signature = signer.sign(privateKey, 'base64')
    return new NextResponse(signature, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch {
    return NextResponse.json({ error: 'Gagal menandatangani request' }, { status: 500 })
  }
}

/**
 * Normalkan PEM dari env: sebagian loader `env_file` menyimpan tanda kutip pembungkus
 * secara literal, dan newline kerap tersimpan sebagai `\n` literal.
 */
function readPem(value: string | undefined): string | null {
  if (!value) return null
  let pem = value.trim()
  if (
    (pem.startsWith('"') && pem.endsWith('"')) ||
    (pem.startsWith("'") && pem.endsWith("'"))
  ) {
    pem = pem.slice(1, -1)
  }
  if (pem.includes('\\n')) pem = pem.replace(/\\n/g, '\n')
  return pem.includes('BEGIN') ? pem : null
}
