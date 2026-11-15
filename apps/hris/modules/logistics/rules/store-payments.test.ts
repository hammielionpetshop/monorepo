import { describe, expect, it } from 'vitest';
import { billOf, cleanDecision, cleanPayment, cleanPromise, cleanRecordedRef, cleanReport, leftToCollect, promiseOverdue } from './store-payments';

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

  it('janji bayar sisa: hanya Bayar sebagian / Tempo, besok s.d. 60 hari (§14.2 butir 5)', () => {
    expect(cleanPromise('CASH', '2026-11-13', '2026-11-06')).toEqual({ ok: true, date: null });
    expect(cleanPromise('PARTIAL', null, '2026-11-06')).toMatchObject({ ok: false });
    expect(cleanPromise('PARTIAL', '2026-11-06', '2026-11-06')).toMatchObject({ ok: false });
    expect(cleanPromise('TEMPO', '2027-01-05', '2026-11-06')).toEqual({ ok: true, date: '2027-01-05' });
    expect(cleanPromise('TEMPO', '2027-01-06', '2026-11-06')).toMatchObject({ ok: false });
    expect(promiseOverdue('2026-11-13', '2026-11-14', 1)).toBe(true);
    expect(promiseOverdue('2026-11-13', '2026-11-14', 0)).toBe(false);
    expect(promiseOverdue('2026-11-13', '2026-11-13', 1)).toBe(false);
  });

  it('keputusan potong nota: nominal tidak melebihi nota dikurangi potongan lain (§14.2 butir 1)', () => {
    const notes = [{ id: 7, amount: 300_000, otherCuts: 100_000 }];
    expect(cleanDecision('DAMAGED', { decision: 'CUT', noteId: 7, amount: 200_000, reason: 'DAMAGED' }, notes))
      .toEqual({ ok: true, value: { decision: 'CUT', noteId: 7, amount: 200_000, reason: 'DAMAGED', note: null } });
    expect(cleanDecision('DAMAGED', { decision: 'CUT', noteId: 7, amount: 200_001, reason: 'DAMAGED' }, notes)).toMatchObject({ ok: false });
    expect(cleanDecision('DAMAGED', { decision: 'CUT', noteId: 8, amount: 1, reason: 'DAMAGED' }, notes)).toMatchObject({ ok: false });
    expect(cleanDecision('DAMAGED', { decision: 'CUT', noteId: 7, amount: 1, reason: 'OTHER' }, notes)).toMatchObject({ ok: false });
    expect(cleanDecision('DAMAGED', { decision: 'RETURN_BO', noteId: 7 }, notes)).toMatchObject({ ok: false });
    expect(cleanDecision('RETURN', { decision: 'RETURN_BO', noteId: 7, amount: 5 }, notes)).toMatchObject({ ok: true, value: { amount: null, reason: null } });
    expect(cleanDecision('SHORT', { decision: 'NO_CUT', note: 'ok' }, notes)).toMatchObject({ ok: false });
    expect(cleanDecision('SHORT', { decision: 'NO_CUT', note: 'barang ternyata ada', noteId: 7 }, [])).toMatchObject({ ok: true, value: { noteId: null } });
    expect(cleanRecordedRef('  RT-01 ')).toEqual({ ok: true, ref: 'RT-01' });
    expect(cleanRecordedRef('ab')).toMatchObject({ ok: false });
  });
});
