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
  /**
   * Pemeriksa (tahap Diperiksa, L5 kasbon): pemegangnya hanya memeriksa (Menunggu → Diperiksa), tidak menyetujui dan
   * tidak menolak. Pengajuan baru diberitahukan ke pemeriksa lebih dulu; bila tidak ada, ke penyetuju.
   */
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
  /** Alasan menolak paling sedikit sepanjang ini (di atas pengaturan umum), mis. keberatan slip 15 huruf. */
  rejectReasonMin?: number;
  /** Pemilik/GM tidak mengajukan jenis ini (KAR-67). */
  hiddenForFullAccess?: boolean;
  /** Setujui/Tolak/Periksa lewat panel khas jenisnya (mis. angka akhir kasbon), bukan tombol umum. */
  customDecision?: boolean;
  /** Setujui wajib catatan paling sedikit sepanjang ini, dikirim sebagai `fields.note` (mis. "Sudah diselesaikan"). */
  approveNoteMin?: number;
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
  driver_fine: {
    label: 'Usulan denda driver & kenek',
    module: 'Gaji Driver',
    description: 'Kepala Gudang mengusulkan denda per kejadian untuk driver atau kenek. Nominal mengikuti Jenis Denda. Berlaku setelah Pemilik atau GM mengesahkan.',
    requestAction: 'fine.propose',
    decideAction: 'fine.decide',
    extraViewers: ['fine.view'],
    deadline: { kind: 'RULES', label: 'Tanggal kejadian paling lama 7 hari ke belakang; dipotong di slip utama periode tanggal kejadian.' },
    attachments: { label: 'Foto bukti', rule: 'Boleh' },
    confidential: true,
    cancelAfterApproval: false,
    guideLine: 'Ajukan dari Gaji › Denda Driver & Kenek. Pemilik atau GM mengesahkan.',
    submittedMessage: 'Usulan denda terkirim. Menunggu Pemilik atau GM.',
    formHref: '/gaji/denda-driver/ajukan',
    hiddenFromChooser: true,
  },
  unloading_late: {
    label: 'Laporan Bongkaran terlambat',
    module: 'Bongkaran',
    description: 'Laporan Bongkaran yang tanggal kerjanya lebih lama dari batas mundur. Belum ada upah sampai Pemilik atau GM menyetujui.',
    requestAction: 'unloading.create',
    decideAction: 'unloading.decide',
    extraViewers: ['unloading.view'],
    deadline: { kind: 'RULES', label: 'Tanggal kerja lebih dari batas mundur (awal 3 hari); alasan wajib.' },
    attachments: { label: 'Foto surat jalan', rule: 'Tersimpan di laporannya' },
    confidential: false,
    cancelAfterApproval: false,
    guideLine: 'Isi dari Gaji › Laporan Bongkaran › Laporan baru. Pemilik atau GM yang bukan pembuat dan bukan peserta memutuskan.',
    submittedMessage: 'Laporan tersimpan dan menunggu persetujuan Pemilik atau GM sebelum bisa dibayar.',
    rejectReasonMin: 15,
    formHref: '/gaji/bongkaran/baru',
    hiddenFromChooser: true,
  },
  unloading_not_received: {
    label: 'Upah bongkaran belum diterima',
    module: 'Bongkaran',
    description: 'Upah bongkaran ditandai sudah dibayar, tetapi uangnya belum Anda terima. Dibuat dari Pendapatan Saya.',
    requestAction: 'profile.view',
    decideAction: 'unloading.decide',
    extraViewers: ['unloading.pay'],
    deadline: { kind: 'RULES', label: 'Paling lambat 3 hari sejak diberi tahu dibayar.' },
    attachments: { label: 'Foto bukti', rule: 'Boleh' },
    confidential: false,
    cancelAfterApproval: false,
    guideLine: 'Lapor dari kartu Upah bongkaran di Pendapatan Saya. Pemilik atau GM memutuskan: Sudah diselesaikan (catatan) atau Tidak terbukti (alasan).',
    submittedMessage: 'Laporan terkirim. Pemilik atau GM dan yang membayar diberi tahu.',
    rejectReasonMin: 15,
    approveNoteMin: 15,
    formHref: '/pendapatan',
    hiddenFromChooser: true,
  },
  free_bonus: {
    label: 'Usulan Bonus Bebas',
    module: 'Gaji',
    description: 'HR mengusulkan bonus beralasan untuk seseorang (uang kantor atau Dana Disiplin). Masuk slip setelah Pemilik atau GM mengesahkan.',
    requestAction: 'bonus.record_free',
    decideAction: 'bonus.approve_free',
    extraViewers: ['bonus.view'],
    deadline: { kind: 'NONE', label: 'Tidak berbatas waktu; masuk slip periode tanggal bonusnya, atau periode berikutnya bila slip itu sudah ditutup.' },
    attachments: { label: 'Tanpa lampiran', rule: 'Tidak perlu' },
    confidential: true,
    cancelAfterApproval: false,
    guideLine: 'Catat dari Kantor › Persetujuan Bonus › Catat Bonus Bebas. Pemilik atau GM mengesahkan.',
    submittedMessage: 'Usulan Bonus Bebas terkirim. Menunggu Pemilik atau GM.',
    formHref: '/bonus/catat',
    hiddenFromChooser: true,
  },
  payslip_reopen: {
    label: 'Minta buka kembali slip',
    module: 'Gaji',
    description: 'HR meminta slip yang sudah ditutup dibuka kembali untuk dibetulkan. Pemilik atau GM memutuskan.',
    requestAction: 'payslip.request_reopen',
    decideAction: 'payslip.reopen',
    extraViewers: ['payslip.view'],
    deadline: { kind: 'NONE', label: 'Tidak berbatas waktu; ditolak bila slip periode berikutnya orang itu sudah ditutup.' },
    attachments: { label: 'Tanpa lampiran', rule: 'Tidak perlu' },
    confidential: true,
    cancelAfterApproval: false,
    guideLine: 'Ajukan dari layar Slip › Minta buka kembali. Pemilik atau GM memutuskan.',
    submittedMessage: 'Permintaan buka kembali terkirim. Menunggu Pemilik atau GM.',
    formHref: '/gaji/periode',
    hiddenFromChooser: true,
  },
  deduction_objection: {
    label: 'Keberatan potongan',
    module: 'Gaji',
    description: 'Tidak setuju dengan minus kas, Potongan Lain, atau denda driver yang dibebankan. Dibuat dari pemberitahuan potongan.',
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
  // Keberatan slip (spec L4g §3.5): satu isian, dua jenis menurut penyetujunya. "Ada yang salah" di slip biasa → HR,
  // Pemilik, GM; "Uang belum saya terima" dan slip jabatan bertanda → Pemilik/GM saja (catatan implementasi §12).
  payslip_objection: {
    label: 'Keberatan slip',
    module: 'Gaji',
    description: 'Ada yang salah di slip gaji Anda. Dibuat dari Slip Saya.',
    requestAction: 'profile.view',
    decideAction: 'payslip_objection.decide',
    extraViewers: [],
    deadline: { kind: 'RULES', label: 'Sejak periode berakhir sampai pukul 23.59 hari ke-3 sesudah slip ditutup.' },
    attachments: { label: 'Foto bukti', rule: 'Boleh' },
    confidential: true,
    cancelAfterApproval: false,
    guideLine: 'Ajukan dari Slip Saya sebelum batasnya. HR, Pemilik, atau GM memutuskan; slip tidak ditahan selama menunggu.',
    submittedMessage: 'Keberatan slip terkirim. Menunggu keputusan HR, Pemilik, atau GM. Slip tidak ditahan.',
    rejectReasonMin: 15,
    formHref: '/pendapatan/keberatan',
    hiddenFromChooser: true,
  },
  payslip_objection_owner: {
    label: 'Keberatan slip (Pemilik/GM)',
    module: 'Gaji',
    description: 'Uang gaji belum diterima, atau keberatan slip jabatan bertanda. Dibuat dari Slip Saya.',
    requestAction: 'profile.view',
    decideAction: 'payslip_objection.decide_owner',
    extraViewers: [],
    deadline: { kind: 'RULES', label: 'Uang belum diterima: sampai pukul 23.59 hari ke-7 sesudah ditandai Dibayar.' },
    attachments: { label: 'Foto bukti', rule: 'Boleh' },
    confidential: true,
    cancelAfterApproval: false,
    guideLine: 'Ajukan dari Slip Saya sebelum batasnya. Pemilik atau GM memutuskan.',
    submittedMessage: 'Keberatan slip terkirim. Menunggu keputusan Pemilik atau GM.',
    rejectReasonMin: 15,
    formHref: '/pendapatan/keberatan',
    hiddenFromChooser: true,
  },
  // Kasbon (spec L5 §3.1–3.6). Diperiksa Finance lalu diputuskan Pemilik/GM; angka akhir lewat panel khas.
  advance: {
    label: 'Kasbon',
    module: 'Kasbon',
    description: 'Pinjam uang kantor, dicicil 1 sampai 3 kali lewat slip gaji. Diperiksa Finance, diputuskan Pemilik atau GM.',
    requestAction: 'profile.view',
    decideAction: 'advance.decide',
    reviewAction: 'advance.review',
    extraViewers: ['advance.view'],
    deadline: { kind: 'NONE', label: 'Tidak berbatas waktu; diproses paling cepat 2 hari, tidak bisa langsung cair.' },
    attachments: { label: 'Tanpa lampiran', rule: 'Tidak perlu' },
    confidential: true,
    cancelAfterApproval: false,
    guideLine: 'Ajukan dari Saya › Kasbon Saya. Finance memeriksa, Pemilik atau GM memutuskan, lalu uangnya diserahkan.',
    submittedMessage: 'Kasbon diproses paling cepat 2 hari setelah pengajuan, tidak bisa langsung cair. Menunggu diperiksa Finance.',
    formHref: '/kasbon/ajukan',
    customDecision: true,
  },
  advance_cancel: {
    label: 'Minta batalkan kasbon',
    module: 'Kasbon',
    description: 'Kasbon sudah disetujui tetapi tidak jadi dibutuhkan. Dibuat dari Kasbon Saya.',
    requestAction: 'profile.view',
    decideAction: 'advance.decide',
    extraViewers: ['advance.view'],
    deadline: { kind: 'RULES', label: 'Selama uangnya belum diberikan.' },
    attachments: { label: 'Tanpa lampiran', rule: 'Tidak perlu' },
    confidential: true,
    cancelAfterApproval: false,
    guideLine: 'Minta dari kartu kasbon di Kasbon Saya. Pemilik atau GM memutuskan: Setujui = kasbon dibatalkan, Tolak = tetap berjalan.',
    submittedMessage: 'Permintaan terkirim. Selama menunggu, uang kasbon tidak diserahkan. Pemilik atau GM memutuskan.',
    rejectReasonMin: 15,
    formHref: '/kasbon',
    hiddenFromChooser: true,
  },
  advance_not_received: {
    label: 'Uang kasbon belum diterima',
    module: 'Kasbon',
    description: 'Kasbon ditandai sudah diberikan, tetapi uangnya belum Anda terima. Dibuat dari Kasbon Saya.',
    requestAction: 'profile.view',
    decideAction: 'advance.decide',
    extraViewers: ['advance.view'],
    deadline: { kind: 'RULES', label: 'Paling lambat 3 hari sejak diberi tahu kasbon diberikan.' },
    attachments: { label: 'Foto bukti', rule: 'Boleh' },
    confidential: true,
    cancelAfterApproval: false,
    guideLine: 'Lapor dari kartu kasbon di Kasbon Saya. Pemilik atau GM memutuskan: Sudah diselesaikan (catatan) atau Tidak terbukti (alasan).',
    submittedMessage: 'Laporan terkirim. Pemilik atau GM dan yang menyerahkan uang diberi tahu.',
    rejectReasonMin: 15,
    approveNoteMin: 15,
    formHref: '/kasbon',
    hiddenFromChooser: true,
  },
  advance_postpone: {
    label: 'Tunda cicilan kasbon',
    module: 'Kasbon',
    description: 'Semua cicilan kasbon yang belum terpotong bergeser satu gajian. Jatah 1 kali per kasbon. Dibuat dari Kasbon Saya.',
    requestAction: 'profile.view',
    decideAction: 'advance.decide',
    extraViewers: ['advance.view'],
    deadline: { kind: 'RULES', label: 'Gugur sendiri bila slip cicilan terdekat ditutup sebelum diputuskan; cicilan dipotong biasa dan jatah tidak terpakai.' },
    attachments: { label: 'Tanpa lampiran', rule: 'Tidak perlu' },
    confidential: true,
    cancelAfterApproval: false,
    guideLine: 'Minta dari kartu kasbon di Kasbon Saya. Pemilik atau GM memutuskan: Setujui = semua cicilan bergeser satu gajian.',
    submittedMessage: 'Permintaan tunda terkirim. Selama menunggu, cicilan tetap terjadwal; bila slipnya ditutup lebih dulu, permintaan gugur.',
    rejectReasonMin: 15,
    formHref: '/kasbon',
    hiddenFromChooser: true,
  },
  // Sisa kasbon bawaan sistem lama (spec L9 §3.1, SIS-28): diketik Finance, disahkan Pemilik/GM.
  advance_legacy: {
    label: 'Sisa kasbon bawaan sistem lama',
    module: 'Kasbon',
    description: 'Sisa kasbon per orang dari sistem lama pada hari pindah. Diketik Finance dari Gaji › Kasbon › Bawaan, disahkan Pemilik atau GM.',
    requestAction: 'advance.legacy_enter',
    decideAction: 'advance.decide',
    extraViewers: ['advance.view'],
    deadline: { kind: 'NONE', label: 'Diketik menjelang hari pindah; satu per orang.' },
    attachments: { label: 'Tanpa lampiran', rule: 'Tidak perlu' },
    confidential: true,
    cancelAfterApproval: false,
    guideLine: 'Finance mengetik sisa per orang dari Gaji › Kasbon › Bawaan. Pemilik atau GM mengesahkan; cicilan dimulai di slip hari pindah.',
    submittedMessage: 'Sisa kasbon bawaan terkirim. Menunggu disahkan Pemilik atau GM.',
    rejectReasonMin: 15,
    formHref: '/gaji/kasbon/bawaan',
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
