// Jalan kembali dari mode auth `central` ke `legacy` (HRIS L1c, spec L1 §6).
//
// Membalik env saja tidak cukup: sesi pusat yang hidup dan sesi legacy lama (yang tidak
// dipelihara selama mode central) dapat menghidupkan kembali akses yang sudah dicabut.
// Skrip ini mencabut keduanya agar semua orang login ulang, dan menyalin hash password dari
// akun pusat ke tabel lama supaya password yang dibuat/diganti selama central tetap berlaku.
// Hanya angka yang dilaporkan; tidak ada hash, identifier, atau token pada keluaran.

export async function inspectRollback(sql) {
  const [central] = await sql`select count(*)::int as total from auth.sessions
    where revoked_at is null and expires_at > clock_timestamp()`;
  const [legacy] = await sql`select count(*)::int as total from petshop.user_sessions where revoked_at is null`;
  const [passwords] = await sql`select count(*)::int as total
    from petshop.users u
    join auth.account_links l on l.local_user_id = u.id and l.app_code = 'backoffice' and l.revoked_at is null
    join auth.accounts a on a.id = l.account_id
    where a.password_hash is not null and u.password_hash is distinct from a.password_hash`;
  const [flags] = await sql`select count(*)::int as total
    from petshop.users u
    join auth.account_links l on l.local_user_id = u.id and l.app_code = 'backoffice' and l.revoked_at is null
    join auth.accounts a on a.id = l.account_id
    where a.is_active is distinct from u.is_active`;
  const [unlinked] = await sql`select count(*)::int as total from petshop.users u
    where u.is_active and not exists (
      select 1 from auth.account_links l where l.local_user_id = u.id and l.app_code = 'backoffice' and l.revoked_at is null)`;
  return {
    activeCentralSessions: central.total,
    activeLegacySessions: legacy.total,
    passwordHashMismatches: passwords.total,
    activeStateMismatches: flags.total,
    activeUsersWithoutLink: unlinked.total,
  };
}

export async function rollbackToLegacy(sql) {
  return await sql.begin(async (tx) => {
    // Kunci akun terdampak lebih dulu agar login serentak tidak menyisipkan sesi baru di tengah.
    await tx`select id from auth.accounts order by id for update`;
    const revokedCentral = await tx`update auth.sessions
      set revoked_at = clock_timestamp(), revoked_reason = 'ROLLBACK'
      where revoked_at is null returning account_id`;
    const perAccount = new Map();
    for (const row of revokedCentral) perAccount.set(row.account_id, (perAccount.get(row.account_id) ?? 0) + 1);
    for (const [accountId, count] of perAccount) {
      await tx`insert into auth.audit_events (account_id, actor_account_id, action, metadata, description)
        values (${accountId}, null, 'ROLLBACK_REVOKED', ${JSON.stringify({ sessionsRevoked: count })}::text::jsonb,
          'Sesi pusat dicabut saat kembali ke mode legacy.')`;
    }
    const revokedLegacy = await tx`update petshop.user_sessions
      set revoked_at = (now() at time zone 'UTC'), revoked_reason = 'ROLLBACK'
      where revoked_at is null returning id`;
    const synced = await tx`update petshop.users u
      set password_hash = a.password_hash, must_change_credentials = a.must_change_password,
        updated_at = (now() at time zone 'UTC')
      from auth.account_links l join auth.accounts a on a.id = l.account_id
      where l.local_user_id = u.id and l.app_code = 'backoffice' and l.revoked_at is null
        and a.password_hash is not null and u.password_hash is distinct from a.password_hash
      returning u.id`;
    return {
      centralSessionsRevoked: revokedCentral.length,
      legacySessionsRevoked: revokedLegacy.length,
      passwordHashesSynced: synced.length,
    };
  });
}
