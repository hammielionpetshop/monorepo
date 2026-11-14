import { describeSession, openAppAccess } from '@petshop/auth';
import { db, users, roles, eq } from '@/lib/db';
import { backofficePolicy, getAuthSql } from '@/lib/central-auth';
import { listWebs, webUrlsFromEnv, type WebCode, type WebEntry } from '@/lib/web-access';

export type GatewayView = {
  name: string;
  mustChangePassword: boolean;
  /** Ke mana ganti password awal dilakukan: POS (password + PIN) atau HRIS. */
  changePasswordAt: 'pos' | 'hris' | null;
  webs: WebEntry[];
};

async function loadBackofficeUser(localUserId: number | undefined) {
  if (!localUserId) return null;
  const [row] = await db
    .select({ name: users.name, isActive: users.isActive, role: roles.name })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(eq(users.id, localUserId))
    .limit(1);
  return row ?? null;
}

/** Daftar web untuk sesi pusat ini, atau null bila sesinya tidak hidup. */
export async function loadGatewayView(token: string): Promise<GatewayView | null> {
  const sql = getAuthSql();
  const session = await describeSession(sql, token);
  if (!session.ok) return null;
  const backofficeLink = session.links.find((link) => link.appCode === 'backoffice');
  const backofficeUser = await loadBackofficeUser(backofficeLink?.localUserId);
  const [account] = await sql`select username, email from auth.accounts where id = ${session.accountId}`;
  const urls = webUrlsFromEnv();
  const webs = listWebs({ authMethod: session.authMethod, links: session.links, backofficeUser }, urls);
  const hasHris = session.links.some((link) => link.appCode === 'hris');
  return {
    name: backofficeUser?.name ?? account?.username ?? account?.email ?? 'Pengguna',
    mustChangePassword: session.mustChangePassword,
    changePasswordAt: !session.mustChangePassword ? null
      : backofficeUser?.isActive && urls.pos ? 'pos' : hasHris && urls.hris ? 'hris' : null,
    webs,
  };
}

export type OpenResult = { ok: true; url: string } | { ok: false; status: number; error: string };

/**
 * Buka akses web tujuan dari sesi pusat yang sama, tanpa login ulang. POS dibuka oleh bootstrap
 * Back Office saat orangnya tiba; HRIS dan Finance dibuka di sini karena keduanya hanya membaca
 * akses yang sudah ada di sesi.
 */
export async function openWeb(token: string, code: WebCode): Promise<OpenResult> {
  const view = await loadGatewayView(token);
  if (!view) return { ok: false, status: 401, error: 'Sesi tidak valid, silakan masuk kembali.' };
  if (view.mustChangePassword) return { ok: false, status: 403, error: 'Ganti password awal sebelum membuka aplikasi.' };
  const web = view.webs.find((entry) => entry.code === code);
  if (!web) return { ok: false, status: 403, error: 'Akun belum memiliki akses ke web ini.' };
  if (web.needsPassword) return { ok: false, status: 403, error: 'Masuk dengan password untuk membuka HRIS.' };

  const sql = getAuthSql();
  if (code === 'hris') {
    const opened = await openAppAccess(sql, token, 'hris');
    if (!opened.ok) return { ok: false, status: 403, error: opened.error };
  } else if (code === 'finance') {
    const session = await describeSession(sql, token);
    const link = session.ok ? session.links.find((entry) => entry.appCode === 'backoffice') : undefined;
    const user = await loadBackofficeUser(link?.localUserId);
    if (!user) return { ok: false, status: 403, error: 'Akun belum memiliki akses ke web ini.' };
    const opened = await openAppAccess(sql, token, 'backoffice', backofficePolicy(user.role));
    if (!opened.ok) return { ok: false, status: 403, error: opened.error };
  }
  return { ok: true, url: web.url };
}
