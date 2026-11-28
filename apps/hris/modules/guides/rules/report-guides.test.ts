import { describe, expect, it } from 'vitest';
import { cleanReportGuide, matchesGuideSearch, moveInOrder, reportGuideProblem } from './report-guides';

const known = (key: string) => key === 'absence';

describe('Pedoman Lapor (spec F3-5 §2)', () => {
  it('jenis kasus wajib bila tanpa jenis pengajuan; jenis pengajuan harus dikenal', () => {
    expect(reportGuideProblem(cleanReportGuide({ requestType: null, caseLabel: '  ', reportTo: 'Telepon Kepala Gudang.' }), known))
      .toBe('Pilih jenis pengajuan atau tulis jenis kasusnya.');
    expect(reportGuideProblem(cleanReportGuide({ requestType: 'tidak_ada', caseLabel: null, reportTo: 'x' }), known)).toBe('Jenis pengajuan tidak dikenal.');
    expect(reportGuideProblem(cleanReportGuide({ requestType: null, caseLabel: 'Mobil mogok', reportTo: ' ' }), known)).toBe('Tulis lapor ke siapa.');
    expect(reportGuideProblem(cleanReportGuide({ requestType: null, caseLabel: 'Mobil mogok', reportTo: 'Telepon Kepala Gudang.' }), known)).toBeNull();
  });

  it('memilih jenis pengajuan membuang jenis kasus yang diketik', () => {
    expect(cleanReportGuide({ requestType: 'absence', caseLabel: 'abc', reportTo: ' Lapor HR. ' }))
      .toEqual({ requestType: 'absence', caseLabel: null, reportTo: 'Lapor HR.' });
  });

  it('geser naik/turun; di ujung tidak berubah', () => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(moveInOrder(rows, 2, 'up')?.map((r) => r.id)).toEqual([2, 1, 3]);
    expect(moveInOrder(rows, 2, 'down')?.map((r) => r.id)).toEqual([1, 3, 2]);
    expect(moveInOrder(rows, 1, 'up')).toBeNull();
    expect(moveInOrder(rows, 3, 'down')).toBeNull();
  });

  it('cari mencocokkan jenis kasus atau isi', () => {
    expect(matchesGuideSearch({ caseLabel: 'Mobil mogok', reportTo: 'Telepon Kepala Gudang' }, 'gudang')).toBe(true);
    expect(matchesGuideSearch({ caseLabel: 'Mobil mogok', reportTo: 'Telepon Kepala Gudang' }, 'kasbon')).toBe(false);
  });
});
