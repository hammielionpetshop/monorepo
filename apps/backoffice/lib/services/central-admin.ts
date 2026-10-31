import { deactivateAccount, resetPassword } from '@petshop/auth';
import { getDefaultCredentials } from '@/lib/app-settings';
import { getAuthSql, readCentralToken } from '@/lib/central-auth';
import { findAccountIdForUser } from '@/lib/services/central-session';

type Change = { targetUserId: number; actorRole: string; isActive?: boolean; resetCredentials?: boolean };

/**
 * Menyalin perubahan Pengguna (nonaktif/aktif/reset kredensial) ke akun pusat pada mode
 * central. Dipanggil SETELAH tabel `users` diperbarui. Mengembalikan pesan galat, atau null
 * bila selesai / user belum punya akun pusat (provisioning akun menyusul di L1d).
 *
 * Nonaktif dan reset mencabut seluruh sesi akun lewat layanan pusat sehingga akses langsung
 * ditolak. Pelaku harus OWNER/GM dengan sesi backoffice pusat yang aktif.
 */
export async function applyAccountChange(change: Change): Promise<string | null> {
  const accountId = await findAccountIdForUser(change.targetUserId);
  if (accountId === null) return null;

  const token = await readCentralToken();
  if (!token || (change.actorRole !== 'OWNER' && change.actorRole !== 'GM')) {
    return 'Hanya Owner atau GM dengan sesi pusat aktif yang dapat mengubah akun pusat.';
  }
  const actor = { token, role: change.actorRole } as const;
  const sql = getAuthSql();

  if (change.isActive === false) {
    const result = await deactivateAccount(sql, { accountId, actor });
    if (!result.ok) return result.error;
  }

  if (change.resetCredentials === true) {
    const { password } = await getDefaultCredentials();
    if (password.length < 8) return 'Password default kurang dari 8 karakter; ubah dulu di pengaturan sebelum reset.';
    const result = await resetPassword(sql, { accountId, newPassword: password, actor });
    if (!result.ok) return result.error;
  }

  if (change.isActive === true) {
    // Layanan pusat belum punya "aktifkan kembali"; ubah langsung + jejak audit dalam satu transaksi.
    const [actorLink] = await sql`select s.account_id from auth.sessions s
      where s.token_hash = encode(sha256(convert_to(${token}, 'UTF8')), 'hex') and s.revoked_at is null`;
    await sql.begin(async (tx) => {
      await tx`update auth.accounts set is_active = true, updated_at = now() where id = ${accountId}`;
      await tx`insert into auth.audit_events (account_id, actor_account_id, action, metadata, description)
        values (${accountId}, ${actorLink?.account_id ?? null}, 'ACCOUNT_ENABLED',
          ${JSON.stringify({ beforeIsActive: false, afterIsActive: true })}::text::jsonb, 'Akun diaktifkan kembali oleh pelaku berhak.')`;
    });
  }
  return null;
}
