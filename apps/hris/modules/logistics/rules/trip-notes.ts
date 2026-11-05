// Surat jalan di trip (spec LT1 §3.3–3.5, LT1b-1). Aturan murni: kunci surat jalan, pembagian kunjungan, ambil barang,
// dan tanda "berubah di kasir".
import type { NoteKind } from './delivery-notes';

export type NoteKey = `S${number}` | `T${number}`;
export type VisitStatus = 'OPEN' | 'DELIVERED' | 'TOMORROW' | 'FAILED' | 'RELEASED';
export type PickupStatus = 'OPEN' | 'DONE' | 'NOT_READY' | 'DROPPED';
export type NoteStatus = 'WAITING' | 'ON_TRIP' | 'DELIVERED' | 'NEEDS_DECISION' | 'CANCELLED';

export const VISIT_LABELS: Record<VisitStatus, string> = {
  OPEN: 'Belum dikunjungi', DELIVERED: 'Terkirim', TOMORROW: 'Kirim besok', FAILED: 'Gagal', RELEASED: 'Dilepas',
};
export const VISIT_TONES: Record<VisitStatus, 'info' | 'ok' | 'warn' | 'danger'> = {
  OPEN: 'info', DELIVERED: 'ok', TOMORROW: 'warn', FAILED: 'danger', RELEASED: 'warn',
};
export const PICKUP_LABELS: Record<PickupStatus, string> = {
  OPEN: 'Belum diambil', DONE: 'Sudah diambil', NOT_READY: 'Belum siap', DROPPED: 'Tidak jadi',
};

/** Kunci surat jalan di layar: S = nota, T = PO Internal, diikuti id dokumen kasir. */
export function noteKey(kind: NoteKind, docId: number): NoteKey {
  return `${kind === 'SALE' ? 'S' : 'T'}${docId}` as NoteKey;
}

export function parseNoteKey(key: string): { kind: NoteKind; docId: number } | null {
  const match = /^([ST])([1-9]\d{0,9})$/.exec(key);
  if (!match) return null;
  return { kind: match[1] === 'S' ? 'SALE' : 'TRANSFER', docId: Number(match[2]) };
}

export type PlannedNote = {
  key: NoteKey; originBranchId: number; origin: string;
  customerId: number | null; destinationBranchId: number | null; destination: string;
};

/** Satu tujuan = satu kunjungan per trip (LOG-10); PO Internal ke cabang = kunjungan ke cabang itu. */
export function planVisits(notes: PlannedNote[]) {
  const visits = new Map<string, { customerId: number | null; destinationBranchId: number | null; destination: string; keys: NoteKey[] }>();
  for (const note of notes) {
    const dest = note.customerId != null ? `C${note.customerId}` : `B${note.destinationBranchId}`;
    const visit = visits.get(dest) ?? { customerId: note.customerId, destinationBranchId: note.destinationBranchId, destination: note.destination, keys: [] };
    visit.keys.push(note.key);
    visits.set(dest, visit);
  }
  return [...visits.values()];
}

/** Langkah ambil barang: satu per cabang asal selain Gudang (spec LT1 §3.4). Gudang belum diketahui = semua cabang asal. */
export function pickupOrigins(notes: { originBranchId: number; origin: string }[], homeBranchId: number | null) {
  const origins = new Map<number, string>();
  for (const note of notes) if (note.originBranchId !== homeBranchId) origins.set(note.originBranchId, note.origin);
  return [...origins.entries()].map(([originBranchId, origin]) => ({ originBranchId, origin }));
}

/** Trip berisi surat jalan wajib punya rute kirim (ritase tetap per trip, spec LT1 §3.4). */
export function tripNotesProblem(routeId: number | null, noteCount: number): string | null {
  return noteCount > 0 && routeId == null ? 'Trip yang membawa surat jalan wajib punya rute kirim.' : null;
}

export const MAX_NOTES_PER_TRIP = 150;

export type KasirChange = { kind: 'cancelled'; pending: boolean } | { kind: 'changed'; from: number; to: number } | null;

/** Nota berubah / dibatalkan di kasir sesudah masuk trip (spec LT1 §3.3). PO Internal hanya bisa batal. */
export function kasirChange(
  atTrip: { amount: number | null; revision: number | null },
  live: { amount: number | null; revision: number | null; status: string },
): KasirChange {
  if (live.status === 'VOIDED' || live.status === 'CANCELLED') return { kind: 'cancelled', pending: false };
  if (live.status === 'PENDING_VOID') return { kind: 'cancelled', pending: true };
  if (atTrip.amount != null && live.amount != null && atTrip.amount !== live.amount) return { kind: 'changed', from: atTrip.amount, to: live.amount };
  if (atTrip.revision != null && live.revision != null && atTrip.revision !== live.revision && atTrip.amount != null && live.amount != null) {
    return { kind: 'changed', from: atTrip.amount, to: live.amount };
  }
  return null;
}

export type KasirChangeKind = 'CHANGED' | 'PENDING_CANCEL' | 'CANCELLED';

/**
 * Keadaan kasir yang perlu diberitahukan (spec LT1 §14.3): jenis + penanda unik. Penanda sama = sudah diberi tahu;
 * diubah lagi di kasir (nominal/revisi lain, atau menunggu batal → batal) = penanda baru, diberi tahu lagi.
 */
export function kasirChangeKey(change: KasirChange, revision: number | null): { kind: KasirChangeKind; signature: string } | null {
  if (!change) return null;
  if (change.kind === 'cancelled') return change.pending ? { kind: 'PENDING_CANCEL', signature: 'PENDING_CANCEL' } : { kind: 'CANCELLED', signature: 'CANCELLED' };
  return { kind: 'CHANGED', signature: `CHANGED:${change.to}:${revision ?? '-'}` };
}

/** Kalimat pemberitahuan / kartu: "TRX-1 berubah Rp 2.000.000 → Rp 1.500.000", "dikoreksi", "dibatalkan di kasir". */
export function kasirChangeText(number: string, change: NonNullable<KasirChange>, money: (n: number) => string): string {
  if (change.kind === 'cancelled') return `${number} ${change.pending ? 'menunggu batal' : 'dibatalkan'} di kasir`;
  if (change.from === change.to) return `${number} dikoreksi di kasir (nominal tetap ${money(change.to)})`;
  return `${number} berubah di kasir ${money(change.from)} → ${money(change.to)}`;
}
