import { describe, expect, it } from 'vitest';
import { UNASSIGNED_POSITION, legacyLoadSql, mapLegacyRows } from './legacy-load';

const row = (over: Record<string, unknown> = {}) => ({
  'Kode Karyawan': 'EMP-100', 'Nama Lengkap': 'Budi Contoh', Status: 'Aktif', Jabatan: 'Kasir', Cabang: 'Toko Pusat',
  'Tipe Karyawan': 'permanent', 'Tanggal Masuk': '2026-01-05', Tanggungan: 0, ...over,
});

describe('muat data awal karyawan', () => {
  it('nonaktif dan kode yang dikecualikan tidak ikut; koreksi nama dipakai', () => {
    const result = mapLegacyRows([
      row(), row({ 'Kode Karyawan': 'EMP-101', Status: 'Nonaktif' }), row({ 'Kode Karyawan': 'EMP-102' }),
      row({ 'Kode Karyawan': 'EMP-103', 'Nama Lengkap': 'Sri' }),
    ], { excludeCodes: ['EMP-102'], renames: { 'EMP-103': 'Sri Wahyuni' } });
    expect(result.errors).toEqual([]);
    expect(result.employees.map((e) => e.person.name)).toEqual(['Budi Contoh', 'Sri Wahyuni']);
    expect([result.skippedInactive, result.skippedExcluded]).toEqual([1, 1]);
  });

  it('cabang, jabatan, dan status kerja dipetakan sesuai keputusan owner', () => {
    const map = (over: Record<string, unknown>) => mapLegacyRows([row(over)]).employees[0];
    expect(map({ Cabang: 'Back Office' }).branchName).toBe('Gudang');
    expect(map({ Cabang: 'Raja Petshop' }).branchName).toBe('Toko Raja');
    expect(map({ Cabang: 'Markas Petshop' }).branchName).toBe('Toko Markas');
    expect(map({ Jabatan: 'Owner' }).positionName).toBe('Pemilik');
    expect(map({ Jabatan: 'Helper' }).positionName).toBe(UNASSIGNED_POSITION);
    expect(map({ 'Tipe Karyawan': 'training' }).workStatus).toBe('TRAINING');
    expect(map({ 'Tipe Karyawan': 'driver' }).workStatus).toBe('EMPLOYEE');
  });

  it('ejaan campur dirapikan dan yang kosong tetap kosong', () => {
    const { person } = mapLegacyRows([row({ 'Jenis Kelamin': 'Laki-laki', 'Status Pernikahan': 'single', 'No. HP': '+62 812-3456-7890' })]).employees[0];
    expect(person).toMatchObject({ gender: 'MALE', maritalStatus: 'Belum menikah', phone: '081234567890', birthDate: null, bankName: null });
    expect(mapLegacyRows([row({ 'Jenis Kelamin': 'female', 'Status Pernikahan': 'married' })]).employees[0].person)
      .toMatchObject({ gender: 'FEMALE', maritalStatus: 'Menikah' });
  });

  it('semua kesalahan dilaporkan dengan baris dan sebabnya', () => {
    const { errors } = mapLegacyRows([
      row({ Cabang: 'Cabang Hilang' }), row({ 'Kode Karyawan': 'EMP-2', Jabatan: 'Astronot' }),
      row({ 'Kode Karyawan': 'EMP-3', 'No. HP': 'abc' }), row({ 'Kode Karyawan': 'EMP-4', 'Jenis Kelamin': 'x' }),
      row({ 'Kode Karyawan': 'EMP-5', 'No. HP': '081234567890' }), row({ 'Kode Karyawan': 'EMP-6', 'No. HP': '081234567890' }),
    ]);
    expect(errors).toHaveLength(5);
    expect(errors[0]).toContain('Baris 2');
    expect(errors.at(-1)).toContain('nomor HP sama');
  });

  it('SQL satu transaksi, tanda kutip aman, kode dari server, tandai LEGACY', () => {
    const { employees } = mapLegacyRows([row({ Alamat: "Jl. Jum'at" })]);
    const sql = legacyLoadSql(employees);
    expect(sql).toContain('ON_ERROR_STOP');
    expect(sql.trim().endsWith('COMMIT;')).toBe(true);
    expect(sql).toContain("Jl. Jum''at");
    expect(sql).toContain('hris.next_employee_code()');
    expect(sql).toContain("'LEGACY'");
    expect(sql).not.toContain('EMP-100');
  });
});
