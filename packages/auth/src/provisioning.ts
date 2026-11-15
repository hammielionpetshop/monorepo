import { createHash } from 'node:crypto';
import type { Sql } from 'postgres';
import { audit, failure } from './sessions';
import type { AuthResult } from './sessions';

export type ProvisionInput = {
  idempotencyKey: string;
  localUserId: number;
  username: string | null;
  email: string | null;
  // Hash argon2 yang sudah dipakai backoffice; disalin apa adanya, tidak pernah dibuat di sini.
  passwordHash: string | null;
  mustChangePassword: boolean;
  isActive: boolean;
  actorAccountId: number | null;
};

const KEY_PATTERN = /^[A-Za-z0-9_.:-]{8,100}$/;

function normalize(identifier: string | null): string | null {
  const value = typeof identifier === 'string' ? identifier.trim().toLowerCase() : '';
  return value || null;
}

/**
 * Membuat akun pusat dan tautan backoffice untuk satu user lokal. Aman diulang: kunci
 * idempotensi yang sama mengembalikan akun yang sama; user yang sudah bertaut tidak diduplikasi.
 * Pemanggil (pintu internal backoffice) wajib sudah memverifikasi hak pelaku.
 */
export async function provisionBackofficeAccount(sql: Sql, input: ProvisionInput): Promise<AuthResult<{ accountId: number; created: boolean }>> {
  const username = normalize(input.username);
  const email = normalize(input.email);
  if (!KEY_PATTERN.test(input.idempotencyKey) || !Number.isSafeInteger(input.localUserId) || input.localUserId <= 0
    || (!username && !email) || (username?.length ?? 0) > 50 || (email?.length ?? 0) > 255) {
    return failure('INVALID_REQUEST');
  }
  const requestHash = createHash('sha256').update(JSON.stringify(['backoffice', input.localUserId, username, email])).digest('hex');

  return await sql.begin(async (tx) => {
    // Satu user lokal diproses satu per satu agar dua kunci berbeda tidak membuat dua akun.
    await tx`select pg_advisory_xact_lock(hashtext('auth.provision.backoffice'), ${input.localUserId})`;

    const inserted = await tx`insert into auth.provisioning_requests
      (idempotency_key, request_hash, app_code, local_user_id, actor_account_id)
      values (${input.idempotencyKey}, ${requestHash}, 'backoffice', ${input.localUserId}, ${input.actorAccountId})
      on conflict (idempotency_key) do nothing returning id`;
    const [request] = inserted.length ? inserted : await tx`select id, request_hash, account_id from auth.provisioning_requests
      where idempotency_key = ${input.idempotencyKey}`;
    if (!inserted.length && request.request_hash !== requestHash) return failure('IDEMPOTENCY_CONFLICT');
    if (!inserted.length && request.account_id) return { ok: true, accountId: request.account_id, created: false };

    const complete = async (accountId: number, created: boolean) => {
      await tx`update auth.provisioning_requests set account_id = ${accountId}, completed_at = now() where id = ${request.id}`;
      return { ok: true as const, accountId, created };
    };

    const [link] = await tx`select account_id, revoked_at from auth.account_links
      where app_code = 'backoffice' and local_user_id = ${input.localUserId}`;
    if (link) return link.revoked_at ? failure('LINK_CONFLICT') : await complete(link.account_id, false);

    const matches = await tx`select id, legacy_backoffice_user_id from auth.accounts
      where (${username}::text is not null and username = ${username}) or (${email}::text is not null and email = ${email})`;
    let accountId: number;
    let created = false;
    if (matches.length > 1) return failure('LINK_CONFLICT');
    if (matches.length === 1) {
      // Akun yatim hasil impor user ini boleh dilengkapi tautannya; akun milik orang lain tidak.
      if (matches[0].legacy_backoffice_user_id !== input.localUserId) return failure('LINK_CONFLICT');
      accountId = matches[0].id;
    } else {
      const [account] = await tx`insert into auth.accounts
        (username, email, password_hash, is_active, must_change_password, legacy_backoffice_user_id)
        values (${username}, ${email}, ${input.passwordHash}, ${input.isActive}, ${input.mustChangePassword}, ${input.localUserId})
        returning id`;
      accountId = account.id;
      created = true;
    }
    await tx`insert into auth.account_links (account_id, app_code, local_user_id)
      values (${accountId}, 'backoffice', ${input.localUserId})`;
    await audit(tx, accountId, input.actorAccountId, 'ACCOUNT_PROVISIONED',
      { appCode: 'backoffice', localUserId: input.localUserId, createdAccount: created },
      'Akun pusat dan tautan backoffice dibuat lewat pintu provisioning.');
    return await complete(accountId, created);
  });
}

/** Kontrak untuk layar L2: riwayat audit akun, terbaru lebih dulu, tanpa rahasia. */
export async function listAccountHistory(sql: Sql, accountId: number, limit = 50) {
  const rows = await sql`select id, action, actor_account_id, metadata, description, created_at
    from auth.audit_events where account_id = ${accountId} order by id desc limit ${Math.min(Math.max(limit, 1), 200)}`;
  return rows.map((row) => ({
    id: Number(row.id), action: String(row.action), actorAccountId: row.actor_account_id as number | null,
    metadata: row.metadata as Record<string, string | number | boolean | null>,
    description: String(row.description), createdAt: new Date(row.created_at),
  }));
}
