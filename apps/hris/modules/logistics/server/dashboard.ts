import { can, type Actor } from '@/modules/access';
import { rupiah } from '../rules/rates';
import { wibClock, wibDate } from '../rules/trip';
import { activeFence, peopleNames } from './data';
import { countFollowup } from './driver-trip';
import { fuelPeriodSummary } from './fuel';
import { countKasirChanges } from './kasir-changes';
import { countMoneyChecks, shortHandoverSummary } from './money-checks';
import { outsideWaitingCounts } from './outside-points';
import { countPendingPoints } from './store-points';
import { countOpenReports, countUnrecorded } from './store-payments';
import { countPendingNotes, countReturnedGoodsWaiting } from './returned-goods';
import { runningTripsBoard } from './screens';
import { countSelfCashWaitingAll } from './self-delivery';
import { countSelfAttention, runningSelfTrips } from './self-delivery-office';

// Dashboard Logistik (spec LT1 §17.1 butir 7, 8; LOG-80, 140, 141): hanya membaca angka dari fungsi hitung modul pemiliknya,
// tanpa tombol pengubah. Tiap baris punya tautan Buka ke layar pemiliknya.

export type BoardRow = { key: string; label: string; value: string; detail?: string; href: string; tone?: 'danger' | 'warn' | 'ok' };
export type BoardSection = { key: 'RUNNING' | 'DELIVERY' | 'MONEY' | 'FLEET'; title: string; rows: BoardRow[] };

const DASHBOARD = 'logistics.dashboard.view';
const MONEY_FULL = ['logistics.money_check.do', 'logistics.store_payment.view'] as const;
const FLEET = ['logistics.vehicle_followup.manage', 'logistics.fuel.record'] as const;

/** Bagian yang terlihat untuk orang ini (butir 8). */
export function dashboardParts(actor: Actor | null) {
  if (!actor) return null;
  const base = can(actor, DASHBOARD);
  const moneyFull = MONEY_FULL.some((a) => can(actor, a));
  const fleet = FLEET.some((a) => can(actor, a));
  if (!base && !moneyFull && !fleet) return null;
  return { running: base, delivery: base, money: base || moneyFull, shortHandover: moneyFull, fleet };
}

const n = (value: number) => String(value);

export async function logisticsDashboard(actor: Actor | null): Promise<{ sections: BoardSection[]; readAt: string } | null> {
  const parts = dashboardParts(actor);
  if (!actor || !parts) return null;
  const now = new Date();
  const sections: BoardSection[] = [];

  if (parts.running) {
    const [trips, selfTrips, names] = await Promise.all([runningTripsBoard(), runningSelfTrips(), peopleNames()]);
    const rows: BoardRow[] = trips.map((t) => ({
      key: `trip-${t.id}`, label: `Trip ${t.number}`, value: t.phase === 'HEADING_HOME' ? 'Menuju Garasi' : 'Berjalan',
      detail: `${t.vehicle}${t.route ? `, ${t.route}` : ''} · ${t.crew.filter((c) => !c.removed).map((c) => c.name).join(', ')}`,
      href: `/logistik/trip/${t.id}`, tone: t.hanging ? 'danger' : undefined,
    }));
    for (const s of selfTrips) {
      rows.push({
        key: `self-${s.id}`, label: `Antar sendiri ${s.number}`, value: `sejak ${wibClock(s.startedAt)}`,
        detail: `${s.branch} · ${names.get(s.employeeId) ?? '-'}`, href: '/logistik/antar-sendiri/kantor', tone: wibDate(s.startedAt) < wibDate(now) ? 'danger' : undefined,
      });
    }
    sections.push({ key: 'RUNNING', title: 'Berjalan sekarang', rows });
  }

  if (parts.delivery) {
    const [follow, pending, kasir, self, goods, reports, unrecorded, points, outside] = await Promise.all([
      countFollowup(), countPendingNotes(), countKasirChanges(),
      countSelfAttention(null), countReturnedGoodsWaiting(), countOpenReports(), countUnrecorded(), countPendingPoints(),
      outsideWaitingCounts(),
    ]);
    const rows: BoardRow[] = [];
    const add = (row: BoardRow, count: number) => { if (count) rows.push(row); };
    add({ key: 'decide', label: 'Surat jalan perlu keputusan', value: n(follow?.decide ?? 0), detail: 'Kiriman Gagal: Kirim ulang atau Batal', href: '/logistik/surat-jalan?tab=NEEDS_DECISION', tone: 'danger' }, follow?.decide ?? 0);
    add({ key: 'pending', label: 'Surat jalan tertunda', value: n(pending.total), detail: pending.red ? `${pending.red} lebih dari 3 hari` : undefined, href: '/logistik/surat-jalan/tertunda', tone: pending.red ? 'danger' : 'warn' }, pending.total);
    add({ key: 'kasir', label: 'Nota berubah di kasir', value: n(kasir?.count ?? 0), detail: 'Sudah di trip: Lepas atau Tetap antar', href: kasir?.tripId ? `/logistik/trip/${kasir.tripId}` : '/logistik/surat-jalan?tab=ON_TRIP', tone: 'danger' }, kasir?.count ?? 0);
    add({ key: 'self-late', label: 'Antar sendiri belum kembali', value: n(self?.late ?? 0), detail: 'Lewat 23.59 hari mulainya', href: '/logistik/antar-sendiri/kantor?tab=LATE', tone: 'danger' }, self?.late ?? 0);
    add({ key: 'self-failed', label: 'Antar sendiri Gagal perlu keputusan', value: n(self?.failed ?? 0), href: '/logistik/antar-sendiri/kantor?tab=FAILED', tone: 'danger' }, self?.failed ?? 0);
    add({ key: 'goods', label: 'Barang kembali belum diterima', value: n(goods), href: '/logistik/barang-kembali', tone: 'warn' }, goods);
    add({ key: 'reports', label: 'Laporan toko belum diputuskan', value: n(reports), href: '/logistik/laporan-toko', tone: 'warn' }, reports);
    add({ key: 'unrecorded', label: 'Potong nota / retur belum dicatat di kasir', value: n(unrecorded.waiting), detail: unrecorded.red ? `${unrecorded.red} lebih dari 3 hari` : undefined, href: '/logistik/catat-kasir', tone: unrecorded.red ? 'danger' : 'warn' }, unrecorded.waiting);
    add({ key: 'points', label: 'Titik toko menunggu persetujuan', value: n(points), href: '/logistik/toko?tab=titik' }, points);
    add({ key: 'outside', label: 'Kiriman di luar titik belum ditinjau', value: n(outside.waiting), detail: outside.red ? `${outside.red} lebih dari 3 hari` : undefined, href: '/logistik/di-luar-titik', tone: outside.red ? 'danger' : 'warn' }, outside.waiting);
    sections.push({ key: 'DELIVERY', title: 'Pengiriman', rows });
  }

  if (parts.money) {
    const [money, selfCash, self, short] = await Promise.all([
      countMoneyChecks(), countSelfCashWaitingAll(), countSelfAttention(null),
      parts.shortHandover ? shortHandoverSummary() : Promise.resolve(null),
    ]);
    const rows: BoardRow[] = [];
    if (money.waiting) rows.push({ key: 'money', label: 'Uang toko belum diperiksa', value: n(money.waiting), detail: `Menurut laporan awak${money.red ? ` · ${money.red} lebih dari 3 hari` : ''}`, href: '/logistik/terima-uang', tone: money.red ? 'danger' : 'warn' });
    if (money.posRed) rows.push({ key: 'money-pos', label: 'Nota belum masuk POS', value: n(money.posRed), detail: 'Sudah diperiksa lebih dari 3 hari', href: '/logistik/terima-uang?tab=DONE', tone: 'danger' });
    if (selfCash) rows.push({ key: 'self-cash', label: 'Tunai antar sendiri belum diterima laci', value: n(selfCash), detail: self?.cashLate ? `${self.cashLate} lewat hari` : undefined, href: '/logistik/antar-sendiri/kantor?tab=CASH', tone: self?.cashLate ? 'danger' : 'warn' });
    if (short?.count) rows.push({ key: 'short', label: 'Kurang serah 30 hari', value: rupiah(short.total), detail: `${short.count} nota, bahan Potongan Lain HR`, href: '/logistik/terima-uang?tab=DIFF', tone: 'warn' });
    sections.push({ key: 'MONEY', title: 'Uang', rows });
  }

  if (parts.fleet) {
    const [follow, fuel, fence] = await Promise.all([countFollowup(), fuelPeriodSummary(), activeFence(now)]);
    const rows: BoardRow[] = [];
    if (follow?.fuel) rows.push({ key: 'fuel', label: 'Permintaan bensin menunggu', value: n(follow.fuel), detail: 'Finance isi nominal + foto struk', href: '/logistik/bensin-mobil', tone: 'warn' });
    if (follow?.condition) rows.push({ key: 'condition', label: 'Mobil perlu perhatian', value: n(follow.condition), href: '/logistik/bensin-mobil', tone: 'danger' });
    rows.push({
      key: 'fuel-period', label: `Bensin ${fuel.from} s.d. ${fuel.to}`, value: rupiah(fuel.total),
      detail: `${fuel.count} kali isi${fuel.noRequest ? ` · ${fuel.noRequest} tanpa permintaan` : ''}`, href: '/logistik/bensin-mobil',
    });
    if (fence) rows.push({ key: 'fence', label: 'Pemeriksaan titik garasi sedang mati', value: `s.d. ${wibClock(fence.untilAt)}`, href: '/logistik/mobil-rute', tone: 'danger' });
    sections.push({ key: 'FLEET', title: 'Mobil & bensin', rows });
  }

  return { sections, readAt: wibClock(now) };
}
