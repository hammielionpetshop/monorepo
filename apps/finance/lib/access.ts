import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';
import { getSql } from '@/lib/db';

/** Web Finance staging hanya untuk Owner dan GM (keputusan owner 2026-11-12, spec F2-6 §3.1). */
export const FINANCE_ROLES = ['OWNER', 'GM'] as const;

export type FinanceViewer = { userId: number; name: string; role: string };
export type AccessResult =
  | { ok: true; viewer: FinanceViewer }
  | { ok: false; reason: 'NO_SESSION' | 'NOT_ALLOWED' | 'NOT_CONFIGURED'; name?: string };

/**
 * Sama dengan `sessionCookieOptions().name` dan `hashSessionToken` di @petshop/auth (dijaga access.test.ts). Ditulis
 * ulang di sini karena paket auth ikut membawa modul native (argon2) yang tidak perlu untuk sekadar membaca sesi.
 */
export function sessionCookieName(environment: string | undefined): string | null {
  if (environment !== 'local' && environment !== 'staging' && environment !== 'production') return null;
  return `hml_${environment}_session`;
}

export function sessionTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function cookieName(): string | null {
  return sessionCookieName(process.env.AUTH_COOKIE_ENV);
}

/**
 * Memakai sesi auth pusat milik Back Office (cookie bersama domain staging). Hanya MEMBACA sesi — tidak
 * memperpanjang atau mencatat apa pun, karena role Finance tidak boleh menulis. Masuk/keluar tetap lewat Back Office.
 */
export async function currentViewer(): Promise<AccessResult> {
  const name = cookieName();
  if (!name) return { ok: false, reason: 'NOT_CONFIGURED' };
  const token = (await cookies()).get(name)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return { ok: false, reason: 'NO_SESSION' };
  const rows = await getSql()<{ user_id: number; name: string; role: string; is_active: boolean }[]>`
    select u.id as user_id, u.name, r.name as role, u.is_active
    from auth.sessions s
    join auth.accounts a on a.id = s.account_id
    join auth.session_app_access x on x.session_id = s.id and x.app_code = 'backoffice'
    join auth.account_links l on l.id = x.account_link_id and l.account_id = s.account_id
      and l.app_code = 'backoffice' and l.local_user_id = x.local_user_id
    join petshop.users u on u.id = x.local_user_id
    join petshop.roles r on r.id = u.role_id
    where s.token_hash = ${sessionTokenHash(token)}
      and a.is_active and s.revoked_at is null and s.expires_at > now()
      and x.revoked_at is null and x.expires_at > now() and l.revoked_at is null
    limit 1`;
  const row = rows[0];
  if (!row || !row.is_active) return { ok: false, reason: 'NO_SESSION' };
  if (!(FINANCE_ROLES as readonly string[]).includes(row.role)) return { ok: false, reason: 'NOT_ALLOWED', name: row.name };
  return { ok: true, viewer: { userId: Number(row.user_id), name: row.name, role: row.role } };
}

/** Alamat Back Office untuk tombol masuk & tautan "Lihat di layar asal". */
export function backofficeUrl(path = ''): string | null {
  const base = process.env.BACKOFFICE_PUBLIC_URL?.replace(/\/+$/, '');
  return base ? `${base}${path}` : null;
}

export function hrisUrl(path = ''): string | null {
  const base = process.env.HRIS_PUBLIC_URL?.replace(/\/+$/, '');
  return base ? `${base}${path}` : null;
}
