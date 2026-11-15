/** Aturan murni Logistik Minimal (spec L6 §3). Tanggal = YYYY-MM-DD WIB. Tanpa DB, tanpa React. */

export type IsoDate = string;
export type TripStatus = 'DRAFT' | 'RUNNING' | 'DONE' | 'CANCELLED';
export type CrewRole = 'DRIVER' | 'ASSISTANT';
export type RouteKind = 'DELIVERY' | 'SHOPPING';
export type WageKind = 'RITASE' | 'SHOPPING';

export const STATUS_LABELS: Record<TripStatus, string> = { DRAFT: 'Draft', RUNNING: 'Berjalan', DONE: 'Selesai', CANCELLED: 'Dibatalkan' };
export const STATUS_TONES: Record<TripStatus, 'info' | 'ok' | 'warn' | 'danger'> = { DRAFT: 'info', RUNNING: 'warn', DONE: 'ok', CANCELLED: 'danger' };
export const ROLE_LABELS: Record<CrewRole, string> = { DRIVER: 'Driver', ASSISTANT: 'Kenek' };
export const ROUTE_KIND_LABELS: Record<RouteKind, string> = { DELIVERY: 'Kirim', SHOPPING: 'Belanja supplier' };
export const WAGE_KIND_LABELS: Record<WageKind, string> = { RITASE: 'Ritase', SHOPPING: 'Belanja' };

export const REASON_MIN = 5;

const WIB_OFFSET_MS = 7 * 3_600_000;

export function wibDate(at: Date): IsoDate {
  return new Date(at.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** HH.MM WIB. */
export function wibClock(at: Date): string {
  return new Date(at.getTime() + WIB_OFFSET_MS).toISOString().slice(11, 16).replace(':', '.');
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Minggu upah Jumat–Kamis (DRV-19): Jumat awal minggu yang memuat tanggal ini. */
export function fridayOf(date: IsoDate): IsoDate {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 Minggu … 5 Jumat
  return addDays(date, -((day + 2) % 7));
}

/** TR-YYMMDD-n (tanggal dibuat WIB, urut per tanggal). */
export function tripNumber(date: IsoDate, sequence: number): string {
  return `TR-${date.slice(2, 4)}${date.slice(5, 7)}${date.slice(8, 10)}-${sequence}`;
}

/** Plat disimpan huruf besar dengan satu spasi antar bagian (plat unik, LOG-94). */
export function normalizePlate(plate: string): string {
  return plate.trim().toUpperCase().replace(/\s+/g, ' ');
}

export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export type Duty = { drive: boolean; assist: boolean };

/**
 * Awak sah (LOG-15, KAR-05): satu driver yang boleh menyetir, kenek yang boleh jadi kenek, tidak ada orang ganda.
 * `duty(id)` = izin per orang ATAU izin otomatis jabatannya; null = orang tidak aktif / tidak dikenal.
 */
export function crewProblem(driverId: number | null, assistantIds: number[], duty: (id: number) => Duty | null, name: (id: number) => string): string | null {
  if (!driverId) return 'Pilih driver.';
  const people = [driverId, ...assistantIds];
  if (new Set(people).size !== people.length) return 'Satu orang tidak boleh dipilih dua kali (driver dan kenek harus orang berbeda).';
  const driver = duty(driverId);
  if (!driver) return `${name(driverId)} tidak aktif.`;
  if (!driver.drive) return `${name(driverId)} tidak punya izin menyetir.`;
  for (const id of assistantIds) {
    const assistant = duty(id);
    if (!assistant) return `${name(id)} tidak aktif.`;
    if (!assistant.assist) return `${name(id)} tidak punya izin jadi kenek.`;
  }
  return null;
}

/** Trip berisi rute kirim, atau minimal satu supplier belanja (LOG-21, 34). */
export function contentProblem(routeId: number | null, shoppingRouteIds: number[]): string | null {
  if (new Set(shoppingRouteIds).size !== shoppingRouteIds.length) return 'Satu supplier hanya sekali per trip.';
  if (!routeId && !shoppingRouteIds.length) return 'Isi rute kirim atau pilih minimal satu supplier belanja.';
  return null;
}

export type WageDraft = {
  employeeId: number; role: CrewRole; kind: WageKind; shoppingId: number | null; routeId: number; withAssistant: boolean;
};

/**
 * Ritase dan belanja yang lahir saat trip Selesai (LOG-33, 34, 101; spec L6 §3.7): untuk awak yang masih tercatat,
 * satu ritase bila trip punya rute kirim, dan satu belanja per supplier yang Selesai. Berkenek = ada kenek tercatat.
 */
export function wagesFor(input: {
  routeId: number | null;
  crew: { employeeId: number; role: CrewRole }[];
  shoppingDone: { id: number; routeId: number }[];
}): WageDraft[] {
  const withAssistant = input.crew.some((c) => c.role === 'ASSISTANT');
  const rows: WageDraft[] = [];
  for (const person of input.crew) {
    if (input.routeId) rows.push({ employeeId: person.employeeId, role: person.role, kind: 'RITASE', shoppingId: null, routeId: input.routeId, withAssistant });
    for (const task of input.shoppingDone) {
      rows.push({ employeeId: person.employeeId, role: person.role, kind: 'SHOPPING', shoppingId: task.id, routeId: task.routeId, withAssistant });
    }
  }
  return rows;
}

/** Jarak dua titik dalam meter (haversine), dibulatkan. */
export function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6_371_000 * Math.asin(Math.sqrt(h)));
}

export function validPoint(latitude: unknown, longitude: unknown): boolean {
  return typeof latitude === 'number' && typeof longitude === 'number' && Number.isFinite(latitude) && Number.isFinite(longitude)
    && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 && !(latitude === 0 && longitude === 0);
}

export type GarageCheck =
  | { ok: true; distanceM: number | null; fenceOff: boolean }
  | { ok: false; error: string };

/**
 * Sampai Garasi wajib di titik cabang garasi (LOG-29); pagar uji yang menyala melewatkan pemeriksaan titik saja (LOG-104).
 */
export function garageCheck(input: {
  point: { latitude: number; longitude: number } | null;
  garage: { latitude: number; longitude: number; radiusM: number; name: string } | null;
  fenceOff: boolean;
}): GarageCheck {
  const distanceM = input.point && input.garage ? distanceMeters(input.point, input.garage) : null;
  if (input.fenceOff) return { ok: true, distanceM, fenceOff: true };
  if (!input.garage) return { ok: false, error: 'Titik garasi belum diatur. Hubungi Kepala Gudang atau Pemilik.' };
  if (!input.point) return { ok: false, error: 'Nyalakan lokasi lalu coba lagi. HP bermasalah? Minta Kepala Gudang menutup trip atas nama driver.' };
  if (distanceM! > input.garage.radiusM) {
    return { ok: false, error: `Anda ${distanceM} m dari ${input.garage.name} (batas ${input.garage.radiusM} m). Sampai Garasi hanya di titik ${input.garage.name}.` };
  }
  return { ok: true, distanceM, fenceOff: false };
}

/** Trip Berjalan menggantung bila belum Selesai sampai jam batas hari sesudah tanggal trip (LOG-31). */
export function isHanging(tripDate: IsoDate | null, now: Date, hour: number): boolean {
  if (!tripDate) return false;
  const limit = new Date(`${addDays(tripDate, 1)}T${String(hour).padStart(2, '0')}:00:00+07:00`);
  return now.getTime() >= limit.getTime();
}

/** Ritase tangan (LOG-102): paling jauh `days` hari ke belakang, tidak untuk tanggal depan. */
export function manualDateProblem(date: IsoDate, today: IsoDate, days: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Tanggal tidak valid.';
  if (date > today) return 'Ritase tangan tidak untuk tanggal yang belum lewat.';
  if (date < addDays(today, -days)) return `Ritase tangan paling jauh ${days} hari ke belakang.`;
  return null;
}

export function reasonProblem(reason: string | null | undefined): string | null {
  return !reason || reason.trim().length < REASON_MIN ? `Alasan paling sedikit ${REASON_MIN} huruf.` : null;
}
