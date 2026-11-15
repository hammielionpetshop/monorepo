import { describe, expect, it } from 'vitest';
import { addMonthsClamped, nextPayrollPeriodStart, todayWib, trainingDueOn } from './dates';
import { cleanPersonFields, maskAccountNumber, normalizePhone } from './fields';
import {
  activeOn, canCancelPlacement, checkEmploymentEvent, checkPlacementChange, deactivationEffectiveOn, placementOn,
  type PlacementRecord,
} from './history';
import { promotionDueOn } from './promotion';

const PUSAT = 1;
const CIKARANG = 2;
const KASIR = 10;
const KEPALA_TOKO = 11;

function record(id: number, effectiveFrom: string, values: Partial<PlacementRecord> = {}): PlacementRecord {
  return {
    id, kind: id === 1 ? 'INITIAL' : 'BRANCH', branchId: PUSAT, positionId: KASIR, workStatus: 'EMPLOYEE',
    effectiveFrom, cancelledAt: null, ...values,
  };
}

describe('tanggal (W1, W2, PRI-01)', () => {
  it('hari ini memakai WIB, bukan UTC', () => {
    expect(todayWib(new Date('2026-10-31T16:59:00Z'))).toBe('2026-10-31');
    expect(todayWib(new Date('2026-10-31T17:00:00Z'))).toBe('2026-11-01');
  });

  it('W1: training dinilai genap 3 bulan; bulan tanpa tanggal itu memakai tanggal terakhirnya', () => {
    expect(trainingDueOn('2026-01-10')).toBe('2026-04-10');
    expect(trainingDueOn('2026-01-31')).toBe('2026-04-30');
    expect(addMonthsClamped('2026-11-30', 3)).toBe('2027-02-28');
  });

  it('W2: promosi berlaku awal periode gaji berikutnya (tanggal 26)', () => {
    expect(nextPayrollPeriodStart('2026-11-10')).toBe('2026-11-26');
    expect(nextPayrollPeriodStart('2026-04-15')).toBe('2026-04-26');
    expect(nextPayrollPeriodStart('2026-11-26')).toBe('2026-12-26');
    expect(nextPayrollPeriodStart('2026-12-30')).toBe('2027-01-26');
  });
});

describe('penempatan pada tanggal (KAR-56)', () => {
  const records = [record(1, '2026-01-10'), record(2, '2026-11-01', { branchId: CIKARANG })];

  it('W3: pindah bertanggal depan baru berlaku di tanggalnya', () => {
    expect(placementOn(records, '2026-10-31')?.branchId).toBe(PUSAT);
    expect(placementOn(records, '2026-11-01')?.branchId).toBe(CIKARANG);
  });

  it('W4: koreksi mundur dengan catatan baru; catatan sesudahnya sudah memuat nilai yang sama', () => {
    const check = checkPlacementChange({ records, kind: 'BRANCH', effectiveFrom: '2026-10-25', value: CIKARANG });
    expect(check.ok).toBe(true);
    const corrected = [...records, record(3, '2026-10-25', { branchId: CIKARANG })];
    expect(placementOn(corrected, '2026-10-25')?.branchId).toBe(CIKARANG);
    expect(placementOn(corrected, '2026-10-24')?.branchId).toBe(PUSAT);
  });

  it('kejadian 5: salah cabang dibetulkan dengan catatan bertanggal sama; catatan terbaru menang', () => {
    const fixed = [record(1, '2026-01-10'), record(2, '2026-01-10', { branchId: CIKARANG })];
    expect(placementOn(fixed, '2026-01-10')?.branchId).toBe(CIKARANG);
  });

  it('catatan dibatalkan diabaikan', () => {
    const cancelled = [record(1, '2026-01-10'), record(2, '2026-11-01', { branchId: CIKARANG, cancelledAt: '2026-10-20T00:00:00Z' })];
    expect(placementOn(cancelled, '2026-12-01')?.branchId).toBe(PUSAT);
  });

  it('perubahan mundur ditolak bila catatan sesudahnya memakai nilai lain (nilai lama akan kembali)', () => {
    const check = checkPlacementChange({ records, kind: 'POSITION', effectiveFrom: '2026-10-01', value: KEPALA_TOKO });
    expect(check).toMatchObject({ ok: false });
  });

  it('catatan baru membawa penempatan lengkap = penempatan pada tanggal itu + satu kolom', () => {
    const check = checkPlacementChange({ records, kind: 'POSITION', effectiveFrom: '2026-12-01', value: KEPALA_TOKO });
    expect(check).toMatchObject({ ok: true, values: { branchId: CIKARANG, positionId: KEPALA_TOKO, workStatus: 'EMPLOYEE' } });
  });

  it('sebelum tanggal bergabung dan nilai yang sama ditolak', () => {
    expect(checkPlacementChange({ records, kind: 'BRANCH', effectiveFrom: '2025-12-31', value: CIKARANG }).ok).toBe(false);
    expect(checkPlacementChange({ records, kind: 'BRANCH', effectiveFrom: '2026-02-01', value: PUSAT }).ok).toBe(false);
  });

  it('kejadian 9: Training → Karyawan hanya lewat Promosi Training (KAR-22)', () => {
    const training = [record(1, '2026-01-10', { workStatus: 'TRAINING' })];
    const direct = checkPlacementChange({ records: training, kind: 'WORK_STATUS', effectiveFrom: '2026-05-01', value: 'EMPLOYEE' });
    expect(direct).toEqual({ ok: false, error: 'Training menjadi Karyawan diputuskan lewat Promosi Training.' });
    const promotion = checkPlacementChange({
      records: training, kind: 'WORK_STATUS', effectiveFrom: '2026-05-01', value: 'EMPLOYEE', viaPromotion: true,
    });
    expect(promotion.ok).toBe(true);
  });

  it('pembatalan hanya untuk catatan bertanggal depan dan bukan penempatan awal', () => {
    expect(canCancelPlacement(records[1], '2026-10-31')).toBe(true);
    expect(canCancelPlacement(records[1], '2026-11-01')).toBe(false);
    expect(canCancelPlacement(record(1, '2026-12-01'), '2026-10-31')).toBe(false);
  });
});

describe('aktif / nonaktif (KAR-07, 55)', () => {
  it('nonaktif berlaku sehari sesudah tanggal terakhir bekerja', () => {
    const events = [{ id: 1, kind: 'DEACTIVATE' as const, effectiveOn: deactivationEffectiveOn('2026-11-15') }];
    expect(activeOn(events, '2026-11-15')).toBe(true);
    expect(activeOn(events, '2026-11-16')).toBe(false);
    expect(activeOn([], '2026-11-16')).toBe(true);
  });

  it('kejadian 12 dan 38: salah nonaktif atau masuk lagi → diaktifkan lagi, dua kejadian tercatat', () => {
    const events = [
      { id: 1, kind: 'DEACTIVATE' as const, effectiveOn: '2026-11-16' },
      { id: 2, kind: 'REACTIVATE' as const, effectiveOn: '2026-12-01' },
    ];
    expect(activeOn(events, '2026-11-20')).toBe(false);
    expect(activeOn(events, '2026-12-01')).toBe(true);
  });

  it('urutan kejadian dijaga', () => {
    const joinedOn = '2026-01-10';
    expect(checkEmploymentEvent({ events: [], kind: 'REACTIVATE', effectiveOn: '2026-02-01', joinedOn }).ok).toBe(false);
    expect(checkEmploymentEvent({ events: [], kind: 'DEACTIVATE', effectiveOn: '2026-01-10', joinedOn }).ok).toBe(false);
    const off = [{ id: 1, kind: 'DEACTIVATE' as const, effectiveOn: '2026-11-16' }];
    expect(checkEmploymentEvent({ events: off, kind: 'DEACTIVATE', effectiveOn: '2026-12-01', joinedOn }).ok).toBe(false);
    expect(checkEmploymentEvent({ events: off, kind: 'REACTIVATE', effectiveOn: '2026-11-10', joinedOn }).ok).toBe(false);
    expect(checkEmploymentEvent({ events: off, kind: 'REACTIVATE', effectiveOn: '2026-11-16', joinedOn }).ok).toBe(true);
  });
});

describe('antrean promosi (KAR-20, 21, 23)', () => {
  const base = { joinedOn: '2026-01-10', workStatusToday: 'TRAINING' as const, activeToday: true, reviews: [] };

  it('masuk antrean saat genap 3 bulan, tidak sehari sebelumnya', () => {
    expect(promotionDueOn({ ...base, today: '2026-04-09' })).toBeNull();
    expect(promotionDueOn({ ...base, today: '2026-04-10' })).toBe('2026-04-10');
  });

  it('kejadian 10: ditunda masuk lagi pada tanggal nilai lagi', () => {
    const reviews = [{ id: 1, decision: 'DEFER' as const, reviewAgainOn: '2026-05-10' }];
    expect(promotionDueOn({ ...base, reviews, today: '2026-05-09' })).toBeNull();
    expect(promotionDueOn({ ...base, reviews, today: '2026-05-10' })).toBe('2026-05-10');
  });

  it('sudah disetujui, sudah Karyawan, atau nonaktif tidak masuk antrean', () => {
    const approved = [{ id: 1, decision: 'APPROVE' as const, reviewAgainOn: null }];
    expect(promotionDueOn({ ...base, reviews: approved, today: '2026-05-01' })).toBeNull();
    expect(promotionDueOn({ ...base, workStatusToday: 'EMPLOYEE', today: '2026-05-01' })).toBeNull();
    expect(promotionDueOn({ ...base, activeToday: false, today: '2026-05-01' })).toBeNull();
  });
});

describe('isian data orang', () => {
  it('nomor HP disimpan satu bentuk supaya kembar terdeteksi (kejadian 17)', () => {
    expect(normalizePhone('+62 812-3456-7890')).toBe('081234567890');
    expect(normalizePhone('0812 3456 7890')).toBe('081234567890');
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('12ab')).toBe('INVALID');
  });

  it('kolom di luar daftar yang boleh tidak ikut tersimpan', () => {
    const result = cleanPersonFields({ phone: '0812345678', name: 'Orang Lain', code: 'HML-9999' }, ['phone']);
    expect(result).toEqual({ ok: true, values: { phone: '0812345678' } });
  });

  it('nama wajib dan rekening hanya angka', () => {
    expect(cleanPersonFields({ name: ' ' }, ['name']).ok).toBe(false);
    expect(cleanPersonFields({ bankAccountNumber: '12-34 5678' }, ['bankAccountNumber'])).toEqual({ ok: true, values: { bankAccountNumber: '12345678' } });
    expect(cleanPersonFields({ bankAccountNumber: 'abc' }, ['bankAccountNumber']).ok).toBe(false);
  });

  it('rekening disamarkan kecuali 4 angka terakhir', () => {
    expect(maskAccountNumber('1234567890')).toBe('••••••7890');
    expect(maskAccountNumber(null)).toBeNull();
  });
});

describe('masa training dari pengaturan bertanggal (spec L2e §3.3)', () => {
  const three = { from: '2026-01-01', months: 3 };

  it('isi awal berlaku sejak dulu: orang yang bergabung sebelum isi awal tetap genap 3 bulan', () => {
    expect(trainingDueOn('2025-08-10', [three])).toBe('2025-11-10');
  });

  it('3 → 4 bulan mulai 1 Desember: yang genap sebelum 1 Desember tidak bergeser', () => {
    const versions = [three, { from: '2026-12-01', months: 4 }];
    expect(trainingDueOn('2026-08-20', versions)).toBe('2026-11-20');
    expect(trainingDueOn('2026-09-01', versions)).toBe('2027-01-01');
    expect(trainingDueOn('2026-09-15', versions)).toBe('2027-01-15');
  });

  it('4 → 3 bulan mulai 1 Desember: yang sudah lewat 3 bulan genap tepat 1 Desember', () => {
    const versions = [{ from: '2026-01-01', months: 4 }, { from: '2026-12-01', months: 3 }];
    expect(trainingDueOn('2026-08-15', versions)).toBe('2026-12-01');
    expect(trainingDueOn('2026-07-15', versions)).toBe('2026-11-15');
    expect(trainingDueOn('2026-10-10', versions)).toBe('2027-01-10');
  });
});
