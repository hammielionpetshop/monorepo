import type { ActionName } from '@/modules/access';

/**
 * Daftar jenis pengajuan (spec L2f-1 §3.1, PRI-37 butir 2). Daftar di kode, bukan tabel, seperti daftar
 * tindakan dan daftar pengaturan. Penyetuju = jabatan yang punya `decideAction` di Hak Akses Jabatan (§9 butir 2).
 * Isi khas tiap jenis dan akibatnya milik modul jenisnya (handler, lihat `server/handler.ts`).
 */
export type RequestTypeDefinition = {
  label: string;
  module: string;
  /** Satu kalimat untuk tombol pilih jenis. */
  description: string;
  requestAction: ActionName;
  decideAction: ActionName;
  /** Pemeriksa (tahap Diperiksa); belum dipakai jenis mana pun di L2f-1. */
  reviewAction?: ActionName;
  /** Tindakan "ikut melihat" tambahan. */
  extraViewers: readonly ActionName[];
  /** Batas waktu mengajukan dalam satu kalimat (PRI-42); NONE = tidak berbatas. */
  deadline: { kind: 'NONE'; label: string };
  attachments: { label: string; rule: string };
  /** Lampiran hanya untuk pengaju, penyetuju, HR, dan Pemilik/GM (PRI-23). */
  confidential: boolean;
  cancelAfterApproval: boolean;
  /** Baris pedoman lapor (KAR-79), isi awal `daftar-lintas-modul` §1.7. */
  guideLine: string;
  /** Pesan berhasil dikirim, menyebut siapa bertindak berikutnya (TAM-17). */
  submittedMessage: string;
  /** Isiannya punya layar sendiri (mis. sel Pengaturan Jabatan), bukan halaman isian umum. */
  formHref?: string;
  /** Pemegang tindakan ini tidak melihat jenis ini di layar Ajukan, karena bisa langsung mengubah. */
  hiddenForAction?: ActionName;
};

export const REQUEST_TYPES = {
  identity_change: {
    label: 'Ubah data diri',
    module: 'Karyawan',
    description: 'Nama, tanggal lahir, jenis kelamin, atau rekening bank. Data lama tetap dipakai sampai HR menyetujui.',
    requestAction: 'identity_change.request',
    decideAction: 'identity_change.decide',
    extraViewers: [],
    deadline: { kind: 'NONE', label: 'Tidak berbatas waktu.' },
    attachments: { label: 'Foto buku tabungan atau kartu ATM', rule: 'Wajib bila rekening diganti' },
    confidential: true,
    cancelAfterApproval: false,
    guideLine: 'Ganti rekening wajib foto buku tabungan. HR memeriksa.',
    submittedMessage: 'Perubahan data terkirim. Data lama tetap dipakai sampai HR menyetujui.',
  },
  position_setting_change: {
    label: 'Usulan Pengaturan Jabatan',
    module: 'Karyawan',
    description: 'Usulkan perubahan tanda jabatan. Nilai lama tetap berlaku sampai Pemilik atau GM menyetujui.',
    requestAction: 'position_settings.propose',
    decideAction: 'position_settings.approve',
    extraViewers: [],
    deadline: { kind: 'NONE', label: 'Tidak berbatas waktu.' },
    attachments: { label: 'Tanpa lampiran', rule: 'Tidak perlu' },
    confidential: false,
    cancelAfterApproval: false,
    guideLine: 'Pilih jabatan dan tandanya di Pengaturan Jabatan. Pemilik atau GM memutuskan.',
    submittedMessage: 'Usulan terkirim. Nilai lama tetap berlaku sampai Pemilik atau GM menyetujui.',
    formHref: '/pengaturan/jabatan',
    hiddenForAction: 'position_settings.approve',
  },
} as const satisfies Record<string, RequestTypeDefinition>;

export type RequestTypeKey = keyof typeof REQUEST_TYPES;
export const REQUEST_TYPE_KEYS = Object.keys(REQUEST_TYPES) as RequestTypeKey[];

export function isRequestTypeKey(value: string): value is RequestTypeKey {
  return Object.hasOwn(REQUEST_TYPES, value);
}

export function requestType(key: RequestTypeKey): RequestTypeDefinition {
  return REQUEST_TYPES[key];
}

/** Semua tindakan yang membuat orang termasuk penyetuju atau pemeriksa sedikitnya satu jenis. */
export function deciderActions(): ActionName[] {
  return REQUEST_TYPE_KEYS.flatMap((key) => {
    const type: RequestTypeDefinition = REQUEST_TYPES[key];
    return type.reviewAction ? [type.decideAction, type.reviewAction] : [type.decideAction];
  });
}
