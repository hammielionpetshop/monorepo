import { describe, expect, it } from 'vitest';
import { UNASSIGNED_POSITION, legacyEnrichSql, legacyLoadSql, mapLegacyRows } from './legacy-load';

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

  it('SQL satu transaksi, tanda kutip aman, kode dari server, tandai LEGACY, kode EMP jadi Kode lama', () => {
    const { employees } = mapLegacyRows([row({ Alamat: "Jl. Jum'at" })]);
    const sql = legacyLoadSql(employees);
    expect(sql).toContain('ON_ERROR_STOP');
    expect(sql.trim().endsWith('COMMIT;')).toBe(true);
    expect(sql).toContain("Jl. Jum''at");
    expect(sql).toContain('hris.next_employee_code()');
    expect(sql).toContain("'LEGACY'");
    expect(sql).toMatch(/source, legacy_code, [\s\S]*'LEGACY', 'EMP-100', /);
  });

  it('L9c: NIK dan hubungan kontak darurat ikut; NIK keliru dikosongkan dengan peringatan; NIK kembar ditolak', () => {
    const result = mapLegacyRows([
      row({ NIK: '3206 0101 0101 0001', 'Hubungan Kontak Darurat': ' Ibu ' }),
      row({ 'Kode Karyawan': 'EMP-101', NIK: '320601010101000' }),
    ]);
    expect(result.errors).toEqual([]);
    expect(result.employees[0].person).toMatchObject({ nationalId: '3206010101010001', emergencyContactRelation: 'Ibu' });
    expect(result.employees[1].person.nationalId).toBeNull();
    expect(result.warnings).toEqual(['EMP-101: NIK tidak 16 angka, dikosongkan.']);
    const twins = mapLegacyRows([row({ NIK: '3206010101010001' }), row({ 'Kode Karyawan': 'EMP-101', NIK: '3206010101010001' })]);
    expect(twins.errors).toEqual(['EMP-101: NIK sama dengan EMP-100.']);
    expect(mapLegacyRows([row({ 'Kode Karyawan': 'emp 7' })]).errors[0]).toMatch(/EMP-001/);
  });

  it('L9c --enrich: hanya UPDATE karyawan LEGACY bernama sama, tidak menimpa isian HRIS', () => {
    const { employees } = mapLegacyRows([row({ 'Nama Lengkap': "Ma'ruf", NIK: '3206010101010001', 'Hubungan Kontak Darurat': 'Ibu' })]);
    const sql = legacyEnrichSql(employees);
    expect(sql.startsWith('\\set ON_ERROR_STOP on\nBEGIN;')).toBe(true);
    expect(sql).not.toContain('INSERT INTO hris.employees');
    expect(sql).toContain("source = 'LEGACY' AND lower(name) = lower('Ma''ruf')");
    expect(sql).toContain("SET legacy_code = 'EMP-100'");
    expect(sql).toContain("coalesce(national_id, '3206010101010001')");
    expect(sql).toContain("coalesce(emergency_contact_relation, 'Ibu')");
  });
});
