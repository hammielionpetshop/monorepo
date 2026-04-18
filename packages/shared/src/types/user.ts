export type UserRole = 'OWNER' | 'GM' | 'MANAGER' | 'KASIR' | 'GUDANG' | 'FINANCE';

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
  iat?: number;
  exp?: number;
}
