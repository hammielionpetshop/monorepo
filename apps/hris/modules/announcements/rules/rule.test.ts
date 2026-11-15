import { describe, expect, it } from 'vitest';
import {
  approvalSchedule, dateWib, earliestEffective, needsApproval, ruleStatus, validateRule, withdrawBlock, type RuleInput,
} from './rule';

const gaps = { unfavorable: 7, favorable: 1 };
// 15 Nov 2026 10.00 WIB
const now = new Date('2026-11-15T03:00:00Z');
const input = (over: Partial<RuleInput> = {}): RuleInput => ({
  title: 'Tarif lembur naik', beforeText: 'Rp10.000 per jam', afterText: 'Rp12.000 per jam', askWhom: 'HR',
  changeKind: 'UNFAVORABLE', affectsMoney: true, target: { all: true }, publishesAt: null, effectiveOn: '2026-11-22', ...over,
});

describe('dua tanggal (spec F3-3 §3.2, PRD Fase 3 03 §2)', () => {
  it('merugikan: paling cepat 7 hari sesudah terbit; kurang ditolak', () => {
    expect(validateRule(input({ effectiveOn: '2026-11-22' }), gaps, now).ok).toBe(true);
    const short = validateRule(input({ effectiveOn: '2026-11-21' }), gaps, now);
    expect(short).toMatchObject({ ok: false });
    expect(!short.ok && short.error).toContain('2026-11-22');
  });

  it('menguntungkan: paling cepat 1 hari; tidak pernah berlaku di hari terbit', () => {
    expect(validateRule(input({ changeKind: 'FAVORABLE', effectiveOn: '2026-11-16' }), gaps, now).ok).toBe(true);
    expect(validateRule(input({ changeKind: 'FAVORABLE', effectiveOn: '2026-11-15' }), gaps, now).ok).toBe(false);
    // Pengaturan 0 tetap dianggap 1 hari.
    expect(validateRule(input({ changeKind: 'FAVORABLE', effectiveOn: '2026-11-15' }), { unfavorable: 0, favorable: 0 }, now).ok).toBe(false);
  });

  it('jarak dihitung dari tanggal terbit WIB, termasuk jadwal terbit', () => {
    const publishesAt = new Date('2026-11-20T17:30:00Z'); // 21 Nov 00.30 WIB
    expect(dateWib(publishesAt)).toBe('2026-11-21');
    expect(earliestEffective(publishesAt, 'UNFAVORABLE', gaps)).toBe('2026-11-28');
    expect(validateRule(input({ publishesAt, effectiveOn: '2026-11-27' }), gaps, now).ok).toBe(false);
    expect(validateRule(input({ publishesAt, effectiveOn: '2026-11-28' }), gaps, now).ok).toBe(true);
  });

  it('jadwal terbit lampau ditolak', () => {
    expect(validateRule(input({ publishesAt: new Date('2026-11-14T03:00:00Z') }), gaps, now)).toMatchObject({ ok: false });
  });

  it('isi wajib dan sasaran tidak kosong', () => {
    expect(validateRule(input({ beforeText: ' ' }), gaps, now).ok).toBe(false);
    expect(validateRule(input({ askWhom: '' }), gaps, now).ok).toBe(false);
    expect(validateRule(input({ target: { all: false, branchIds: [], positionIds: [] } }), gaps, now).ok).toBe(false);
  });
});

describe('persetujuan uang (keputusan §9 butir 2, 6)', () => {
  it('uang oleh HR perlu persetujuan; oleh Pemilik/GM dan yang bukan uang tidak', () => {
    expect(needsApproval(true, false)).toBe(true);
    expect(needsApproval(true, true)).toBe(false);
    expect(needsApproval(false, false)).toBe(false);
  });

  it('disetujui sesudah jadwal lewat: terbit sekarang, tanggal berlaku bergeser', () => {
    const late = approvalSchedule({ publishesAt: new Date('2026-11-10T03:00:00Z'), effectiveOn: '2026-11-17', changeKind: 'UNFAVORABLE' }, gaps, now);
    expect(late.publishesAt).toBe(now);
    expect(late.effectiveOn).toBe('2026-11-22');
    expect(late.shifted).toBe(true);
  });

  it('disetujui sebelum jadwal: tidak bergeser', () => {
    const planned = new Date('2026-11-16T03:00:00Z');
    const early = approvalSchedule({ publishesAt: planned, effectiveOn: '2026-11-30', changeKind: 'UNFAVORABLE' }, gaps, now);
    expect(early).toEqual({ publishesAt: planned, effectiveOn: '2026-11-30', shifted: false });
  });
});

describe('status dan tarik', () => {
  const base = { showsFrom: new Date('2026-11-14T03:00:00Z'), effectiveOn: '2026-11-22', endedAt: null, corrected: false, superseded: false };

  it('Terjadwal → Terbit → Berlaku; Ditarik/Diralat/Digantikan didahulukan', () => {
    expect(ruleStatus({ ...base, showsFrom: new Date('2026-11-16T03:00:00Z') }, now, '2026-11-15')).toBe('SCHEDULED');
    expect(ruleStatus(base, now, '2026-11-15')).toBe('PUBLISHED');
    expect(ruleStatus(base, now, '2026-11-22')).toBe('EFFECTIVE');
    expect(ruleStatus({ ...base, corrected: true }, now, '2026-11-15')).toBe('CORRECTED');
    expect(ruleStatus({ ...base, superseded: true }, now, '2026-11-15')).toBe('SUPERSEDED');
    expect(ruleStatus({ ...base, endedAt: now, corrected: true }, now, '2026-11-15')).toBe('WITHDRAWN');
  });

  it('tarik hanya sebelum berlaku', () => {
    expect(withdrawBlock(base, '2026-11-21')).toBeNull();
    expect(withdrawBlock(base, '2026-11-22')).toContain('sudah berlaku');
    expect(withdrawBlock({ ...base, endedAt: now }, '2026-11-15')).toContain('sudah ditarik');
  });
});
