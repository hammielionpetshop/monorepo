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
  deadline: { kind: 'NONE' | 'RULES'; label: string };
  attachments: { label: string; rule: string };
  /** Lampiran hanya untuk pengaju, penyetuju, HR, dan Pemilik/GM (PRI-23). */
  confidential: boolean;
  cancelAfterApproval: boolean;
  /** Penyetuju boleh mencabut persetujuan dengan alasan (KEH-148). */
  revocable?: boolean;
  /** Baris pedoman lapor (KAR-79), isi awal `daftar-lintas-modul` §1.7. */
  guideLine: string;
  /** Pesan berhasil dikirim, menyebut siapa bertindak berikutnya (TAM-17). */
  submittedMessage: string;
  /** Isiannya punya layar sendiri (mis. sel Pengaturan Jabatan), bukan halaman isian umum. */
  formHref?: string;
  /** Pemegang tindakan ini tidak melihat jenis ini di layar Ajukan, karena bisa langsung mengubah. */
  hiddenForAction?: ActionName;
  /** Hanya dibuat dari layar lain (mis. pertanyaan di Absen), tidak tampil di layar Ajukan. */
  hiddenFromChooser?: boolean;
  /** Pemilik/GM tidak mengajukan jenis ini (KAR-67). */
  hiddenForFullAccess?: boolean;
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
  relocation: {
    label: 'Usulan pindah cabang',
    module: 'Kehadiran',
    description: 'Muncul di Absen sesudah beberapa hari kerja berturut-turut di cabang lain. Cabang penempatan tetap sampai disetujui.',
    requestAction: 'attendance.self.check',
    decideAction: 'relocation.decide',
    extraViewers: [],
    deadline: { kind: 'NONE', label: 'Tidak berbatas waktu.' },
    attachments: { label: 'Tanpa lampiran', rule: 'Tidak perlu' },
    confidential: false,
    cancelAfterApproval: false,
    guideLine: 'Dijawab dari pertanyaan "Sudah pindah cabang?" di Absen. HR, Pemilik, atau GM memutuskan.',
    submittedMessage: 'Usulan pindah cabang terkirim. Cabang penempatan tetap sampai HR, Pemilik, atau GM menyetujui.',
    hiddenFromChooser: true,
  },
  absence: {
    label: 'Izin, sakit, atau cuti',
    module: 'Kehadiran',
    description: 'Izin keperluan, sakit, cuti tahunan, atau izin duka. Hari kerja dan batas waktunya dihitung sistem.',
    requestAction: 'attendance.self.check',
    decideAction: 'absence.decide',
    extraViewers: [],
    deadline: { kind: 'RULES', label: 'Izin H-2 (kurang dari itu: izin mendadak), cuti H-7, sakit dan duka paling lambat 3 hari sesudah hari pertama.' },
    attachments: { label: 'Foto surat dokter', rule: 'Wajib untuk sakit dengan surat, boleh menyusul' },
    confidential: true,
    cancelAfterApproval: true,
    revocable: true,
    guideLine: 'Sakit lebih dari 2 hari wajib surat dokter. HR, Pemilik, atau GM memutuskan.',
    submittedMessage: 'Pengajuan terkirim. Menunggu keputusan HR atau pemilik. Selama menunggu, hari itu tidak ditandai alpha.',
    formHref: '/tidak-masuk/ajukan',
    hiddenForFullAccess: true,
  },
  clarification: {
    label: 'Penjelasan',
    module: 'Kehadiran',
    description: 'Menjelaskan alpha, lupa absen, telat, atau pulang cepat. Dibuat dari menu Perlu Dijelaskan.',
    requestAction: 'attendance.self.check',
    decideAction: 'clarification.decide',
    extraViewers: [],
    deadline: { kind: 'RULES', label: 'Paling lambat 3 hari sesudah tanggal kejadian pukul 23.59. Lupa absen yang lewat batas lewat pengajuan terlambat.' },
    attachments: { label: 'Foto surat dokter atau bukti', rule: 'Wajib untuk sakit dengan surat (boleh menyusul); lainnya boleh' },
    confidential: true,
    cancelAfterApproval: false,
    revocable: true,
    guideLine: 'Jelaskan dari menu Perlu Dijelaskan sebelum batas 3 hari. HR, Pemilik, atau GM memutuskan.',
    submittedMessage: 'Terkirim. Menunggu keputusan HR atau pemilik.',
    formHref: '/perlu-dijelaskan',
    hiddenFromChooser: true,
  },
  overtime_claim: {
    label: 'Klaim lembur',
    module: 'Kehadiran',
    description: 'Klaim lembur yang terdeteksi sistem. Dibuat dari menu Lembur Saya.',
    requestAction: 'attendance.self.check',
    decideAction: 'overtime.decide',
    extraViewers: [],
    deadline: { kind: 'RULES', label: 'Paling lambat 3 hari sesudah tanggal lembur pukul 23.59. Lewat itu hangus, tanpa pengajuan terlambat.' },
    attachments: { label: 'Foto kertas lembur', rule: 'Wajib' },
    confidential: true,
    cancelAfterApproval: false,
    revocable: true,
    guideLine: 'Foto kertas lembur dan pilih yang menyuruh, dari menu Lembur Saya. HR, Pemilik, atau GM mengesahkan.',
    submittedMessage: 'Klaim lembur terkirim. Menunggu keputusan HR atau pemilik.',
    formHref: '/lembur',
    hiddenFromChooser: true,
  },
  salary_change: {
    label: 'Usulan ubah gaji',
    module: 'Gaji',
    description: 'HR mengusulkan gaji baru seseorang mulai tanggal 26. Gaji lama tetap dipakai sampai Pemilik atau GM menyetujui.',
    requestAction: 'salary.propose',
    decideAction: 'salary.change',
    extraViewers: [],
    deadline: { kind: 'RULES', label: 'Hangus bila belum diputuskan sampai hari ke-4 sesudah periode yang dipilih berakhir (tanggal 29).' },
    attachments: { label: 'Tanpa lampiran', rule: 'Tidak perlu' },
    confidential: true,
    cancelAfterApproval: false,
    guideLine: 'Usulkan dari Kantor › Gaji Karyawan › Ubah Gaji. Pemilik atau GM memutuskan.',
    submittedMessage: 'Usulan terkirim. Menunggu Pemilik atau GM.',
    formHref: '/gaji',
    hiddenForAction: 'salary.change',
  },
  inventory_loss: {
    label: 'Usulan kehilangan barang',
    module: 'Gaji',
    description: 'HR mencatat kehilangan barang hasil opname. Berlaku setelah Pemilik atau GM mengesahkan.',
    requestAction: 'inventory_loss.record',
    decideAction: 'deduction.approve',
    extraViewers: ['inventory_loss.view'],
    deadline: { kind: 'NONE', label: 'Tidak berbatas waktu; bila disahkan sesudah slip periodenya ditutup, masuk slip berikutnya.' },
    attachments: { label: 'Foto hasil opname', rule: 'Wajib' },
    confidential: false,
    cancelAfterApproval: false,
    guideLine: 'Catat dari Kantor › Kehilangan Barang dengan foto hasil opname. Pemilik atau GM mengesahkan.',
    submittedMessage: 'Usulan kehilangan barang terkirim. Menunggu Pemilik atau GM.',
    formHref: '/potongan/kehilangan-barang/catat',
    hiddenFromChooser: true,
  },
  manual_cash_shortage: {
    label: 'Usulan minus kas catat tangan',
    module: 'Gaji',
    description: 'Minus kas di luar shift POS. Berlaku setelah Pemilik atau GM mengesahkan.',
    requestAction: 'cash_shortage.record',
    decideAction: 'deduction.approve',
    extraViewers: ['cash_shortage.view'],
    deadline: { kind: 'NONE', label: 'Tidak berbatas waktu.' },
    attachments: { label: 'Foto bukti', rule: 'Boleh' },
    confidential: false,
    cancelAfterApproval: false,
    guideLine: 'Catat dari Kantor › Minus Kas, tab Catat tangan. Pemilik atau GM mengesahkan.',
    submittedMessage: 'Usulan minus kas terkirim. Menunggu Pemilik atau GM.',
    formHref: '/potongan/minus-kas/catat',
    hiddenFromChooser: true,
  },
  other_deduction: {
    label: 'Usulan Potongan Lain',
    module: 'Gaji',
    description: 'HR mengajukan ganti rugi perorangan yang dicicil 1 sampai 3 kali lewat slip. Berjalan setelah Pemilik atau GM mengesahkan.',
    requestAction: 'other_deduction.propose',
    decideAction: 'deduction.approve',
    extraViewers: ['other_deduction.view'],
    deadline: { kind: 'NONE', label: 'Tidak berbatas waktu; cicilan pertama di slip periode saat disahkan.' },
    attachments: { label: 'Foto bukti', rule: 'Boleh' },
    confidential: true,
    cancelAfterApproval: false,
    guideLine: 'Ajukan dari Kantor › Potongan Lain. Pemilik atau GM mengesahkan.',
    submittedMessage: 'Usulan Potongan Lain terkirim. Menunggu Pemilik atau GM.',
    formHref: '/potongan/lain/ajukan',
    hiddenFromChooser: true,
  },
  deduction_objection: {
    label: 'Keberatan potongan',
    module: 'Gaji',
    description: 'Tidak setuju dengan minus kas atau Potongan Lain yang dibebankan. Dibuat dari pemberitahuan potongan.',
    requestAction: 'profile.view',
    decideAction: 'deduction.approve',
    extraViewers: [],
    deadline: { kind: 'RULES', label: 'Paling lambat pukul 23.59 hari ke-3 sejak diberi tahu.' },
    attachments: { label: 'Foto bukti', rule: 'Boleh' },
    confidential: true,
    cancelAfterApproval: false,
    guideLine: 'Ajukan dari pemberitahuan potongan sebelum batas 3 hari. Pemilik atau GM memutuskan: disetujui = ditiadakan, ditolak = tetap.',
    submittedMessage: 'Keberatan terkirim. Potongan tetap berjalan sampai Pemilik atau GM memutuskan.',
    formHref: '/keberatan-potongan/ajukan',
    hiddenFromChooser: true,
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
