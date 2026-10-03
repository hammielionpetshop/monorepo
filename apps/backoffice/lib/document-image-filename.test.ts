import { describe, expect, it } from 'vitest'
import { documentImageFileName } from './document-image-filename'

describe('nama file gambar dokumen', () => {
  it('memakai nama customer diikuti nomor transaksi', () => {
    expect(documentImageFileName('Toko Budi', 'TRX-123')).toBe(
      'Toko Budi-TRX-123.png'
    )
    expect(documentImageFileName('Éka 東京', 'TRX-123')).toBe(
      'Éka 東京-TRX-123.png'
    )
  })
  it.each([null, undefined, '', '   ', '...'])(
    'customer %j memakai nomor transaksi saja',
    (customer) => {
      expect(documentImageFileName(customer, 'TRX-123')).toBe('TRX-123.png')
    }
  )
  it('mengganti karakter yang tidak aman untuk filesystem', () => {
    expect(documentImageFileName('  Toko/Budi: Cabang*?  ', 'TRX/123')).toBe(
      'Toko-Budi- Cabang---TRX-123.png'
    )
    expect(documentImageFileName(null, 'CON')).toBe('CON_.png')
    expect(documentImageFileName('CON.txt', 'TRX-123')).toBe('CON_.txt-TRX-123.png')
  })
  it('mempertahankan nama unik untuk setiap halaman', () => {
    expect(documentImageFileName('Toko Budi', 'TRX-123', 1, 3)).toBe(
      'Toko Budi-TRX-123-halaman-2.png'
    )
  })
})
