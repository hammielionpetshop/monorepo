import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { eq, or, type AnyColumn, type SQL } from 'drizzle-orm';
import { verifyAccessToken } from '@/lib/auth';
import type { JWTPayload } from '@petshop/shared';

/** Ambil & verifikasi payload dari cookie `accessToken`. null jika tidak valid. */
export async function getAuth(): Promise<JWTPayload | null> {
  const token = (await cookies()).get('accessToken')?.value;
  return token ? await verifyAccessToken(token) : null;
}

/** Sumbu CAPABILITY — apakah user boleh melakukan aksi `code`. */
export function hasPermission(payload: JWTPayload, code: string): boolean {
  return payload.permissions.includes(code);
}

/**
 * Guard siap-pakai untuk route. Kembalikan payload jika lolos,
 * atau NextResponse error (401/403) jika gagal.
 *
 *   const gate = await requirePermission('master.category.manage');
 *   if (gate instanceof NextResponse) return gate;
 *   const payload = gate;
 */
export async function requirePermission(
  code: string,
): Promise<JWTPayload | NextResponse> {
  const payload = await getAuth();
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 });
  }
  if (!hasPermission(payload, code)) {
    return NextResponse.json({ error: 'Akses ditolak untuk aksi ini' }, { status: 403 });
  }
  return payload;
}

/**
 * Sumbu SCOPE. Kembalikan kondisi WHERE untuk membatasi query ke cabang
 * yang boleh dilihat user. `branchScope === 'ALL'` → undefined (tanpa filter);
 * selain itu (termasuk `undefined`, default restriktif) → hanya cabang sendiri.
 *
 *   .where(and(scopeFilter(payload, stockOpnames.branchId), eq(...status)))
 */
export function scopeFilter(payload: JWTPayload, branchColumn: AnyColumn): SQL | undefined {
  if (payload.branchScope === 'ALL') return undefined;
  return eq(branchColumn, payload.branchId);
}

/**
 * Sumbu SCOPE untuk kolom cabang ganda (mis. inter-branch payables:
 * cabang debitur ATAU kreditur). Cocok bila cabang user muncul di salah satu kolom.
 * `branchScope === 'ALL'` → undefined (tanpa filter).
 */
export function scopeFilterAny(
  payload: JWTPayload,
  ...branchColumns: AnyColumn[]
): SQL | undefined {
  if (payload.branchScope === 'ALL') return undefined;
  const conds = branchColumns.map((col) => eq(col, payload.branchId));
  return conds.length === 1 ? conds[0] : or(...conds);
}
