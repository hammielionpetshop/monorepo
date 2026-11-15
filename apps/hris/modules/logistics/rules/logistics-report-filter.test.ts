import { describe, expect, it } from 'vitest';
import { cleanReportFilter, filterChoices, filterFacts, type ReportFacts } from './logistics-report';

// Saringan cabang / mobil Laporan Logistik (butir C).
const facts = (): ReportFacts => ({
  trips: [
    { source: 'TRUCK', key: 'T1', number: 'TR-1', date: '2026-11-06', vehicleId: 1, vehicle: 'L300', route: 'Garut', branch: null, crew: [] },
    { source: 'TRUCK', key: 'T2', number: 'TR-2', date: '2026-11-06', vehicleId: 2, vehicle: 'Engkel', route: 'Garut', branch: null, crew: [] },
    { source: 'SELF', key: 'S1', number: 'AS-1', date: '2026-11-06', vehicleId: null, vehicle: null, route: null, branch: 'Toko Pusat', crew: [] },
  ],
  visits: [
    { source: 'TRUCK', tripKey: 'T1', customerId: 1, destination: 'A', outcome: 'DELIVERED', notes: [{ branch: 'Gudang', kind: 'SALE' }], method: null, received: 0, checks: [], notOk: false },
    { source: 'TRUCK', tripKey: 'T2', customerId: 2, destination: 'B', outcome: 'DELIVERED', notes: [{ branch: 'Toko Pusat', kind: 'SALE' }], method: null, received: 0, checks: [], notOk: false },
    { source: 'SELF', tripKey: 'S1', customerId: 3, destination: 'C', outcome: 'DELIVERED', notes: [{ branch: 'Toko Pusat', kind: 'SALE' }], method: null, received: 0, checks: [], notOk: false },
  ],
  wages: [
    { tripKey: 'T1', employeeId: 1, role: 'DRIVER', kind: 'RITASE', vehicleId: 1 },
    { tripKey: null, employeeId: 1, role: 'DRIVER', kind: 'RITASE', vehicleId: 2 },
  ],
  fuel: [{ vehicleId: 1, vehicle: 'L300', driverEmployeeId: 1, amount: 100000, withRequest: true }],
  reports: [{ tripKey: 'T2', customerId: 2, destination: 'B', isReturn: true }],
  vehicleAttention: [{ vehicleId: 2 }],
  vehicles: new Map([[1, 'L300'], [2, 'Engkel']]), customers: new Map(), people: new Map(),
}) as ReportFacts;

describe('saringan Laporan Logistik', () => {
  it('membaca query: mobil angka positif, cabang dipangkas', () => {
    expect(cleanReportFilter({ mobil: '2', cabang: ' Toko Pusat ' })).toEqual({ vehicleId: 2, branch: 'Toko Pusat' });
    expect(cleanReportFilter({ mobil: 'x' })).toEqual({ vehicleId: null, branch: null });
  });
  it('pilihan dari fakta', () => {
    expect(filterChoices(facts())).toEqual({ vehicles: [{ id: 2, label: 'Engkel' }, { id: 1, label: 'L300' }], branches: ['Gudang', 'Toko Pusat'] });
  });
  it('mobil: trip mobil itu + upah (termasuk ritase tangan), bensin, keadaan; antar sendiri gugur', () => {
    const f = filterFacts(facts(), { vehicleId: 2, branch: null });
    expect(f.trips.map((t) => t.key)).toEqual(['T2']);
    expect(f.visits.map((v) => v.tripKey)).toEqual(['T2']);
    expect(f.wages).toHaveLength(1);
    expect(f.fuel).toHaveLength(0);
    expect(f.vehicleAttention).toHaveLength(1);
    expect(f.reports).toHaveLength(1);
  });
  it('cabang: kunjungan bernota cabang itu (truk dan antar sendiri); bensin tidak disaring', () => {
    const f = filterFacts(facts(), { vehicleId: null, branch: 'Toko Pusat' });
    expect(f.trips.map((t) => t.key)).toEqual(['T2', 'S1']);
    expect(f.visits.map((v) => v.destination)).toEqual(['B', 'C']);
    expect(f.wages).toHaveLength(0);
    expect(f.fuel).toHaveLength(1);
  });
});
