import { describe, expect, it } from 'vitest';
import { ageDays, backofficeLink, cleanStoreNote, compareQueue, saleQueueStatus, transferQueueStatus } from './delivery-notes';

describe('aturan Surat Jalan LT1a', () => {
  it('status nota truk dari kasir', () => {
    expect(saleQueueStatus('COMPLETED')).toEqual({ status: 'WAITING', pendingVoid: false });
    expect(saleQueueStatus('VOIDED')).toEqual({ status: 'CANCELLED', pendingVoid: false });
    expect(saleQueueStatus('PENDING_VOID')).toEqual({ status: 'CANCELLED', pendingVoid: true });
  });

  it('status PO Internal truk dari kasir; yang belum dikirim tidak masuk', () => {
    expect(transferQueueStatus('IN_TRANSIT')).toBe('WAITING');
    expect(transferQueueStatus('PARTIALLY_RECEIVED')).toBe('RECEIVED');
    expect(transferQueueStatus('FULLY_RECEIVED')).toBe('RECEIVED');
    expect(transferQueueStatus('CANCELLED')).toBe('CANCELLED');
    expect(transferQueueStatus('APPROVED')).toBeNull();
    expect(transferQueueStatus('DRAFT')).toBeNull();
  });

  it('umur hari kalender, tidak negatif', () => {
    expect(ageDays('2026-11-04', '2026-11-04')).toBe(0);
    expect(ageDays('2026-11-01', '2026-11-04')).toBe(3);
    expect(ageDays('2026-10-31', '2026-11-01')).toBe(1);
    expect(ageDays('2026-11-05', '2026-11-04')).toBe(0);
  });

  it('urutan antrean: paling lama dulu, lalu nomor', () => {
    const rows = [
      { on: '2026-11-05', number: 'B' }, { on: '2026-11-04', number: 'Z' }, { on: '2026-11-04', number: 'A' },
    ];
    expect(rows.sort(compareQueue).map((r) => r.number)).toEqual(['A', 'Z', 'B']);
  });

  it('catatan pengiriman: dirapikan, kosong jadi null, batas 500 huruf', () => {
    expect(cleanStoreNote('  pagar hijau  ')).toEqual({ ok: true, value: 'pagar hijau' });
    expect(cleanStoreNote('   ')).toEqual({ ok: true, value: null });
    expect(cleanStoreNote(null)).toEqual({ ok: true, value: null });
    expect(cleanStoreNote('a'.repeat(500)).ok).toBe(true);
    expect(cleanStoreNote('a'.repeat(501)).ok).toBe(false);
  });

  it('tautan Back Office: nota lewat nomor, PO Internal lewat id; alamat salah = tanpa tautan', () => {
    expect(backofficeLink('https://bo.staginghml.my.id/', 'SALE', { number: 'TRX/1 2', id: 9 }))
      .toBe('https://bo.staginghml.my.id/transactions?trx=TRX%2F1%202');
    expect(backofficeLink('https://bo.staginghml.my.id', 'TRANSFER', { number: 'IBT-1', id: 9 }))
      .toBe('https://bo.staginghml.my.id/purchase-orders/internal/9');
    expect(backofficeLink('', 'SALE', { number: 'X', id: 1 })).toBeNull();
    expect(backofficeLink(undefined, 'SALE', { number: 'X', id: 1 })).toBeNull();
    expect(backofficeLink('bo.example.com', 'SALE', { number: 'X', id: 1 })).toBeNull();
    expect(backofficeLink('https://bo.example.com/path', 'SALE', { number: 'X', id: 1 })).toBeNull();
  });
});
