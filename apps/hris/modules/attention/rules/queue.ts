import type { ActionName } from '@/modules/access';

/**
 * Antrean berantai (spec F3-1 §2–3, TAM-22, TAM-24; pindahan pengingat spec F3-4 §2). Butir antrean = kartu
 * "Perlu perhatian" yang ditandai `queue`; tidak ada daftar butir sendiri. Yang disimpan hanya "jenis ini sudah
 * tampil ke akun ini hari ini".
 */

export type QueueGroup = 'EMERGENCY' | 'RULE' | 'TASK';

export type CardQueue = {
  /** Jenis jendela (spec F3-4 §2 butir 1). Kosong = kunci kartu. Kartu-kartu sejenis digabung menjadi satu jendela. */
  kind?: string;
  /** Kosong = kelompok jenisnya di QUEUE_KINDS. */
  group?: QueueGroup;
  oldestAt?: string | null;
  title?: string; detail?: string;
  /** Kartu ini memang untuk Pemilik/GM (mis. "lewat batas"), walau jenisnya bukan. */
  top?: boolean;
};

export type AttentionCard = {
  key: string; title: string; detail?: string; href: string; tone?: 'danger'; badge?: string;
  /** Kartu ini juga menjadi jendela antrean. Judul/rincian jendela boleh berbeda dari kartu Beranda. */
  queue?: CardQueue;
};

export type QueueItem = { kind: string; group: QueueGroup; title: string; detail: string | null; href: string; tone: 'danger' | null };

type KindDefinition = {
  group: QueueGroup; reason: string;
  /** Kata benda untuk jendela gabungan: "Ada 3 {many}." */
  many?: string;
  /** Tautan jendela gabungan bila kartu-kartunya menunjuk rincian masing-masing. */
  listHref?: string;
  /** Pemilik/GM termasuk penerima tetap jenis ini (spec F3-4 §3.1 kolom Kepada). */
  top?: boolean;
  /**
   * Hak penerimanya (Kepala Gudang, Finance, Kepala Toko, HR). Bila tidak ada pemegang yang hidup, jendela naik ke
   * Pemilik/GM dengan tanda "(penerima tidak ada)" (PRI-43, spec F3-4 §2 butir 3).
   */
  holders?: readonly ActionName[];
};

/** Jenis antrean yang lolos pegangan TAM-24 (seperti daftar tindakan KAR-71, ditulis di kode). */
export const QUEUE_KINDS = {
  rule_unread: { group: 'RULE', reason: 'Perubahan aturan terbit belum dibaca sasarannya (PRD Fase 3 03 §2, spec F3-3 §3.6)' },
  requests: { group: 'TASK', reason: 'B1 — pengajuan menunggu keputusan lebih dari batas pengingat (PRI-37, TAM-24 butir 2)' },
  overdue: { group: 'TASK', reason: 'B2 — pengajuan menunggu lebih dari batas lama menunggu, ke Pemilik/GM (PRI-37)' },
  // Karyawan & Kehadiran (spec F3-4 §3.1)
  'training-due': { group: 'TASK', reason: 'B7 — tanggal penilaian karyawan training tiba', top: true, holders: ['training_promotion.decide'] },
  'attendance-review': { group: 'TASK', reason: 'B34 — absen luar titik menunggu tinjauan', top: true, holders: ['attendance.review.decide'] },
  'absence-due': { group: 'TASK', reason: 'B27 — izin/sakit/cuti belum diputuskan padahal tanggalnya tiba', holders: ['absence.decide'] },
  'doctor-letter': { group: 'TASK', reason: 'B28 — surat dokter tinggal 1 hari untuk disusulkan', many: 'surat dokter belum disusulkan' },
  'clarify-mine': { group: 'TASK', reason: 'B29 — hal Perlu Dijelaskan: hari kejadian, H-1, dan hari terakhir' },
  'absent-streak': { group: 'TASK', reason: 'B31 — tidak masuk berturut-turut belum ditandai dilihat', top: true, holders: ['clarification.streak.seen'] },
  'overtime-unclaimed': { group: 'TASK', reason: 'B32 — lembur belum diklaim: H-1 dan hari terakhir' },
  'day-off-quota': { group: 'TASK', reason: 'B23 — jatah libur belum lengkap: H-7, H-3, H-1 sebelum jendela ditutup', many: 'periode jatah libur belum lengkap' },
  'swap-invite': { group: 'TASK', reason: 'B24 — ajakan tukar libur menunggu jawaban' },
  'work-request': { group: 'TASK', reason: 'B25 — diminta masuk di hari libur', many: 'permintaan masuk di hari libur' },
  'replacement-day': { group: 'TASK', reason: 'B26 — libur pengganti tinggal 3 hari untuk dipilih', many: 'libur pengganti belum dipilih' },
  // Gaji & Kasbon
  'salary-missing': { group: 'TASK', reason: 'B36 — karyawan belum ada gaji, slipnya tidak bisa dihitung', top: true, holders: ['salary.change'] },
  objection: { group: 'TASK', reason: 'B44 — keberatan slip menunggu; ke Pemilik/GM sesudah 2 hari', holders: ['payslip_objection.decide'] },
  'advance-waiting': { group: 'TASK', reason: 'B63 — kasbon menunggu diperiksa / diputuskan', top: true, holders: ['advance.review'] },
  'advance-hand-over': { group: 'TASK', reason: 'B64 — kasbon disetujui belum diberikan', top: true, holders: ['advance.hand_over'] },
  'trip-wage-unrated': { group: 'TASK', reason: 'B57 — upah ritase belum bertarif', top: true },
  'unloading-unpaid': { group: 'TASK', reason: 'B61 — Laporan Bongkaran belum dibayar lewat harinya', top: true },
  'unloading-overpay': { group: 'TASK', reason: 'B62 — lebih bayar bongkaran lewat batas', top: true },
  // Logistik
  'trip-hanging': { group: 'TASK', reason: 'B47 — trip belum Sampai Garasi lewat batas (LOG-31)', many: 'trip belum Sampai Garasi', listHref: '/logistics/trips?tab=hanging', top: true, holders: ['logistics.trip.manage'] },
  'self-cash': { group: 'TASK', reason: 'B49 — tunai antar sendiri menunggu diterima laci', holders: ['logistics.self_delivery.cash_receive'] },
  'delivery-failed': { group: 'TASK', reason: 'B50 — kiriman Gagal belum diputuskan sesudah 3 hari', holders: ['logistics.delivery_note.decide', 'logistics.self_delivery.manage'] },
  'store-reports': { group: 'TASK', reason: 'B51/B52 — laporan toko belum diputuskan sesudah 3 hari', holders: ['logistics.note_cut.decide'] },
  'cashier-unrecorded': { group: 'TASK', reason: 'B53 — potong nota / pelunasan belum dicatat di kasir lewat ambang', top: true, holders: ['logistics.note_cut.decide', 'logistics.money_check.do'] },
  'store-points': { group: 'TASK', reason: 'B46 — titik toko menunggu persetujuan lebih dari 2 hari', holders: ['logistics.store_point.decide'] },
  'fuel-wait': { group: 'TASK', reason: 'B54 — permintaan bensin belum diisi sampai 12.00 hari berikutnya', holders: ['logistics.vehicle_followup.manage'] },
  'vehicle-attention': { group: 'TASK', reason: 'B21 — mobil perlu perhatian dari Laporan Pulang', holders: ['logistics.vehicle_followup.manage'] },
  'returned-goods': { group: 'TASK', reason: 'B56 — barang kembali belum diterima', holders: ['logistics.returned_goods.receive'] },
} as const satisfies Record<string, KindDefinition>;

export type QueueKind = keyof typeof QUEUE_KINDS;

export function isQueueKind(kind: string): kind is QueueKind {
  return Object.prototype.hasOwnProperty.call(QUEUE_KINDS, kind);
}

function definition(kind: QueueKind): KindDefinition {
  return QUEUE_KINDS[kind];
}

/** Hak penerima jenis ini (untuk naik ke Pemilik/GM). */
export function holdersOf(kind: QueueKind): readonly ActionName[] | undefined {
  return definition(kind).holders;
}

export function queueKindOf(card: AttentionCard): string {
  return card.queue?.kind ?? card.key;
}

const GROUP_ORDER: Record<QueueGroup, number> = { EMERGENCY: 0, RULE: 1, TASK: 2 };

export const NO_RECIPIENT = '(penerima tidak ada)';

/**
 * Naik ke Pemilik/GM (spec F3-4 §2 butir 3). Pemilik/GM (akses penuh) melihat semua kartu di Beranda; jendelanya
 * hanya untuk jenis yang memang untuk mereka, atau bila penerimanya tidak ada (`live` = ada pemegang hak yang hidup).
 * Kartu yang naik diberi tanda pada judul kartu dan jendelanya.
 */
export function routeForTop(cards: AttentionCard[], fullAccess: boolean, live: (holders: readonly ActionName[]) => boolean): AttentionCard[] {
  if (!fullAccess) return cards;
  return cards.map((card) => {
    if (!card.queue) return card;
    const kind = queueKindOf(card);
    if (!isQueueKind(kind)) return card;
    const def = definition(kind);
    if (def.top || card.queue.top || !def.holders) return card;
    if (live(def.holders)) return { ...card, queue: undefined };
    return {
      ...card, title: `${card.title} ${NO_RECIPIENT}`,
      queue: { ...card.queue, title: card.queue.title ? `${card.queue.title} ${NO_RECIPIENT}` : undefined },
    };
  });
}

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short' }).format(new Date(iso));
}

/**
 * Urutan jendela: darurat → aturan → tugas (TAM-22 butir 1), lalu yang terlama dulu. Jenis yang sudah
 * tampil hari ini tidak dikembalikan (butir 4); kartu yang sudah beres tidak ada di `cards`, jadi berhenti sendiri.
 * Kartu-kartu dengan jenis sama menjadi satu jendela (TAM-25 butir 4, spec F3-4 §2 butir 1).
 */
export function buildQueue(cards: AttentionCard[], shownToday: ReadonlySet<string>): QueueItem[] {
  const byKind = new Map<QueueKind, { cards: AttentionCard[]; index: number }>();
  cards.forEach((card, index) => {
    if (!card.queue) return;
    const kind = queueKindOf(card);
    if (!isQueueKind(kind) || shownToday.has(kind)) return;
    const entry = byKind.get(kind);
    if (entry) entry.cards.push(card);
    else byKind.set(kind, { cards: [card], index });
  });
  return [...byKind.entries()]
    .map(([kind, entry]) => {
      const first = entry.cards[0];
      const group = first.queue!.group ?? definition(kind).group;
      const oldestAt = entry.cards.map((card) => card.queue!.oldestAt).filter((at): at is string => !!at).sort()[0] ?? null;
      const many = definition(kind).many;
      const merged = entry.cards.length > 1;
      const item: QueueItem = merged
        ? {
          kind, group,
          title: many ? `Ada ${entry.cards.length} ${many}.` : entry.cards.map((card) => card.queue!.title ?? card.title).join(' · '),
          detail: oldestAt ? `Yang paling lama sejak ${shortDate(oldestAt)}.` : (first.queue!.detail ?? first.detail ?? null),
          href: definition(kind).listHref ?? first.href, tone: entry.cards.some((card) => card.tone === 'danger') ? 'danger' : null,
        }
        : {
          kind, group,
          title: first.queue!.title ?? first.title, detail: first.queue!.detail ?? first.detail ?? null,
          href: first.href, tone: first.tone ?? null,
        };
      return { item, oldestAt, index: entry.index };
    })
    .sort((a, b) => {
      const group = GROUP_ORDER[a.item.group] - GROUP_ORDER[b.item.group];
      if (group) return group;
      const at = (a.oldestAt ?? '9999').localeCompare(b.oldestAt ?? '9999');
      return at || a.index - b.index;
    })
    .map(({ item }) => item);
}

/** B1 baru menjadi jendela bila yang paling lama sudah menunggu sepanjang pengaturan (spec F3-1 §3.2). */
export function remindsApprover(oldestDays: number, remindAfterDays: number): boolean {
  return oldestDays >= remindAfterDays;
}

/** Sisa hari dari `today` ke `until` (tanggal ISO); negatif bila lewat. */
export function daysUntil(today: string, until: string): number {
  return Math.round((Date.parse(`${until}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}
