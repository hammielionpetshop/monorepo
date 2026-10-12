import { describe, expect, it } from 'vitest'
import { THERMAL_COLUMNS } from './escpos-common'
import { buildGroomingTicketsEscpos, groomingTicketLines, type GroomingTicketData } from './escpos-grooming-ticket'

const ticket = (over: Partial<GroomingTicketData> = {}): GroomingTicketData => ({
  storeName: 'HAMMIELION',
  ticketNumber: 'TRX-20261012-0481/1',
  ownerName: 'Ibu Rina',
  ownerPhone: '08123456789',
  petName: 'Mochi',
  petSpecies: 'Persia',
  petColor: 'putih',
  petAge: '2 th',
  serviceName: 'GROOMING KUTU / JAMUR',
  groomerName: 'Dedi',
  condition: 'luka kecil di telinga kiri, agak galak kalau dipegang perutnya, mohon hati-hati saat memandikan',
  receivedAt: new Date('2026-10-12T02:40:00Z'),
  isPaid: true,
  delivery: null,
  isReprint: false,
  ...over,
})

describe('karcis grooming', () => {
  it('lembar konsumen: bukti ambil dengan status bayar, tanpa kondisi & nama groomer', () => {
    const text = groomingTicketLines(ticket(), 'KONSUMEN').join('\n')
    expect(text).toContain('TRX-20261012-0481/1')
    expect(text).toContain('Mochi (Persia, putih, 2 th)')
    expect(text).toContain('Ibu Rina 08123456789')
    expect(text).toContain('LUNAS')
    expect(text).not.toContain('Dedi')
    expect(text).not.toContain('luka kecil')
  })

  it('lembar groomer: nama groomer & kondisi kucing, tanpa nomor HP pemilik', () => {
    const text = groomingTicketLines(ticket(), 'GROOMER').join('\n')
    expect(text).toContain('Groomer   : Dedi')
    expect(text).toContain('luka kecil di telinga kiri')
    expect(text).not.toContain('08123456789')
  })

  it('bayar saat ambil dan delivery tercetak jelas', () => {
    const text = groomingTicketLines(
      ticket({ isPaid: false, delivery: { courierName: 'Ujang', address: 'Jl. Cikupang no. 12, depan masjid' } }),
      'KONSUMEN',
    ).join('\n')
    expect(text).toContain('BELUM BAYAR')
    expect(text).toContain('diantar Ujang')
    expect(text).toContain('Jl. Cikupang no. 12')
  })

  it('tidak ada baris yang melebihi lebar kertas', () => {
    for (const copy of ['KONSUMEN', 'GROOMER'] as const) {
      for (const line of groomingTicketLines(ticket({ delivery: { courierName: 'Ujang', address: 'Jl. '.repeat(40) } }), copy)) {
        expect(line.length).toBeLessThanOrEqual(THERMAL_COLUMNS)
      }
    }
  })

  it('dua lembar per ekor; cetak ulang diberi tanda', () => {
    const out = buildGroomingTicketsEscpos([ticket(), ticket({ ticketNumber: 'TRX-20261012-0481/2', petName: 'Oyen' })])
    expect(out.match(/BUKTI AMBIL KUCING/g)).toHaveLength(2)
    expect(out.match(/KARCIS GROOMER/g)).toHaveLength(2)
    expect(out).not.toContain('CETAK ULANG')
    expect(buildGroomingTicketsEscpos([ticket({ isReprint: true })]).match(/CETAK ULANG/g)).toHaveLength(2)
  })
})
