/**
 * Antrean berantai (spec F3-1 §2–3, TAM-22, TAM-24). Butir antrean = kartu "Perlu perhatian" yang ditandai
 * `queue`; tidak ada daftar butir sendiri. Yang disimpan hanya "jenis ini sudah tampil ke akun ini hari ini".
 */

export type QueueGroup = 'EMERGENCY' | 'RULE' | 'TASK';

export type AttentionCard = {
  key: string; title: string; detail?: string; href: string; tone?: 'danger'; badge?: string;
  /** Kartu ini juga menjadi jendela antrean. Judul/rincian jendela boleh berbeda dari kartu Beranda. */
  queue?: { group: QueueGroup; oldestAt?: string | null; title?: string; detail?: string };
};

export type QueueItem = { kind: string; group: QueueGroup; title: string; detail: string | null; href: string; tone: 'danger' | null };

/** Jenis antrean yang lolos pegangan TAM-24 (seperti daftar tindakan KAR-71, ditulis di kode). */
export const QUEUE_KINDS = {
  requests: { group: 'TASK', reason: 'B1 — pengajuan menunggu keputusan lebih dari batas pengingat (PRI-37, TAM-24 butir 2)' },
  overdue: { group: 'TASK', reason: 'B2 — pengajuan menunggu lebih dari batas lama menunggu, ke Pemilik/GM (PRI-37)' },
} as const satisfies Record<string, { group: QueueGroup; reason: string }>;

export type QueueKind = keyof typeof QUEUE_KINDS;

export function isQueueKind(kind: string): kind is QueueKind {
  return Object.prototype.hasOwnProperty.call(QUEUE_KINDS, kind);
}

const GROUP_ORDER: Record<QueueGroup, number> = { EMERGENCY: 0, RULE: 1, TASK: 2 };

/**
 * Urutan jendela: darurat → aturan → tugas (TAM-22 butir 1), lalu yang terlama dulu. Jenis yang sudah
 * tampil hari ini tidak dikembalikan (butir 4); kartu yang sudah beres tidak ada di `cards`, jadi berhenti sendiri.
 */
export function buildQueue(cards: AttentionCard[], shownToday: ReadonlySet<string>): QueueItem[] {
  return cards
    .filter((card) => card.queue && isQueueKind(card.key) && !shownToday.has(card.key))
    .map((card, index) => ({ card, index }))
    .sort((a, b) => {
      const group = GROUP_ORDER[a.card.queue!.group] - GROUP_ORDER[b.card.queue!.group];
      if (group) return group;
      const at = (a.card.queue!.oldestAt ?? '9999').localeCompare(b.card.queue!.oldestAt ?? '9999');
      return at || a.index - b.index;
    })
    .map(({ card }) => ({
      kind: card.key, group: card.queue!.group,
      title: card.queue!.title ?? card.title, detail: card.queue!.detail ?? card.detail ?? null,
      href: card.href, tone: card.tone ?? null,
    }));
}

/** B1 baru menjadi jendela bila yang paling lama sudah menunggu sepanjang pengaturan (spec F3-1 §3.2). */
export function remindsApprover(oldestDays: number, remindAfterDays: number): boolean {
  return oldestDays >= remindAfterDays;
}
