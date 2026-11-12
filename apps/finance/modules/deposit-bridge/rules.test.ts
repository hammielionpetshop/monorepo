import { describe, expect, it } from 'vitest';
import { buildBridge, columnKey, itemsOf, TOTAL_KEY, unexplainedLevel, value, type BridgeItem } from './rules';

const item = (branchId: number | null, line: BridgeItem['line'], amount: number, ref = `${line}:${amount}`): BridgeItem => ({
  branchId, line, amount, date: '2026-11-10', label: ref, ref,
});

describe('jembatan Setoran bebas vs laba', () => {
  // Toko A: nota tunai 1.000.000 (HPP 600.000) + nota kredit 500.000 (HPP 300.000), Pengeluaran Kasir 50.000 (biaya),
  // listrik dibayar Finance 200.000, shift akhir bulan 100.000 belum disetor, shift Oktober 80.000 disetor November,
  // non-tunai 70.000 belum diverifikasi, utang ke Gudang 300.000 dilunasi dari setoran.
  // Laba = 1.500.000 − 900.000 − 50.000 − 200.000 = 350.000.
  // Setoran = 1.000.000 − 50.000 − 100.000 + 80.000 − 70.000 + 20.000 (pelunasan piutang) = 880.000; bebas = 880.000 − 300.000 = 580.000.
  // Gudang: menerima 300.000 lewat rantai, laba 0, tidak berutang → bebas 300.000. Kantor: sewa 1.000.000.
  const items: BridgeItem[] = [
    item(1, 'goods', 900_000),
    item(1, 'settled', -300_000),
    item(1, 'costs-elsewhere', 200_000),
    item(1, 'cashier-costs', 50_000),
    item(1, 'receivables', -500_000),
    item(1, 'receivables', 20_000),
    item(1, 'cashier-expenses', -50_000),
    item(1, 'cash-undeposited', -100_000),
    item(1, 'cash-prior', 80_000),
    item(1, 'noncash-pending', -70_000),
    item(2, 'received', 300_000),
    item(null, 'costs-elsewhere', 1_000_000),
  ];
  const bridge = buildBridge({
    bases: [
      { branchId: 1, name: 'Toko A', net: 350_000, netSales: 1_500_000, free: 580_000 },
      { branchId: 2, name: 'Gudang', net: 0, netSales: 0, free: 300_000 },
    ],
    items,
    officeNet: -1_000_000,
    totalNetSales: 1_500_000,
  });

  it('jumlah baris + selisih sama persis dengan setoran bebas; contoh lengkap → selisih nol', () => {
    for (const c of bridge.columns) {
      const sum = bridge.lines.reduce((s, l) => s + value(l.values, c.key), value(bridge.net, c.key));
      expect(sum + value(bridge.unexplained, c.key)).toBe(value(bridge.free, c.key));
    }
    expect(Math.abs(value(bridge.unexplained, columnKey(1)))).toBe(0);
    expect(value(bridge.unexplained, columnKey(2))).toBe(0);
  });

  it('Gabungan = Σ cabang; biaya Kantor masuk baris B dan laba Kantor ikut Laba bersih', () => {
    expect(value(bridge.net, TOTAL_KEY)).toBe(-650_000);
    expect(value(bridge.free, TOTAL_KEY)).toBe(880_000);
    expect(value(bridge.lines.find((l) => l.key === 'costs-elsewhere')!.values, TOTAL_KEY)).toBe(1_200_000);
    expect(value(bridge.unexplained, TOTAL_KEY)).toBe(0);
    expect(bridge.columns.map((c) => c.name)).toEqual(['Toko A', 'Gudang', 'Gabungan']);
  });

  it('baris nol di semua kolom disembunyikan; rincian per kolom', () => {
    expect(bridge.lines.some((l) => l.key === 'legacy')).toBe(false);
    expect(itemsOf(items, 'receivables', columnKey(1)).map((i) => i.amount)).toEqual([-500_000, 20_000]);
    expect(itemsOf(items, 'costs-elsewhere', TOTAL_KEY)).toHaveLength(2);
    expect(itemsOf(items, 'costs-elsewhere', columnKey(2))).toHaveLength(0);
  });

  it('beda bulan tunai dan pelunasan susulan menjelaskan setoran tanpa laba', () => {
    const b = buildBridge({
      bases: [{ branchId: 3, name: 'Toko B', net: 0, netSales: 0, free: 450_000 }],
      items: [item(3, 'cash-prior', 150_000), item(3, 'legacy', 300_000)],
      officeNet: 0,
      totalNetSales: 0,
    });
    expect(value(b.unexplained, columnKey(3))).toBe(0);
  });

  it('selisih yang tidak dijelaskan tampil apa adanya', () => {
    const b = buildBridge({
      bases: [{ branchId: 4, name: 'Toko C', net: 100_000, netSales: 2_000_000, free: 40_000 }],
      items: [],
      officeNet: 0,
      totalNetSales: 2_000_000,
    });
    expect(value(b.unexplained, columnKey(4))).toBe(-60_000);
    expect(b.levels[columnKey(4)]).toBe('ok');
  });
});

describe('warna Selisih belum terjelaskan (§0 butir 4)', () => {
  it('≤ Rp100.000 selalu biasa', () => {
    expect(unexplainedLevel(100_000, 1_000_000)).toBe('ok');
    expect(unexplainedLevel(-100_000, 0)).toBe('ok');
  });
  it('kuning > Rp100.000 dan > 1% penjualan bersih; merah > 5%', () => {
    expect(unexplainedLevel(150_000, 20_000_000)).toBe('ok'); // 0,75%
    expect(unexplainedLevel(-250_000, 20_000_000)).toBe('yellow'); // 1,25%
    expect(unexplainedLevel(1_000_000, 20_000_000)).toBe('yellow'); // tepat 5%
    expect(unexplainedLevel(1_000_001, 20_000_000)).toBe('red');
    expect(unexplainedLevel(200_000, 0)).toBe('red');
  });
});
