import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

/** Alamat gateway dari env, dibersihkan; kosong/tidak sah = tombol Pindah web tidak tampil. */
export function gatewayUrl(value = process.env.GATEWAY_PUBLIC_URL): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * Tombol "Pindah web" (spec F2-7a §4) mengarah ke gateway, yang menampilkan daftar web sesuai hak. Hanya tampil
 * bila akun punya web lain: tautan selain HRIS, atau web Logistik/HRIS pasangannya (spec F2-7b §6); daftar dan aturan
 * haknya tetap dihitung Back Office.
 */
export async function webSwitchUrl(accountId: number, web: 'hris' | 'logistik' = 'hris', otherWeb = false): Promise<string | null> {
  const base = gatewayUrl();
  if (!base) return null;
  if (web === 'logistik' || otherWeb) return `${base}/?dari=${web}`;
  const rows = await db.execute<{ found: number }>(sql`select 1 as found from auth.account_links
    where account_id = ${accountId} and app_code <> 'hris' and revoked_at is null limit 1`);
  return rows.length ? `${base}/?dari=hris` : null;
}
