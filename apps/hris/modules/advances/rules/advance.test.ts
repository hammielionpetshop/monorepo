import { describe, expect, it } from 'vitest';
import {
  MSG_FUND, MSG_LEAVING, MSG_NO_SLIP, MSG_PENDING, MSG_PERSON, MSG_TENURE, MSG_WEEKLY, addMonthsClamped, amountProblem, checkAdvanceFacts, handoverDateProblem,
  placeSchedule, remainingOf, splitInstallments, stageOf, usedOf, type AdvanceRules, type CheckFacts,
} from './advance';

const rules: AdvanceRules = { minTenureMonths: 6, personLimit: 250_000, fundSize: 1_000_000, maxInstallments: 3, reasonMin: 15, amountStep: 10_000, amountMin: 50_000 };
const facts = (over: Partial<CheckFacts> = {}): CheckFacts => ({
  active: true, payBasis: 'MONTHLY', hasPackage: true, leaving: false, joinedOn: '2026-01-01', today: '2026-11-03',
  personUsed: 0, fundUsed: 0, hasRunningOrPending: false, hasPending: false, amount: 100_000, ...over,
});

describe('kasbon: periksa kasbon (DRV-55 s.d. 58, 121)', () => {
  it('DRV-121: 6 bulan kalender; tanggal yang tidak ada memakai hari terakhir bulan', () => {
    expect(addMonthsClamped('2026-04-20', 6)).toBe('2026-10-20');
    expect(addMonthsClamped('2026-08-31', 6)).toBe('2027-02-28');
    expect(checkAdvanceFacts(facts({ joinedOn: '2026-05-04' }), rules)).toMatchObject({ ok: false, step: 'TENURE', message: MSG_TENURE });
    expect(checkAdvanceFacts(facts({ joinedOn: '2026-05-03' }), rules)).toEqual({ ok: true });
  });

  it('DRV-58: urutan tetap; gagal di satu langkah, langkah berikutnya tidak diperiksa', () => {
    expect(checkAdvanceFacts(facts({ joinedOn: '2026-10-01', personUsed: 999_999, fundUsed: 9_999_999 }), rules)).toMatchObject({ step: 'TENURE' });
    expect(checkAdvanceFacts(facts({ personUsed: 200_000, fundUsed: 9_999_999, hasRunningOrPending: true }), rules)).toMatchObject({ step: 'PERSON', message: MSG_PERSON });
    expect(checkAdvanceFacts(facts({ fundUsed: 950_000 }), rules)).toMatchObject({ step: 'FUND', message: MSG_FUND });
  });

  it('DRV-56: lewat batas orang tanpa kasbon bersisa/pengajuan menunggu memakai kalimat DRV-57', () => {
    expect(checkAdvanceFacts(facts({ amount: 300_000 }), rules)).toMatchObject({ step: 'PERSON', message: MSG_FUND });
    expect(checkAdvanceFacts(facts({ amount: 250_000 }), rules)).toEqual({ ok: true });
  });

  it('satu pengajuan menunggu per orang; mingguan, tanpa slip, akan berhenti ditolak dengan kalimat terus terang', () => {
    expect(checkAdvanceFacts(facts({ hasPending: true }), rules)).toMatchObject({ step: 'PENDING', message: MSG_PENDING });
    expect(checkAdvanceFacts(facts({ payBasis: 'WEEKLY' }), rules)).toMatchObject({ step: 'ELIGIBLE', message: MSG_WEEKLY });
    expect(checkAdvanceFacts(facts({ hasPackage: false }), rules)).toMatchObject({ message: MSG_NO_SLIP });
    expect(checkAdvanceFacts(facts({ leaving: true }), rules)).toMatchObject({ message: MSG_LEAVING });
  });
});

describe('kasbon: nominal, cicilan, sisa (DRV-65, 67, 122, 125)', () => {
  it('DRV-122: kelipatan Rp10.000, paling sedikit Rp50.000', () => {
    expect(amountProblem(40_000, rules)).toMatch(/paling sedikit/);
    expect(amountProblem(155_000, rules)).toMatch(/kelipatan/);
    expect(amountProblem(150_000, rules)).toBeNull();
  });

  it('DRV-65: dibagi rata dibulatkan ke bawah, sisa di cicilan terakhir', () => {
    expect(splitInstallments(250_000, 3)).toEqual([83_333, 83_333, 83_334]);
    expect(splitInstallments(150_000, 2)).toEqual([75_000, 75_000]);
  });

  it('DRV-132: cicilan pertama di periode tanggal uang; slip tertutup dilewati; tidak melewati slip terakhir', () => {
    expect(placeSchedule([75_000, 75_000], '2026-11-20', new Set())).toEqual(['2026-10-26', '2026-11-26']);
    expect(placeSchedule([75_000, 75_000], '2026-11-20', new Set(['2026-10-26']))).toEqual(['2026-11-26', '2026-12-26']);
    expect(placeSchedule([1, 1, 1], '2026-11-20', new Set(), '2026-11-26')).toEqual(['2026-10-26', '2026-11-26', '2026-11-26']);
  });

  it('DRV-67, 71, 121: sisa dihitung; keadaan dan terpakai mengikuti sisa; Kasbon Khusus tidak dihitung', () => {
    const moves = [{ amount: 75_000, status: 'ACTIVE' }, { amount: 75_000, status: 'REVERSED' }];
    expect(remainingOf(150_000, moves)).toBe(75_000);
    expect(stageOf({ state: 'APPROVED', requestStatus: 'APPROVED', handedOver: true, remaining: 0, transferred: false })).toBe('PAID_OFF');
    expect(stageOf({ state: 'APPROVED', requestStatus: 'APPROVED', handedOver: true, remaining: 0, transferred: true })).toBe('TRANSFERRED');
    expect(stageOf({ state: 'OPEN', requestStatus: 'REVIEWED', handedOver: false, remaining: 0, transferred: false })).toBe('REVIEWED');
    expect(usedOf({ kind: 'REGULAR', state: 'OPEN', requestedAmount: 200_000, finalAmount: null, handedOver: false, remaining: 0 })).toBe(200_000);
    expect(usedOf({ kind: 'REGULAR', state: 'APPROVED', requestedAmount: 200_000, finalAmount: 150_000, handedOver: false, remaining: 0 })).toBe(150_000);
    expect(usedOf({ kind: 'SPECIAL', state: 'APPROVED', requestedAmount: 900_000, finalAmount: 900_000, handedOver: true, remaining: 900_000 })).toBe(0);
  });
});

describe('kasbon: tanggal uang serah (DRV-126; spec L5 §9 butir 5)', () => {
  const base = { today: '2026-11-10', approvedOn: '2026-11-08', reason: null };
  it('tidak masa depan; mundur > 7 hari atau sebelum disetujui wajib alasan', () => {
    expect(handoverDateProblem({ ...base, moneyDate: '2026-11-11' })).toMatch(/sesudah hari ini/);
    expect(handoverDateProblem({ ...base, moneyDate: '2026-11-08' })).toBeNull();
    expect(handoverDateProblem({ ...base, moneyDate: '2026-11-07' })).toMatch(/sebelum kasbon disetujui/);
    expect(handoverDateProblem({ ...base, moneyDate: '2026-11-07', reason: 'Uang diberikan dulu karena mendesak' })).toBeNull();
    expect(handoverDateProblem({ today: '2026-11-20', approvedOn: '2026-11-01', reason: null, moneyDate: '2026-11-10' })).toMatch(/lebih dari 7 hari/);
  });
});
