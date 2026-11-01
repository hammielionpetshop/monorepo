import { describe, expect, it } from 'vitest';
import {
  acceptDates, branchCap, dateBlock, markDueAfter, newcomerGraceEnds, periodRange, proratedQuota, swapAnswerBy, windowOf, windowPhase,
  replacementChooseBy, type PickContext,
} from './days-off';
import { dayStatus } from './review';

const RULES = { windowOpenDay: 10, windowCloseDay: 25 };
const P = '2026-10-26'; // periode 26 Okt – 25 Nov

function context(patch: Partial<PickContext> = {}): PickContext {
  return {
    periodStart: P, today: '2026-10-20', earliest: '2026-10-20', otherDates: [], replacementDates: [], closedDates: new Set(),
    takenByOthers: new Map(), caps: new Map(), rules: { weekendMax: 1, minGapDays: 5 }, ...patch,
  };
}

describe('jendela memilih libur (KEH-132, W29)', () => {
  it('dibuka tanggal 10, ditutup tanggal 25 bulan awal periode', () => {
    expect(windowOf(P, RULES)).toEqual({ opens: '2026-10-10', closes: '2026-10-25' });
    expect(windowPhase(P, '2026-10-09', RULES)).toBe('BEFORE');
    expect(windowPhase(P, '2026-10-25', RULES)).toBe('OPEN');
    expect(windowPhase(P, '2026-10-26', RULES)).toBe('LATE');
    expect(windowPhase(P, '2026-11-26', RULES)).toBe('OVER');
  });
  it('periode berakhir tanggal 25 bulan berikutnya', () => {
    expect(periodRange(P)).toEqual({ start: '2026-10-26', end: '2026-11-25' });
    expect(periodRange('2026-12-26')).toEqual({ start: '2026-12-26', end: '2027-01-25' });
  });
});

describe('jarak dan akhir pekan (KEH-134, W31)', () => {
  it('libur Senin 9 Nov: Kamis dan Jumat ditolak, Sabtu 14 Nov diterima', () => {
    const ctx = context({ otherDates: ['2026-11-09'] });
    expect(dateBlock('2026-11-12', ctx)).toBe('TOO_CLOSE');
    expect(dateBlock('2026-11-13', ctx)).toBe('TOO_CLOSE');
    expect(dateBlock('2026-11-14', ctx)).toBeNull();
  });
  it('jarak dihitung lintas periode: Sabtu 24 Okt dan Selasa 27 Okt ditolak', () => {
    expect(dateBlock('2026-10-27', context({ otherDates: ['2026-10-24'] }))).toBe('TOO_CLOSE');
  });
  it('paling banyak 1 Sabtu atau Minggu per periode', () => {
    const ctx = context({ otherDates: ['2026-10-31'] });
    expect(dateBlock('2026-11-14', ctx)).toBe('WEEKEND_USED');
    expect(dateBlock('2026-11-11', ctx)).toBeNull();
  });
  it('akhir pekan periode tetangga tidak memakai jatah periode ini', () => {
    expect(dateBlock('2026-11-07', context({ otherDates: ['2026-10-17'] }))).toBeNull();
  });
});

describe('batas cabang (KEH-34)', () => {
  it('cabang 2 orang = 1, cabang 1 orang tetap boleh, cabang besar = pengaturan', () => {
    expect(branchCap(2, 1)).toBe(1);
    expect(branchCap(2, 2)).toBe(1);
    expect(branchCap(2, 3)).toBe(2);
    expect(branchCap(2, 10)).toBe(2);
  });
  it('tanggal penuh ditolak', () => {
    const ctx = context({ takenByOthers: new Map([['2026-11-03', 2]]), caps: new Map([['2026-11-03', 2]]) });
    expect(dateBlock('2026-11-03', ctx)).toBe('FULL');
  });
});

describe('tanggal lain', () => {
  it('sudah lewat, terlalu dekat (jalur terlambat), hari tutup, di luar periode, sudah libur', () => {
    const ctx = context({ today: '2026-11-02', earliest: '2026-11-04', closedDates: new Set(['2026-11-10']), replacementDates: ['2026-11-20'] });
    expect(dateBlock('2026-11-01', ctx)).toBe('PAST');
    expect(dateBlock('2026-11-03', ctx)).toBe('TOO_SOON');
    expect(dateBlock('2026-11-04', ctx)).toBeNull();
    expect(dateBlock('2026-11-10', ctx)).toBe('CLOSED');
    expect(dateBlock('2026-11-26', ctx)).toBe('OUTSIDE');
    expect(dateBlock('2026-11-20', ctx)).toBe('MINE');
  });
});

describe('simpan sebagian', () => {
  it('menerima berurutan; yang melanggar disebut, sisanya tetap', () => {
    const { accepted, rejected } = acceptDates(['2026-11-02', '2026-11-04', '2026-11-10', '2026-11-16', '2026-11-22'], context(), 4);
    expect(accepted).toEqual(['2026-11-02', '2026-11-10', '2026-11-16', '2026-11-22']);
    expect(rejected).toEqual([{ date: '2026-11-04', block: 'TOO_CLOSE' }]);
  });
  it('lebih dari jatah ditolak sebagai jatah penuh', () => {
    const { accepted, rejected } = acceptDates(['2026-11-02', '2026-11-10'], context(), 1);
    expect(accepted).toEqual(['2026-11-02']);
    expect(rejected).toEqual([{ date: '2026-11-10', block: 'QUOTA' }]);
  });
});

describe('jatah sebanding (GAJ-06)', () => {
  it('masuk 16 Nov pada periode 31 hari: 4 × 10/31 = 1,3 → 1', () => {
    expect(proratedQuota(4, P, '2026-11-16')).toBe(1);
  });
  it('masuk tanggal 11 pada periode 30 hari: 2 hari', () => {
    expect(proratedQuota(4, '2026-11-26', '2026-12-11')).toBe(2);
  });
  it('masuk sebelum periode: jatah penuh; sesudah periode: 0', () => {
    expect(proratedQuota(4, P, '2026-01-01')).toBe(4);
    expect(proratedQuota(4, P, '2026-12-01')).toBe(0);
  });
});

describe('tanda tidak memilih libur (KEH-135, 140)', () => {
  it('orang lama dinilai pada penutupan jendela', () => {
    expect(markDueAfter(P, '2026-01-01', 3, '2026-10-25')).toBe('2026-10-25');
  });
  it('orang baru sesudah jendela tutup: 3 hari pertama tanpa tanda (kejadian 96)', () => {
    expect(newcomerGraceEnds(P, '2026-11-10', 3, '2026-10-25')).toBe('2026-11-12');
    expect(markDueAfter(P, '2026-11-10', 3, '2026-10-25')).toBe('2026-11-12');
  });
});

describe('batas tukar dan pengganti', () => {
  it('H-2 dari tanggal yang lebih dekat (W32)', () => {
    expect(swapAnswerBy('2026-11-12', '2026-11-14', 2)).toBe('2026-11-10');
    expect(swapAnswerBy('2026-11-14', '2026-11-12', 2)).toBe('2026-11-10');
  });
  it('libur pengganti 14 hari (W33)', () => {
    expect(replacementChooseBy('2026-11-08', 14)).toBe('2026-11-22');
  });
});

describe('status hari (KEH-81)', () => {
  it('absen menang, lalu hari tutup, lalu libur terjadwal', () => {
    expect(dayStatus(true, true, true)).toBe('PRESENT');
    expect(dayStatus(false, true, true)).toBe('CLOSED');
    expect(dayStatus(false, false, true)).toBe('DAY_OFF');
    expect(dayStatus(false, false, false)).toBe('UNDETERMINED');
  });
});
