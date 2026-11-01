import { describe, expect, it } from 'vitest';
import { wibInstant } from './attendance';
import { handoverProblem, namesInText, nextStep, previousStep, relocationBranch, reportState, teamRecipients } from './end-of-day';

describe('Laporan Pulang (spec L3d §3)', () => {
  it('urutan langkah tetap: serah terima → masalah → kirim', () => {
    expect(nextStep('HANDOVER')).toBe('PROBLEM');
    expect(nextStep('PROBLEM')).toBe('SEND');
    expect(nextStep('SEND')).toBeNull();
    expect(previousStep('HANDOVER')).toBeNull();
    expect(previousStep('SEND')).toBe('PROBLEM');
  });

  it('panjang serah terima dihitung dari isi yang dirapikan', () => {
    expect(handoverProblem('   ', 20)).toMatch(/wajib/);
    expect(handoverProblem('aman    semua', 20)).toMatch(/paling sedikit 20 huruf \(sekarang 10\)/);
    expect(handoverProblem('Stok pasir tinggal dua karung', 20)).toBeNull();
  });

  it('jam pulang hanya dari Pulang berlaporan; lewat batas = tidak terkirim', () => {
    const base = { hasOut: true, workDate: '2026-10-01', cutoffHour: 4 } as const;
    expect(reportState({ ...base, hasOut: false, reported: false, now: wibInstant('2026-10-01', '20:00') })).toBe('NONE');
    expect(reportState({ ...base, reported: false, now: wibInstant('2026-10-02', '03:59') })).toBe('PENDING');
    expect(reportState({ ...base, reported: false, now: wibInstant('2026-10-02', '04:00') })).toBe('MISSED');
    expect(reportState({ ...base, reported: true, now: wibInstant('2026-10-05', '10:00') })).toBe('SENT');
  });
});

describe('penerima "Tim saya" (KEH-90)', () => {
  const people = [
    { employeeId: 1, branchId: 10, departmentId: 3 },
    { employeeId: 2, branchId: 10, departmentId: 3 },
    { employeeId: 3, branchId: 20, departmentId: 3 },
    { employeeId: 4, branchId: 30, departmentId: 1 },
    { employeeId: 5, branchId: 10, departmentId: 1 },
  ];
  it('cabang tempat absen, termasuk yang perbantuan di sana, tanpa dirinya', () => {
    expect(teamRecipients({ selfId: 1, office: false, departmentId: 3, branchId: 10, people, presentIds: [3, 99] })).toEqual([2, 3, 5]);
  });
  it('kantor = departemennya', () => {
    expect(teamRecipients({ selfId: 4, office: true, departmentId: 1, branchId: 30, people, presentIds: [1] })).toEqual([5]);
  });
  it('sendirian = tanpa penerima', () => {
    expect(teamRecipients({ selfId: 3, office: false, departmentId: 3, branchId: 20, people, presentIds: [] })).toEqual([]);
  });
});

describe('Sudah Pindah Cabang? (KEH-27)', () => {
  const days = (branches: number[]) => branches.map((branchId, i) => ({ workDate: `2026-10-${String(20 - i).padStart(2, '0')}`, branchId }));
  it('7 hari kerja berturut-turut di cabang lain (hari tanpa absen tidak ada di daftar)', () => {
    expect(relocationBranch(days([5, 5, 5, 5, 5, 5, 5]), 1, 7)).toBe(5);
  });
  it('kurang dari 7 hari, atau cabang asal di tengah, memutus', () => {
    expect(relocationBranch(days([5, 5, 5, 5, 5, 5]), 1, 7)).toBeNull();
    expect(relocationBranch(days([5, 5, 5, 1, 5, 5, 5]), 1, 7)).toBeNull();
    expect(relocationBranch(days([5, 5, 5, 6, 5, 5, 5]), 1, 7)).toBeNull();
    expect(relocationBranch(days([1, 1, 1, 1, 1, 1, 1]), 1, 7)).toBeNull();
  });
});

describe('peringatan nama di tanggapan (KEH-129)', () => {
  it('nama lengkap orang aktif, tidak peka huruf besar; dalam batas kata', () => {
    expect(namesInText('Sudah ditegur, Dedi Kurnia minta maaf.', ['Dedi Kurnia', 'Ani'])).toEqual(['Dedi Kurnia']);
    expect(namesInText('ani sudah aman', ['Ani'])).toEqual(['Ani']);
    expect(namesInText('Daniel datang', ['Ani'])).toEqual([]);
    expect(namesInText('Terima kasih, sudah ditangani Supriadi.', ['Supriadi'])).toEqual(['Supriadi']);
    expect(namesInText('Sudah ditangani.', ['Supriadi'])).toEqual([]);
  });
});
