import { describe, expect, it } from 'vitest';
import { cleanEndReport, deliverProblem, endReportDue, headHomeProblem, reopenOpen, tripPhase, visitReason } from './driver-trip';

describe('Alur trip HP driver (spec LT1 §13.3)', () => {
  it('tahap: Siap Kirim dan Menuju Garasi adalah tanda di atas DRAFT/RUNNING', () => {
    expect(tripPhase('DRAFT', null, null)).toBe('DRAFT');
    expect(tripPhase('DRAFT', new Date(), null)).toBe('READY');
    expect(tripPhase('RUNNING', new Date(), null)).toBe('RUNNING');
    expect(tripPhase('RUNNING', null, new Date())).toBe('HEADING_HOME');
    expect(tripPhase('DONE', new Date(), new Date())).toBe('DONE');
    expect(tripPhase('CANCELLED', new Date(), null)).toBe('CANCELLED');
  });

  it('alasan baku: label tersimpan, Lainnya wajib keterangan, kode asing ditolak', () => {
    expect(visitReason('TOMORROW', 'CLOSED', '')).toEqual({ ok: true, code: 'CLOSED', text: 'Toko tutup' });
    expect(visitReason('TOMORROW', 'CLOSED', ' pemilik  ke pasar ')).toEqual({ ok: true, code: 'CLOSED', text: 'Toko tutup: pemilik ke pasar' });
    expect(visitReason('FAILED', 'OTHER', 'abc').ok).toBe(false);
    expect(visitReason('FAILED', 'OTHER', 'barang tidak cocok')).toEqual({ ok: true, code: 'OTHER', text: 'barang tidak cocok' });
    expect(visitReason('FAILED', 'CLOSED', '').ok).toBe(false);
    expect(visitReason('TOMORROW', 'x'.repeat(5), '').ok).toBe(false);
  });

  it('Menuju Garasi menyebut sisa pekerjaan', () => {
    expect(headHomeProblem({ visits: 0, pickups: [], shopping: [] })).toBeNull();
    expect(headHomeProblem({ visits: 2, pickups: ['Toko Pusat'], shopping: ['Supplier A'] }))
      .toBe('Masih ada 2 kunjungan, ambil barang di Toko Pusat, belanja Supplier A. Selesaikan dulu, atau tekan Selesai lebih awal bila memang harus pulang.');
  });

  it('Terkirim ditahan oleh ambil barang dan nota batal di kasir', () => {
    expect(deliverProblem({ waitsForPickup: [], cancelledNumbers: [] })).toBeNull();
    expect(deliverProblem({ waitsForPickup: ['Toko Pusat'], cancelledNumbers: ['TRX-1'] })).toMatch(/Toko Pusat belum diambil/);
    expect(deliverProblem({ waitsForPickup: [], cancelledNumbers: ['TRX-1'] })).toMatch(/TRX-1 dibatalkan di kasir/);
  });

  it('Laporan Pulang: keadaan mobil, bensin kelipatan 1.000, masalah boleh kosong', () => {
    expect(cleanEndReport({ condition: 'GOOD', needsFuel: false })).toEqual({
      ok: true, value: { condition: 'GOOD', conditionNote: null, needsFuel: false, fuelEstimate: null, problemNote: null },
    });
    expect(cleanEndReport({ condition: 'GOOD', conditionNote: 'diabaikan', needsFuel: false, fuelEstimate: 5000 }))
      .toMatchObject({ ok: true, value: { conditionNote: null, fuelEstimate: null } });
    expect(cleanEndReport({ condition: 'ATTENTION', conditionNote: 'rem', needsFuel: false }).ok).toBe(false);
    expect(cleanEndReport({ condition: 'ATTENTION', conditionNote: 'rem bunyi', needsFuel: true, fuelEstimate: 150_000 }))
      .toMatchObject({ ok: true, value: { condition: 'ATTENTION', conditionNote: 'rem bunyi', fuelEstimate: 150_000 } });
    expect(cleanEndReport({ condition: 'GOOD', needsFuel: true, fuelEstimate: 150_500 }).ok).toBe(false);
    expect(cleanEndReport({ condition: 'GOOD', needsFuel: true, fuelEstimate: null }).ok).toBe(false);
    expect(cleanEndReport({ condition: 'BAD', needsFuel: false }).ok).toBe(false);
  });

  it('Laporan Pulang ditunggu untuk trip hari ini dan kemarin saja', () => {
    expect(endReportDue('2026-11-04', '2026-11-04')).toBe(true);
    expect(endReportDue('2026-11-03', '2026-11-04')).toBe(true);
    expect(endReportDue('2026-11-02', '2026-11-04')).toBe(false);
    expect(endReportDue(null, '2026-11-04')).toBe(false);
  });

  it('buka lagi batal logistik sampai N hari', () => {
    const at = new Date('2026-11-01T10:00:00Z');
    expect(reopenOpen(at, new Date('2026-11-08T10:00:00Z'), 7)).toBe(true);
    expect(reopenOpen(at, new Date('2026-11-08T10:00:01Z'), 7)).toBe(false);
  });
});
