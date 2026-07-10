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
  // First-login gate: true → user wajib onboarding (ganti password + isi PIN) sebelum akses
  // halaman lain. Diisi login di S3; opsional agar additif (token lama tanpa ini → falsy → tak dipaksa).
  mustChangeCredentials?: boolean;
  iat?: number;
  exp?: number;
}
