/** Aturan murni Laporan Pulang, Serah Terima, Lapor Masalah, Sudah Pindah Cabang (spec L3d §3). Tanpa DB. */
import { withinOutCutoff } from './attendance';
import type { IsoDate } from './schedule';

/** Urutan Laporan Pulang (KEH-125): satu layar satu tugas. */
export const END_OF_DAY_STEPS = ['HANDOVER', 'PROBLEM', 'SEND'] as const;
export type EndOfDayStep = (typeof END_OF_DAY_STEPS)[number];

export function nextStep(step: EndOfDayStep): EndOfDayStep | null {
  const index = END_OF_DAY_STEPS.indexOf(step);
  return END_OF_DAY_STEPS[index + 1] ?? null;
}

export function previousStep(step: EndOfDayStep): EndOfDayStep | null {
  const index = END_OF_DAY_STEPS.indexOf(step);
  return index > 0 ? END_OF_DAY_STEPS[index - 1] : null;
}

/** Huruf dihitung dari isi yang dirapikan (spasi berlebih tidak dihitung). */
export function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

export function handoverProblem(text: string, minLength: number): string | null {
  const length = cleanText(text).length;
  if (length === 0) return 'Serah terima wajib diisi.';
  if (length < minLength) return `Serah terima paling sedikit ${minLength} huruf (sekarang ${length}).`;
  if (length > 2000) return 'Serah terima paling banyak 2000 huruf.';
  return null;
}

export const OFFICE_DEPARTMENT = 'office';

export type TeamPerson = { employeeId: number; branchId: number; departmentId: number };

/**
 * Penerima "Tim saya" (KEH-90, spec §9 butir 6): orang aktif di cabang tempat ia absen hari itu, termasuk yang
 * perbantuan di sana (`presentIds`). Kantor = departemennya. Tanpa dirinya.
 */
export function teamRecipients(input: {
  selfId: number; office: boolean; departmentId: number; branchId: number; people: readonly TeamPerson[]; presentIds: readonly number[];
}): number[] {
  const ids = new Set<number>();
  for (const person of input.people) {
    const match = input.office ? person.departmentId === input.departmentId : person.branchId === input.branchId;
    if (match) ids.add(person.employeeId);
  }
  if (!input.office) {
    const active = new Set(input.people.map((person) => person.employeeId));
    for (const id of input.presentIds) if (active.has(id)) ids.add(id);
  }
  ids.delete(input.selfId);
  return [...ids].sort((a, b) => a - b);
}

export type ReportState = 'NONE' | 'PENDING' | 'MISSED' | 'SENT';

/**
 * Keadaan Laporan Pulang satu hari (KEH-89, 91): sesudah foto Pulang, menunggu sampai batas jam pulang;
 * lewat batas tanpa laporan = tidak terkirim (hari dianggap belum pulang).
 */
export function reportState(input: { hasOut: boolean; reported: boolean; workDate: IsoDate; now: Date; cutoffHour: number }): ReportState {
  if (!input.hasOut) return 'NONE';
  if (input.reported) return 'SENT';
  return withinOutCutoff(input.workDate, input.now, input.cutoffHour) ? 'PENDING' : 'MISSED';
}

/**
 * Sudah Pindah Cabang? (KEH-27, KEH-L10). `workdays` = hari ia absen, terbaru dulu; hari tanpa absen memang
 * tidak ada di daftar, jadi tidak memutus urutan. Hasil = cabang yang ditanyakan, atau null.
 */
export function relocationBranch(workdays: readonly { workDate: IsoDate; branchId: number }[], homeBranchId: number, needed: number): number | null {
  if (needed < 1 || workdays.length < needed) return null;
  const recent = workdays.slice(0, needed);
  const branchId = recent[0].branchId;
  if (branchId === homeBranchId) return null;
  return recent.every((day) => day.branchId === branchId) ? branchId : null;
}

/** Nama lengkap orang aktif yang muncul di tanggapan (KEH-129, spec §9 butir 8). Peringatan, bukan larangan. */
export function namesInText(text: string, names: readonly string[]): string[] {
  const haystack = ` ${cleanText(text).toLowerCase()} `;
  const found = new Set<string>();
  for (const name of names) {
    const wanted = cleanText(name).toLowerCase();
    if (!wanted) continue;
    const escaped = wanted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'u').test(haystack)) found.add(cleanText(name));
  }
  return [...found];
}

export const PROBLEM_STATUSES = ['RECEIVED', 'IN_PROGRESS', 'DONE'] as const;
export type ProblemStatus = (typeof PROBLEM_STATUSES)[number];
export const PROBLEM_STATUS_LABELS: Record<ProblemStatus, string> = { RECEIVED: 'Diterima', IN_PROGRESS: 'Sedang ditangani', DONE: 'Selesai' };

export function responseProblem(value: string): string | null {
  const text = cleanText(value);
  if (text.length > 300) return 'Tanggapan paling banyak 300 huruf (satu kalimat).';
  return null;
}

export function problemBodyProblem(value: string): string | null {
  const text = cleanText(value);
  if (text.length < 10) return 'Ceritakan masalahnya paling sedikit 10 huruf.';
  if (text.length > 2000) return 'Laporan masalah paling banyak 2000 huruf.';
  return null;
}

export function noteProblem(value: string): string | null {
  const text = cleanText(value);
  if (text.length < 5) return 'Keterangan paling sedikit 5 huruf.';
  if (text.length > 1000) return 'Keterangan paling banyak 1000 huruf.';
  return null;
}
