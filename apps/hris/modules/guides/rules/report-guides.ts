// Pedoman Lapor (spec F3-5 §2, KAR-79, KAR-L34/L35): aturan murni, tanpa DB.

export const CASE_LABEL_MAX = 80;
export const REPORT_TO_MAX = 300;

export type ReportGuideInput = {
  /** Kunci jenis pengajuan; null = jenis kasus ditulis sendiri. */
  requestType: string | null;
  caseLabel: string | null;
  reportTo: string;
};

/** Isian dirapikan (spasi dibuang); `caseLabel` diabaikan bila memilih jenis pengajuan. */
export function cleanReportGuide(input: ReportGuideInput): ReportGuideInput {
  const requestType = input.requestType?.trim() || null;
  return {
    requestType,
    caseLabel: requestType ? null : input.caseLabel?.trim() || null,
    reportTo: input.reportTo.trim(),
  };
}

/** Masalah isian, atau null bila sah. `isRequestType` memeriksa kunci jenis pengajuan. */
export function reportGuideProblem(input: ReportGuideInput, isRequestType: (key: string) => boolean): string | null {
  if (input.requestType && !isRequestType(input.requestType)) return 'Jenis pengajuan tidak dikenal.';
  if (!input.requestType) {
    if (!input.caseLabel) return 'Pilih jenis pengajuan atau tulis jenis kasusnya.';
    if (input.caseLabel.length > CASE_LABEL_MAX) return `Jenis kasus paling panjang ${CASE_LABEL_MAX} huruf.`;
  }
  if (!input.reportTo) return 'Tulis lapor ke siapa.';
  if (input.reportTo.length > REPORT_TO_MAX) return `Pedoman paling panjang ${REPORT_TO_MAX} huruf.`;
  return null;
}

/** Urutan baru sesudah satu baris digeser naik/turun; null bila sudah di ujung. */
export function moveInOrder<T extends { id: number }>(rows: readonly T[], id: number, direction: 'up' | 'down'): T[] | null {
  const index = rows.findIndex((row) => row.id === id);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= rows.length) return null;
  const next = [...rows];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Cocok dengan kotak cari: jenis kasus atau isi pedoman, tanpa beda huruf besar/kecil. */
export function matchesGuideSearch(row: { caseLabel: string; reportTo: string }, query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || row.caseLabel.toLowerCase().includes(q) || row.reportTo.toLowerCase().includes(q);
}
