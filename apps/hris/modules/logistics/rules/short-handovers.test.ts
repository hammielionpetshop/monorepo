import { describe, expect, it } from 'vitest';
import { cleanShares, splitEvenly, summarizeShort } from './short-handovers';

describe('B3 kurang serah: sisa dan tanda', () => {
  it('belum ada tindak lanjut = Belum ditindaklanjuti, sisa penuh', () => {
    expect(summarizeShort(20000, [], [])).toMatchObject({ left: 20000, state: 'OPEN' });
  });

  it('ganti tunai sebagian + Potongan Lain menunggu menutup sisa → Menunggu pengesahan', () => {
    const s = summarizeShort(20000, [{ status: 'PENDING', amount: 15000 }], [{ kind: 'CASH_REPLACED', amount: 5000 }]);
    expect(s).toMatchObject({ replaced: 5000, pending: 15000, left: 0, state: 'PENDING' });
  });

  it('Ditolak / Dibatalkan tidak dihitung, jadi bisa diajukan ulang; ditiadakan lewat keberatan dihitung selesai', () => {
    expect(summarizeShort(20000, [{ status: 'REJECTED', amount: 20000 }, { status: 'CANCELLED', amount: 5000 }], [])).toMatchObject({ left: 20000, state: 'OPEN' });
    expect(summarizeShort(20000, [{ status: 'ACTIVE', amount: 12000 }, { status: 'WAIVED', amount: 8000 }], [])).toMatchObject({ left: 0, state: 'DONE' });
  });

  it('Tidak dipotong menutup sisa', () => {
    expect(summarizeShort(20000, [{ status: 'ACTIVE', amount: 5000 }], [{ kind: 'WAIVED', amount: null }])).toMatchObject({ left: 0, state: 'WAIVED' });
  });
});

describe('B3 pembagian driver/kenek', () => {
  const crew = [11, 12];
  it('jumlah boleh diturunkan, tidak melebihi sisa', () => {
    expect(cleanShares([{ employeeId: 11, amount: 15000 }], crew, 20000)).toMatchObject({ ok: true, total: 15000 });
    expect(cleanShares([{ employeeId: 11, amount: 15000 }, { employeeId: 12, amount: 6000 }], crew, 20000)).toMatchObject({ ok: false });
  });

  it('hanya awak, tanpa ganda, rupiah bulat > 0', () => {
    expect(cleanShares([{ employeeId: 99, amount: 1000 }], crew, 20000)).toMatchObject({ ok: false });
    expect(cleanShares([{ employeeId: 11, amount: 1000 }, { employeeId: 11, amount: 1000 }], crew, 20000)).toMatchObject({ ok: false });
    expect(cleanShares([{ employeeId: 11, amount: 0 }], crew, 20000)).toMatchObject({ ok: false });
    expect(cleanShares([{ employeeId: 11, amount: 10.5 }], crew, 20000)).toMatchObject({ ok: false });
    expect(cleanShares([], crew, 20000)).toMatchObject({ ok: false });
    expect(cleanShares([{ employeeId: 11, amount: 1000 }], crew, 0)).toMatchObject({ ok: false });
  });

  it('bagi rata: sisa pembulatan ke pembawa uang', () => {
    expect(splitEvenly(20001, 2)).toEqual([10001, 10000]);
    expect(splitEvenly(20000, 1)).toEqual([20000]);
  });
});
