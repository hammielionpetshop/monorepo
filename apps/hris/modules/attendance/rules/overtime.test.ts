import { describe, expect, it } from 'vitest';
import { approvalProblem, claimDeadline, correctionBlockedByApproval, nextState, officeClosing, ordererProblem, overtimeHours, overtimeSkip, overtimeTotals } from './overtime';

const at = (clock: string, date = '2026-11-10') => new Date(`${date}T${clock}:00+07:00`);
const base = { workDate: '2026-11-10', startTime: '08:00', endTime: '17:00', closing: '21:00', minHours: 1, maxHours: 3 };

describe('jam lembur terdeteksi (KEH-70, 71, 159)', () => {
  it('jam penuh dibulatkan ke bawah', () => {
    expect(overtimeHours({ ...base, outAt: at('18:10') })).toBe(1);
    expect(overtimeHours({ ...base, outAt: at('19:59') })).toBe(2);
  });
  it('kurang dari 1 jam atau pulang tepat waktu = 0', () => {
    expect(overtimeHours({ ...base, outAt: at('17:59') })).toBe(0);
    expect(overtimeHours({ ...base, outAt: at('16:00') })).toBe(0);
  });
  it('paling banyak 3 jam', () => {
    expect(overtimeHours({ ...base, closing: null, outAt: at('23:30') })).toBe(3);
  });
  it('berhenti di jam tutup; shift terakhir tidak pernah lembur', () => {
    expect(overtimeHours({ ...base, closing: '18:30', outAt: at('20:30') })).toBe(1);
    expect(overtimeHours({ ...base, closing: '17:00', startTime: '12:00', outAt: at('20:30') })).toBe(0);
  });
  it('shift lewat tengah malam', () => {
    expect(overtimeHours({ ...base, startTime: '16:00', endTime: '00:00', closing: '02:00', outAt: at('01:30', '2026-11-11') })).toBe(1);
  });
  it('jam tutup kantor dari pengaturan', () => {
    expect(officeClosing(20)).toBe('20:00');
    expect(overtimeHours({ ...base, closing: officeClosing(20), outAt: at('23:00') })).toBe(3);
    expect(overtimeHours({ ...base, closing: officeClosing(18), outAt: at('23:00') })).toBe(1);
  });
});

describe('hari tanpa lembur (KEH-25, 99, 165)', () => {
  const ok = { tracked: true, eligible: true, hasShift: true, hasOut: true, closed: false, dayOffWork: false };
  it('hari biasa dihitung', () => expect(overtimeSkip(ok)).toBeNull());
  it('jabatan tidak dapat lembur, hari tutup, diminta masuk di hari libur', () => {
    expect(overtimeSkip({ ...ok, eligible: false })).toBe('NOT_ELIGIBLE');
    expect(overtimeSkip({ ...ok, closed: true })).toBe('CLOSED');
    expect(overtimeSkip({ ...ok, dayOffWork: true })).toBe('DAY_OFF_WORK');
  });
  it('belum ada jam pulang yang dihitung (KEH-89)', () => expect(overtimeSkip({ ...ok, hasOut: false })).toBe('NO_OUT'));
});

describe('batas klaim (KEH-161, 165)', () => {
  it('tanggal + 3 hari pukul 23.59', () => {
    expect(claimDeadline('2026-11-09', 3, null).toISOString()).toBe(new Date('2026-11-13T00:00:00+07:00').toISOString());
  });
  it('lupa pulang yang dijelaskan: 3 hari sejak disahkan', () => {
    expect(claimDeadline('2026-11-09', 3, '2026-11-12').toISOString()).toBe(new Date('2026-11-16T00:00:00+07:00').toISOString());
  });
});

describe('pengesahan dan penyuruh (KEH-162, 163, 166)', () => {
  it('turun saja, jam penuh, alasan wajib', () => {
    expect(approvalProblem(3, 3, null)).toBeNull();
    expect(approvalProblem(2, 3, 'kertas hanya 2 jam')).toBeNull();
    expect(approvalProblem(2, 3, null)).toMatch(/alasan/);
    expect(approvalProblem(4, 3, null)).toMatch(/melebihi/);
    expect(approvalProblem(0, 3, 'x')).toMatch(/paling sedikit/);
    expect(approvalProblem(1.5, 3, 'x')).toMatch(/paling sedikit/);
  });
  it('penyuruh bukan diri sendiri dan harus di daftar', () => {
    expect(ordererProblem(1, 1, new Set([1]))).toMatch(/diri sendiri/);
    expect(ordererProblem(2, 1, new Set([3]))).toMatch(/daftar/);
    expect(ordererProblem(3, 1, new Set([3]))).toBeNull();
  });
  it('koreksi di bawah jam disahkan ditolak; yang menaikkan boleh', () => {
    expect(correctionBlockedByApproval(1, 2)).toBe(true);
    expect(correctionBlockedByApproval(3, 2)).toBe(false);
    expect(correctionBlockedByApproval(0, null)).toBe(false);
  });
});

describe('keadaan dan tiga angka (spec §3.2, KEH-77)', () => {
  it('hitung ulang', () => {
    expect(nextState(null, 0)).toBeNull();
    expect(nextState(null, 2)).toBe('OPEN');
    expect(nextState('OPEN', 0)).toBe('VOID');
    expect(nextState('VOID', 1)).toBe('OPEN');
    expect(nextState('CLAIMED', 0)).toBe('CLAIMED');
    expect(nextState('APPROVED', 3)).toBe('APPROVED');
  });
  it('terdeteksi / diklaim / disahkan', () => {
    expect(overtimeTotals([
      { state: 'OPEN', hours: 1, claimedHours: null, approvedHours: null },
      { state: 'CLAIMED', hours: 2, claimedHours: 2, approvedHours: null },
      { state: 'APPROVED', hours: 3, claimedHours: 3, approvedHours: 2 },
      { state: 'VOID', hours: 0, claimedHours: null, approvedHours: null },
    ])).toEqual({ detected: 6, claimed: 5, approved: 2 });
  });
});
