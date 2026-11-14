import { describe, expect, it } from 'vitest'
import { listWebs, webUrlsFromEnv, type WebUrls } from './web-access'

const urls: WebUrls = { pos: 'https://bo.test', hris: 'https://hris.test', finance: 'https://finance.test' }
const codes = (input: Parameters<typeof listWebs>[0], u: WebUrls = urls) => listWebs(input, u).map((web) => web.code)

describe('hak per web (F2-7a §3)', () => {
  it('Owner dengan Back Office + HRIS melihat POS, HRIS, dan Finance', () => {
    expect(codes({ authMethod: 'PASSWORD', links: [{ appCode: 'backoffice' }, { appCode: 'hris' }], backofficeUser: { isActive: true, role: 'OWNER' } }))
      .toEqual(['pos', 'hris', 'finance'])
  })

  it('admin bukan Owner/GM tidak melihat Finance', () => {
    expect(codes({ authMethod: 'PASSWORD', links: [{ appCode: 'backoffice' }, { appCode: 'hris' }], backofficeUser: { isActive: true, role: 'MANAGER' } }))
      .toEqual(['pos', 'hris'])
  })

  it('karyawan hanya HRIS melihat HRIS saja', () => {
    expect(codes({ authMethod: 'PASSWORD', links: [{ appCode: 'hris' }], backofficeUser: null })).toEqual(['hris'])
  })

  it('user Back Office nonaktif tidak mendapat POS maupun Finance', () => {
    expect(codes({ authMethod: 'PASSWORD', links: [{ appCode: 'backoffice' }, { appCode: 'hris' }], backofficeUser: { isActive: false, role: 'OWNER' } }))
      .toEqual(['hris'])
  })

  it('sesi PIN: HRIS tetap tampil tetapi ditandai perlu password', () => {
    const webs = listWebs({ authMethod: 'PIN', links: [{ appCode: 'backoffice' }, { appCode: 'hris' }], backofficeUser: { isActive: true, role: 'GM' } }, urls)
    expect(webs.find((web) => web.code === 'hris')?.needsPassword).toBe(true)
    expect(webs.find((web) => web.code === 'pos')?.needsPassword).toBe(false)
  })

  it('web tanpa alamat (mis. Finance di produksi) tidak ditampilkan', () => {
    expect(codes({ authMethod: 'PASSWORD', links: [{ appCode: 'backoffice' }], backofficeUser: { isActive: true, role: 'OWNER' } }, { pos: urls.pos }))
      .toEqual(['pos'])
  })

  it('alamat env dibersihkan dan yang tidak sah diabaikan', () => {
    expect(webUrlsFromEnv({ BACKOFFICE_PUBLIC_URL: 'https://bo.test/', HRIS_PUBLIC_URL: 'javascript:alert(1)', FINANCE_PUBLIC_URL: 'bukan url', LOGISTICS_PUBLIC_URL: 'https://logistik.test/' }))
      .toEqual({ pos: 'https://bo.test', hris: undefined, finance: undefined, logistik: 'https://logistik.test' })
  })
})

describe('web Logistik (F2-7b §5)', () => {
  const withLogistics: WebUrls = { ...urls, logistik: 'https://logistik.test' }
  const owner = { authMethod: 'PASSWORD' as const, links: [{ appCode: 'backoffice' }, { appCode: 'hris' }], backofficeUser: { isActive: true, role: 'OWNER' } }

  it('Owner yang berhak Logistik melihat 4 web, Logistik terakhir', () => {
    expect(codes({ ...owner, logistics: true }, withLogistics)).toEqual(['pos', 'hris', 'finance', 'logistik'])
  })

  it('driver (hanya HRIS, berhak Logistik) melihat HRIS dan Logistik', () => {
    expect(codes({ authMethod: 'PASSWORD', links: [{ appCode: 'hris' }], backofficeUser: null, logistics: true }, withLogistics)).toEqual(['hris', 'logistik'])
  })

  it('tanpa hak Logistik, tanpa tautan HRIS, atau tanpa alamat Logistik: kotak tidak tampil', () => {
    expect(codes({ ...owner, logistics: false }, withLogistics)).not.toContain('logistik')
    expect(codes({ ...owner, links: [{ appCode: 'backoffice' }], logistics: true }, withLogistics)).not.toContain('logistik')
    expect(codes({ ...owner, logistics: true }, urls)).not.toContain('logistik')
  })

  it('keterangan HRIS tanpa logistik hanya bila web Logistik terpisah', () => {
    expect(listWebs({ ...owner, logistics: true }, withLogistics).find((web) => web.code === 'hris')?.description).toBe('Absen, gaji, dan kasbon')
    expect(listWebs(owner, urls).find((web) => web.code === 'hris')?.description).toBe('Absen, gaji, kasbon, dan logistik')
  })

  it('sesi PIN: Logistik ditandai perlu password seperti HRIS', () => {
    expect(listWebs({ ...owner, authMethod: 'PIN', logistics: true }, withLogistics).find((web) => web.code === 'logistik')?.needsPassword).toBe(true)
  })
})
