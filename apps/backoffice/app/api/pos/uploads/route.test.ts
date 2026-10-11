import { beforeEach, describe, expect, it, vi } from 'vitest'

const cookieValue = vi.fn<() => { value: string } | undefined>()
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ get: () => cookieValue() })) }))

const verifyAccessToken = vi.fn()
vi.mock('@/lib/auth', () => ({ verifyAccessToken }))

const writeFile = vi.fn(async () => undefined)
const mkdir = vi.fn(async () => undefined)
vi.mock('fs/promises', () => ({ writeFile, mkdir, default: { writeFile, mkdir } }))

function upload(file: File | null) {
  const form = new FormData()
  if (file) form.append('file', file)
  return new Request('http://test.local/api/pos/uploads', { method: 'POST', body: form })
}

describe('POST /api/pos/uploads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cookieValue.mockReturnValue({ value: 'token' })
    verifyAccessToken.mockResolvedValue({ userId: 1 })
  })

  it('menolak tanpa login', async () => {
    cookieValue.mockReturnValue(undefined)
    const { POST } = await import('./route')
    const res = await POST(upload(new File(['x'], 'a.jpg', { type: 'image/jpeg' })))
    expect(res.status).toBe(401)
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('menolak berkas bukan gambar walau namanya .jpg', async () => {
    const { POST } = await import('./route')
    const res = await POST(upload(new File(['<script>'], 'bukti.jpg', { type: 'text/html' })))
    expect(res.status).toBe(400)
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('menolak permintaan tanpa berkas', async () => {
    const { POST } = await import('./route')
    expect((await POST(upload(null))).status).toBe(400)
  })

  it('menyimpan gambar dengan nama buatan server, bukan nama kiriman', async () => {
    const { POST } = await import('./route')
    const res = await POST(upload(new File(['data'], '../../jahat.html', { type: 'image/png' })))
    expect(res.status).toBe(200)
    const { url } = await res.json()
    expect(url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/)
    expect(writeFile).toHaveBeenCalledTimes(1)
  })
})
