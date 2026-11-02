import type { Actor, Tx } from '@/modules/access';

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };

/** Satu baris "sebelum → sesudah" untuk rincian dan keterangan pembantu penyetuju. */
export type ChangeRow = { label: string; before: string | null; after: string | null };

export type PreparedRequest = {
  subjectEmployeeId: number;
  summary: string;
  /** Kunci "urusan yang sama"; satu pengajuan terbuka per kunci (BER-L06 kembar ditolak). */
  dedupeKey: string | null;
  /** Label lampiran yang wajib untuk isian ini, atau null bila tidak wajib. */
  requiredAttachment: string | null;
  /** Simpan isi khas di tabel modul jenisnya, di transaksi pengajuan. */
  save: (tx: Tx, requestId: number) => Promise<void>;
};

/**
 * Isi khas satu jenis pengajuan, disediakan modul jenisnya (spec L2f-1 §3.1). Modul `requests` tidak mengimpor
 * modul jenis; app/ merangkai handler lewat `lib/request-handlers.ts`.
 */
export type RequestHandler = {
  /** Periksa isian dan siapkan simpanannya. Pelaku sudah lolos `requestAction`. */
  prepare: (tx: Tx, actor: Actor, input: Record<string, unknown>) => Promise<{ ok: true; data: PreparedRequest } | Fail>;
  /** Akibat setelah disetujui, di transaksi yang sama dengan keputusan; gagal = keputusan batal. */
  apply: (tx: Tx, actorAccountId: number, requestId: number) => Promise<{ ok: true; effect: string } | Fail>;
  /** Kalimat akibat untuk jendela Setujui (TAM-15), dibaca sebelum memutuskan. */
  effectPreview: (requestId: number) => Promise<string>;
  /** Pengajuan ditolak atau dibatalkan: bereskan isi khasnya di transaksi yang sama (opsional). */
  close?: (tx: Tx, actorAccountId: number, requestId: number, reason: string) => Promise<void>;
  /**
   * Jenis `cancelAfterApproval`: sebab pengajuan yang sudah disetujui tidak bisa dibatalkan lagi (mis. tanggalnya
   * sudah mulai), atau null bila boleh. Tanpa fungsi ini pembatalan sesudah disetujui ditolak.
   */
  cancelApprovedBlock?: (requestId: number) => Promise<string | null>;
  /** Jenis `revocable`: sebab Cabut persetujuan ditolak (mis. harinya sudah dikoreksi sesudahnya), atau null bila boleh. */
  revokeBlock?: (tx: Tx, requestId: number) => Promise<string | null>;
  /** Rincian isi. `reveal` = boleh melihat nilai pribadi utuh (penyetuju), bukan samaran. */
  describe: (requestId: number, reveal: boolean) => Promise<ChangeRow[]>;
  /** Isian lama untuk "Ajukan ulang" (PRI-37 butir 5). */
  resubmitValues: (requestId: number) => Promise<Record<string, unknown> | null>;
};
