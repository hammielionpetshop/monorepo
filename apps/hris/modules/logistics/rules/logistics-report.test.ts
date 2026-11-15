import { describe, expect, it } from 'vitest';
import {
  MIXED_BRANCH, addMonths, branchTable, crewTable, periodChoices, reportCsv, reportRange, summaryTable, tripTable, vehicleTable, visitMoney,
  type ReportFacts, type VisitFact,
} from './logistics-report';

const ALL = { fuel: true, shortage: true };
const MARKETING = { fuel: false, shortage: false };

function visit(over: Partial<VisitFact> = {}): VisitFact {
  return {
    source: 'TRUCK', tripKey: 'T1', customerId: 10, destination: 'Toko A', outcome: 'DELIVERED',
    notes: [{ branch: 'Gudang', kind: 'SALE' }], method: 'CASH', received: 1_000_000, checks: [], notOk: false, ...over,
  };
}

function facts(over: Partial<ReportFacts> = {}): ReportFacts {
  return {
    trips: [{ source: 'TRUCK', key: 'T1', number: 'TR-1', date: '2026-11-03', vehicleId: 1, vehicle: 'Engkel (B 1)', route: 'Barat', branch: null,
      crew: [{ employeeId: 7, role: 'DRIVER' }, { employeeId: 8, role: 'ASSISTANT' }] }],
    visits: [visit()], wages: [], fuel: [], reports: [], vehicleAttention: [],
    vehicles: new Map([[1, 'Engkel (B 1)']]), customers: new Map([[10, 'Toko A']]), people: new Map([[7, 'Budi'], [8, 'Agus']]),
    ...over,
  };
}

describe('rentang Laporan Logistik', () => {
  it('bawaan = periode 26–25 berjalan', () => {
    const r = reportRange({}, '2026-11-06');
    expect(r.ok && r.range).toMatchObject({ from: '2026-10-26', to: '2026-11-25', free: false });
  });
  it('tanggal bebas paling panjang 3 bulan', () => {
    expect(reportRange({ dari: '2026-08-01', sampai: '2026-10-31' }, '2026-11-06').ok).toBe(true);
    const tooLong = reportRange({ dari: '2026-08-01', sampai: '2026-11-01' }, '2026-11-06');
    expect(tooLong.ok).toBe(false);
    expect(reportRange({ dari: '2026-11-05', sampai: '2026-11-01' }, '2026-11-06').ok).toBe(false);
    expect(reportRange({ dari: '2026-02-30', sampai: '2026-03-01' }, '2026-11-06').ok).toBe(false);
  });
  it('tambah bulan menjaga akhir bulan', () => {
    expect(addMonths('2026-11-30', 3)).toBe('2027-02-28');
    expect(addMonths('2026-12-26', 1)).toBe('2027-01-26');
  });
  it('pilihan periode mundur berurutan', () => {
    const p = periodChoices('2026-11-06', 3).map((x) => x.from);
    expect(p).toEqual(['2026-10-26', '2026-09-26', '2026-08-26']);
  });
});

describe('uang per kunjungan', () => {
  it('belum diperiksa = semua yang dilaporkan', () => {
    expect(visitMoney(visit())).toMatchObject({ cash: 1_000_000, uncheckedCash: 1_000_000, checkedReported: 0, shortage: 0 });
  });
  it('sudah diperiksa terpisah, kurang serah atas nama pembawa', () => {
    const m = visitMoney(visit({ checks: [{ kind: 'CASH', reported: 1_000_000, actual: 950_000, responsibleEmployeeId: 7 }] }));
    expect(m).toMatchObject({ checkedReported: 1_000_000, checkedActual: 950_000, uncheckedCash: 0, shortage: 50_000 });
  });
  it('Tempo tanpa uang; transfer dipisah dari tunai', () => {
    expect(visitMoney(visit({ method: 'TEMPO', received: 0 }))).toMatchObject({ cash: 0, transfer: 0 });
    expect(visitMoney(visit({ method: 'TRANSFER', received: 500_000 }))).toMatchObject({ cash: 0, transfer: 500_000, uncheckedTransfer: 500_000 });
  });
});

describe('tab laporan', () => {
  it('Marketing tanpa bensin dan kurang serah', () => {
    const f = facts({ fuel: [{ vehicleId: 1, vehicle: 'Engkel (B 1)', driverEmployeeId: 7, amount: 200_000, withRequest: false }] });
    const labels = summaryTable(f, MARKETING).rows.map((r) => r.label);
    expect(labels.some((l) => String(l).startsWith('Bensin'))).toBe(false);
    expect(labels.some((l) => String(l).startsWith('Kurang serah'))).toBe(false);
    expect(vehicleTable(f, MARKETING).columns.map((c) => c.key)).not.toContain('fuelAmount');
    expect(crewTable(f, MARKETING).columns.map((c) => c.key)).not.toContain('shortage');
    expect(crewTable(f, ALL).rows.find((r) => r.name === 'Budi')?.forgotFuel).toBe(1);
  });
  it('kunjungan beberapa cabang masuk baris Campuran', () => {
    const f = facts({ visits: [visit({ notes: [{ branch: 'Gudang', kind: 'SALE' }, { branch: 'Toko Pusat', kind: 'SALE' }] })] });
    const rows = branchTable(f, ALL).rows;
    expect(rows.find((r) => r.name === MIXED_BRANCH)?.cash).toBe(1_000_000);
    expect(rows.find((r) => r.name === 'Gudang')).toMatchObject({ notesDelivered: 1, cash: 0 });
  });
  it('per trip: awak, nota, ritase', () => {
    const f = facts({ wages: [{ tripKey: 'T1', employeeId: 7, role: 'DRIVER', kind: 'RITASE', vehicleId: 1 }, { tripKey: 'T1', employeeId: 8, role: 'ASSISTANT', kind: 'RITASE', vehicleId: 1 }] });
    expect(tripTable(f, ALL).rows[0]).toMatchObject({ driver: 'Budi', assistant: 'Agus', notesDelivered: 1, ritase: 1, cash: 1_000_000 });
  });
  it('CSV titik koma dengan judul dan baris kolom', () => {
    const csv = reportCsv(tripTable(facts(), ALL), { title: 'Laporan Logistik', range: '1–2 Nov', madeBy: 'Ani', madeAt: '2026-11-06 10.00 WIB' });
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe('Laporan Logistik;1–2 Nov;dibuat Ani;2026-11-06 10.00 WIB');
    expect(lines[1].split(';')[0]).toBe('Jenis');
    expect(lines[2]).toContain('TR-1');
  });
});
