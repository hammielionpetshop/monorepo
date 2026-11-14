import { describe, expect, it } from 'vitest'
import { nextStep, type GatewayView, type WebEntry } from './api'

const web = (code: WebEntry['code'], needsPassword = false): WebEntry =>
  ({ code, name: code, description: '', url: `https://${code}.test`, needsPassword })
const view = (webs: WebEntry[], extra: Partial<GatewayView> = {}): GatewayView =>
  ({ name: 'Uji', mustChangePassword: false, changePasswordAt: null, changePasswordUrl: null, webs, ...extra })

describe('langkah gateway (F2-7a §2)', () => {
  it('belum masuk → form masuk', () => expect(nextStep(null, false).kind).toBe('login'))
  it('satu web → langsung dibuka', () => expect(nextStep(view([web('hris')]), false)).toMatchObject({ kind: 'auto-open', web: { code: 'hris' } }))
  it('dua web → daftar', () => expect(nextStep(view([web('pos'), web('hris')]), false).kind).toBe('list'))
  it('datang dari Pindah web → selalu daftar', () => expect(nextStep(view([web('hris')]), true).kind).toBe('list'))
  it('satu web yang butuh password → daftar dengan keterangan', () => expect(nextStep(view([web('hris', true)]), false).kind).toBe('list'))
  it('tanpa web → pesan tidak punya akses', () => expect(nextStep(view([]), false).kind).toBe('no-access'))
  it('wajib ganti password → diarahkan ke tempat ganti password', () =>
    expect(nextStep(view([web('pos')], { mustChangePassword: true, changePasswordUrl: 'https://pos.test' }), false))
      .toEqual({ kind: 'change-password', url: 'https://pos.test' }))
})
