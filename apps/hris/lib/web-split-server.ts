import { timingSafeEqual } from 'node:crypto';
import { headers } from 'next/headers';
import { hashSessionToken } from '@petshop/auth';
import type { Actor } from '@/modules/access';
import { myTripMenuVisible } from '@/modules/logistics';
import { getAuthSql } from './auth';
import { webForHost, webOriginsFromEnv, type HrisWeb } from './web-split';

type IsoDate = Parameters<typeof myTripMenuVisible>[1];

/**
 * Hak web Logistik (spec F2-7b §5): berhak penuh, punya minimal satu hak `logistics.*`, atau menu Trip Saya tampil
 * (driver/kenek). Satu-satunya tempat aturan ini; dipakai kerangka aplikasi dan pintu internal untuk gateway.
 */
export async function logisticsWebAllowed(actor: Actor | null, today: IsoDate): Promise<boolean> {
  if (!actor || actor.positionId == null) return false;
  if (actor.fullAccess) return true;
  for (const action of actor.grants.keys()) if (action.startsWith('logistics.')) return true;
  return myTripMenuVisible(actor, today);
}

/** Web yang sedang dibuka untuk permintaan ini. */
export async function currentWeb(): Promise<HrisWeb> {
  return webForHost((await headers()).get('host'), webOriginsFromEnv());
}

function sameSecret(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Pagar pintu internal HRIS (dipanggil Back Office di jaringan dalam). Semua penolakan = false, rute menjawab 404 polos.
 * Berlapis: kunci layanan, host internal, dan tanpa header proxy (permintaan dari luar selalu lewat Caddy).
 */
export function internalCallAllowed(req: Request): boolean {
  const key = process.env.HRIS_INTERNAL_KEY;
  const hosts = (process.env.INTERNAL_ALLOWED_HOSTS ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
  if (!key || key.length < 32 || !hosts.length) return false;
  if (!hosts.includes((req.headers.get('host') ?? '').toLowerCase())) return false;
  if (req.headers.get('x-forwarded-for') || req.headers.get('x-forwarded-host')) return false;
  return sameSecret(req.headers.get('x-internal-key'), key);
}

/** Akun + karyawan HRIS dari token sesi pusat (sesi hidup, akun aktif, tautan HRIS aktif). */
export async function hrisPersonOfSession(token: string): Promise<{ accountId: number; personId: number } | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const rows = await getAuthSql()<{ account_id: number; local_user_id: number }[]>`
    select s.account_id, l.local_user_id
    from auth.sessions s
    join auth.accounts a on a.id = s.account_id
    join auth.account_links l on l.account_id = s.account_id and l.app_code = 'hris' and l.revoked_at is null
    where s.token_hash = ${hashSessionToken(token)}
      and a.is_active and s.revoked_at is null and s.expires_at > now()
    limit 1`;
  const row = rows[0];
  return row ? { accountId: Number(row.account_id), personId: Number(row.local_user_id) } : null;
}
