import { describe, expect, it } from 'vitest';
import { accountTail, dueBucket, dueDateOf, moneyDateProblem, payDateOf, reminderDue, sortTransfer, transferCsv } from './payment';

describe('tanggal uang (GAJ-99)', () => {
  const base = { today: '2026-12-10', closedOn: '2026-11-29', reason: null };
  it('hari ini dan mundur sampai 7 hari boleh tanpa alasan', () => {
    expect(moneyDateProblem({ ...base, moneyDate: '2026-12-10' })).toBeNull();
    expect(moneyDateProblem({ ...base, moneyDate: '2026-12-03' })).toBeNull();
  });
  it('mundur lebih dari 7 hari wajib alasan', () => {
    expect(moneyDateProblem({ ...base, moneyDate: '2026-12-02' })).toMatch(/alasan/);
    expect(moneyDateProblem({ ...base, moneyDate: '2026-12-02', reason: 'Lupa ditandai saat gajian' })).toBeNull();
  });
  it('tidak masa depan, tidak sebelum ditutup, format sah', () => {
    expect(moneyDateProblem({ ...base, moneyDate: '2026-12-11' })).toMatch(/sesudah hari ini/);
    expect(moneyDateProblem({ ...base, moneyDate: '2026-11-28', reason: 'Dibayar lebih dulu sebelum tutup' })).toMatch(/sebelum slip ditutup/);
    expect(moneyDateProblem({ ...base, moneyDate: '10-12-2026' })).toMatch(/tidak sah/);
  });
});

describe('jatuh bayar (GAJ-41, 104)', () => {
  it('tanggal 1 sesudah periode berakhir 25', () => {
    expect(payDateOf('2026-10-26', 1)).toBe('2026-12-01');
    expect(payDateOf('2026-11-26', 1)).toBe('2027-01-01');
  });
  it('tanggal sesudah 25 di bulan yang sama', () => {
    expect(payDateOf('2026-10-26', 28)).toBe('2026-11-28');
  });
  it('ditutup lebih lambat = tanggal ditutup; mode uji = tanggal ditutup', () => {
    expect(dueDateOf('2026-12-01', '2026-12-03', false)).toBe('2026-12-03');
    expect(dueDateOf('2026-12-01', '2026-11-29', false)).toBe('2026-12-01');
    expect(dueDateOf('2026-12-01', '2026-11-04', true)).toBe('2026-11-04');
  });
  it('kelompok Jadwal Bayar dan pengingat mulai hari sesudahnya', () => {
    expect(dueBucket('2026-12-01', '2026-12-03')).toEqual({ bucket: 'LATE', daysLate: 2 });
    expect(dueBucket('2026-12-01', '2026-12-01').bucket).toBe('TODAY');
    expect(dueBucket('2026-12-01', '2026-11-24').bucket).toBe('WEEK');
    expect(dueBucket('2026-12-01', '2026-11-23').bucket).toBe('LATER');
    expect(reminderDue('2026-12-01', '2026-12-01')).toBe(false);
    expect(reminderDue('2026-12-01', '2026-12-02')).toBe(true);
  });
});

describe('Daftar Transfer (GAJ-100)', () => {
  const rows = [
    { name: 'Budi', bank: 'Mandiri', accountNumber: '0012345', accountHolder: 'Budi S', net: 2_000_000 },
    { name: 'Ani', bank: 'BCA', accountNumber: '998877', accountHolder: 'Ani; R', net: 1_500_000 },
    { name: 'Cici', bank: null, accountNumber: null, accountHolder: null, net: 500_000 },
  ];
  it('urut per bank, tanpa rekening di akhir', () => {
    expect(sortTransfer(rows).map((r) => r.name)).toEqual(['Ani', 'Budi', 'Cici']);
  });
  it('CSV: nomor rekening teks, sel berisi titik koma dikutip, jumlah', () => {
    const csv = transferCsv(rows, { period: 'Oktober', madeBy: 'Irma', madeAt: '3 Nov 2026' }).split('\r\n');
    expect(csv[0]).toBe('sep=;');
    expect(csv[3]).toBe('Ani;BCA;="998877";"Ani; R";1500000');
    expect(csv[4]).toContain('="0012345"');
    expect(csv[5]).toContain('Belum ada rekening');
    expect(csv[6]).toBe('Jumlah;;;;4000000');
  });
  it('empat angka terakhir', () => {
    expect(accountTail('123-456-7890')).toBe('•••7890');
    expect(accountTail(null)).toBeNull();
  });
});
