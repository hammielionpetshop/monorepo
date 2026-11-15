import { addDays, type CrewRole, type IsoDate } from './trip';

// Tarif ritase & upah belanja (spec L7 §3.1; DRV-08, 10 s.d. 13; U3, U4). Fungsi murni, dipakai server Logistik dan Gaji.

export type RateNumbers = { driverWithAssistant: number; driverAlone: number; assistant: number };
export type RateRecord = RateNumbers & { id: number; vehicleId: number; routeId: number; effectiveFrom: IsoDate; status: string };
export type RateChange = 'NEW_PAIR' | 'UP_OR_SAME' | 'DOWN';
export type RateState = 'IN_FORCE' | 'SCHEDULED' | 'REPLACED' | 'CANCELLED' | 'FIXED';

export const RATE_STATE_LABELS: Record<RateState, string> = {
  IN_FORCE: 'Berlaku', SCHEDULED: 'Terjadwal', REPLACED: 'Digantikan', CANCELLED: 'Dibatalkan', FIXED: 'Dibetulkan',
};

export const RATE_MAX = 10_000_000;

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export function dayLabel(date: IsoDate): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function rupiah(amount: number): string {
  return `Rp${new Intl.NumberFormat('id-ID').format(amount)}`;
}

/** Tarif pasangan pada tanggal T: baris ACTIVE dengan berlaku dari ≤ T yang paling akhir (DRV-08). */
export function rateOnDate<T extends RateRecord>(rows: readonly T[], vehicleId: number, routeId: number, date: IsoDate): T | null {
  let best: T | null = null;
  for (const row of rows) {
    if (row.status !== 'ACTIVE' || row.vehicleId !== vehicleId || row.routeId !== routeId || row.effectiveFrom > date) continue;
    if (!best || row.effectiveFrom > best.effectiveFrom) best = row;
  }
  return best;
}

/** Angka per peran (DRV-09): driver berkenek / driver tanpa kenek / kenek. */
export function amountFor(rate: RateNumbers, role: CrewRole, withAssistant: boolean): number {
  if (role === 'ASSISTANT') return rate.assistant;
  return withAssistant ? rate.driverWithAssistant : rate.driverAlone;
}

/** Jenis perubahan untuk jarak berlaku (PRI-35; U3): pasangan baru, naik/sama, atau ada angka yang turun. */
export function changeKind(current: RateNumbers | null, next: RateNumbers): RateChange {
  if (!current) return 'NEW_PAIR';
  const down = next.driverWithAssistant < current.driverWithAssistant || next.driverAlone < current.driverAlone || next.assistant < current.assistant;
  return down ? 'DOWN' : 'UP_OR_SAME';
}

/** Tanggal berlaku paling cepat: hari ini (pasangan baru), besok (naik/sama), 7 hari lagi (ada yang turun). Tidak mundur. */
export function earliestFrom(change: RateChange, today: IsoDate): IsoDate {
  return change === 'NEW_PAIR' ? today : addDays(today, change === 'DOWN' ? 7 : 1);
}

export function numbersProblem(n: RateNumbers): string | null {
  for (const [label, value] of [['Driver ada kenek', n.driverWithAssistant], ['Driver tanpa kenek', n.driverAlone], ['Kenek', n.assistant]] as const) {
    if (!Number.isInteger(value) || value < 0) return `${label}: isi rupiah bulat, boleh Rp0, tidak boleh minus.`;
    if (value > RATE_MAX) return `${label}: paling banyak ${rupiah(RATE_MAX)}.`;
  }
  return null;
}

export function sameNumbers(a: RateNumbers, b: RateNumbers): boolean {
  return a.driverWithAssistant === b.driverWithAssistant && a.driverAlone === b.driverAlone && a.assistant === b.assistant;
}

/** Keadaan baris tarif untuk riwayat: Berlaku (yang dipakai hari ini), Terjadwal, Digantikan, Dibatalkan, Dibetulkan. */
export function rateState(row: RateRecord, inForceId: number | null, today: IsoDate): RateState {
  if (row.status === 'CANCELLED') return 'CANCELLED';
  if (row.status === 'FIXED') return 'FIXED';
  if (row.effectiveFrom > today) return 'SCHEDULED';
  return row.id === inForceId ? 'IN_FORCE' : 'REPLACED';
}

export function pairLabel(vehicle: string, route: string): string {
  return `${vehicle} ke ${route}`;
}

/** Pesan baku pasangan belum bertarif (LOG-21, 36). */
export function unratedMessage(pairs: string[], date: IsoDate): string {
  const list = pairs.length > 1 ? `${pairs.slice(0, -1).join(', ')} dan ${pairs[pairs.length - 1]}` : pairs[0];
  return `${list} belum punya tarif pada ${dayLabel(date)}. Minta Pemilik atau GM mengisinya di Pengaturan › Tarif Ritase.`;
}
