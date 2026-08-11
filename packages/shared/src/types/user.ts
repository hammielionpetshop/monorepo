export type UserRole = 'OWNER' | 'GM' | 'MANAGER' | 'KASIR' | 'GUDANG' | 'FINANCE';

// Sumbu scope cabang — cukup 2 nilai untuk kondisi sekarang.
// Jalur upgrade: ganti jadi number[] yang di-load dari ownerAssignments (lihat rencana RBAC §8).
export type BranchScope = 'ALL' | 'OWN';

export interface User {
  id: number;
  staffNumber: string | null;
  email: string | null;
  name: string;
  role: UserRole;
  isActive: boolean;
  branchId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface JWTPayload {
  userId: number;
  userName: string;
  staffNumber: string | null;
  branchId: number;
  branchName: string;
  role: UserRole;
  permissions: string[];
  // Sumbu scope: cabang mana yang boleh dilihat. Diisi login di fase R4;
  // opsional sementara agar R1 additif (undefined → diperlakukan OWN oleh scopeFilter).
  branchScope?: BranchScope;
  // Cabang tempat user boleh bertugas (`user_branch_assignments`). `branchId` di atas adalah
  // cabang UTAMA-nya dan selalu termasuk di sini. Yang AKTIF tetap satu pada satu waktu dan
  // disimpan di cookie, bukan di token — daftar ini hanya membatasi pilihannya.
  //
  // Opsional agar additif: token lama tanpa field ini diperlakukan sebagai `[branchId]` oleh
  // `lib/active-branch.ts`, yaitu persis perilaku sebelum penugasan multi-cabang ada.
  //
  // Tidak berlaku untuk `branchScope === 'ALL'` (OWNER/GM): mereka boleh memilih cabang aktif
  // mana pun, jadi daftarnya tak perlu disalin ke token.
  branchIds?: number[];
  // First-login gate: true → user wajib onboarding (ganti password + isi PIN) sebelum akses
  // halaman lain. Diisi login di S3; opsional agar additif (token lama tanpa ini → falsy → tak dipaksa).
  mustChangeCredentials?: boolean;
  // Gate khusus PIN: true → user wajib memilih PIN baru (setelah OWNER me-reset PIN-nya)
  // sebelum akses halaman lain. Opsional agar additif — token lama tanpa ini tidak terkunci.
  mustChangePin?: boolean;
  iat?: number;
  exp?: number;
}
