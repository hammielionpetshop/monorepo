/**
 * Status pengajuan, sama untuk semua jenis (PRI-37 butir 1). Daftar perpindahan sah harus sama dengan trigger
 * `hris.guard_request_update` di migrasi 0005 (dites).
 */
export const REQUEST_STATUSES = ['PENDING', 'REVIEWED', 'APPROVED', 'REJECTED', 'CANCELLED', 'REVOKED', 'EXPIRED'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const STATUS_LABELS: Record<RequestStatus, string> = {
  PENDING: 'Menunggu',
  REVIEWED: 'Diperiksa',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  CANCELLED: 'Dibatalkan',
  REVOKED: 'Dicabut',
  EXPIRED: 'Hangus',
};

export const STATUS_TONES: Record<RequestStatus, 'info' | 'ok' | 'warn' | 'danger'> = {
  PENDING: 'warn',
  REVIEWED: 'warn',
  APPROVED: 'ok',
  REJECTED: 'danger',
  CANCELLED: 'info',
  REVOKED: 'danger',
  EXPIRED: 'info',
};

export const TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  PENDING: ['REVIEWED', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED'],
  REVIEWED: ['APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED'],
  APPROVED: ['REVOKED', 'CANCELLED'],
  REJECTED: [],
  CANCELLED: [],
  REVOKED: [],
  EXPIRED: [],
};

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Masih menunggu keputusan atau pemeriksaan. */
export function isOpen(status: RequestStatus): boolean {
  return status === 'PENDING' || status === 'REVIEWED';
}

export type DecisionParties = {
  actorAccountId: number;
  actorPersonId: number;
  submittedByAccountId: number;
  submittedByEmployeeId: number;
  subjectEmployeeId: number;
};

/**
 * Batas keras KAR-72 butir 2: tidak ada yang memutuskan pengajuan miliknya sendiri, baik sebagai pengaju
 * maupun sebagai orang yang diajukan. Berlaku juga untuk Pemilik/GM (diputuskan Pemilik/GM yang lain).
 */
export function isOwnRequest(parties: DecisionParties): boolean {
  return parties.actorAccountId === parties.submittedByAccountId
    || parties.actorPersonId === parties.submittedByEmployeeId
    || parties.actorPersonId === parties.subjectEmployeeId;
}

/** Lama menunggu dalam hari penuh (24 jam) sejak diajukan. */
export function waitingDays(submittedAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - submittedAt.getTime()) / 86_400_000));
}

/** Tanda lama menunggu di Persetujuan (BER-L20): lebih dari 1 hari kuning, lewat batas pengaturan merah. */
export function waitingTone(days: number, overdueDays: number): 'none' | 'warn' | 'danger' {
  if (days >= overdueDays) return 'danger';
  if (days >= 1) return 'warn';
  return 'none';
}

export function requestNumber(id: number): string {
  return `PJ-${id}`;
}
