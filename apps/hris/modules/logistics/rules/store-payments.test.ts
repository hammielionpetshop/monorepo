import { describe, expect, it } from 'vitest';
import { billOf, cleanPayment, cleanReport, leftToCollect } from './store-payments';

describe('uang di toko (spec LT1 §13.5)', () => {
  it('tagihan = jumlah sisa piutang nota', () => {
    expect(billOf([150000, 25000, 0])).toBe(175000);
    expect(billOf([])).toBe(0);
  });

  it('tagihan 0 selalu Tidak ada tagihan', () => {
    expect(cleanPayment(0, 'CASH', null)).toEqual({ ok: true, method: 'NONE', received: 0 });
    expect(cleanPayment(0, null, null)).toEqual({ ok: true, method: 'NONE', received: 0 });
  });

  it('lunas cash/transfer menerima seluruh tagihan; tempo nol', () => {
    expect(cleanPayment(2_000_000, 'CASH', 5)).toEqual({ ok: true, method: 'CASH', received: 2_000_000 });
    expect(cleanPayment(2_000_000, 'TRANSFER', null)).toEqual({ ok: true, method: 'TRANSFER', received: 2_000_000 });
    expect(cleanPayment(2_000_000, 'TEMPO', 100)).toEqual({ ok: true, method: 'TEMPO', received: 0 });
    expect(cleanPayment(2_000_000, null, null)).toMatchObject({ ok: false });
    expect(cleanPayment(2_000_000, 'NONE', null)).toMatchObject({ ok: false });
  });

  it('bayar sebagian: 1 s.d. tagihan − 1, bulat', () => {
    expect(cleanPayment(2_000_000, 'PARTIAL', 1_000_000)).toEqual({ ok: true, method: 'PARTIAL', received: 1_000_000 });
    expect(cleanPayment(2_000_000, 'PARTIAL', 2_000_000)).toMatchObject({ ok: false, error: expect.stringContaining('Lunas cash') });
    expect(cleanPayment(2_000_000, 'PARTIAL', 0)).toMatchObject({ ok: false });
    expect(cleanPayment(2_000_000, 'PARTIAL', 10.5)).toMatchObject({ ok: false });
    expect(cleanPayment(2_000_000, 'PARTIAL', null)).toMatchObject({ ok: false });
  });

  it('sisa ditagih kantor', () => {
    expect(leftToCollect('PARTIAL', 2_000_000, 1_000_000)).toBe(1_000_000);
    expect(leftToCollect('TEMPO', 300_000, 0)).toBe(300_000);
    expect(leftToCollect('CASH', 300_000, 300_000)).toBe(0);
  });

  it('laporan kunjungan: jenis baku, Kendala lain wajib catatan', () => {
    expect(cleanReport('DAMAGED', '  2 sak  sobek ')).toEqual({ ok: true, kind: 'DAMAGED', note: '2 sak sobek' });
    expect(cleanReport('RETURN', '')).toEqual({ ok: true, kind: 'RETURN', note: null });
    expect(cleanReport('OTHER', 'abc')).toMatchObject({ ok: false });
    expect(cleanReport('LAINNYA', 'apa saja')).toMatchObject({ ok: false });
  });
});
