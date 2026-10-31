async function inspectLegacyAccounts(sql) {
  const sourceUsers = await sql`
    select id, username, email, password_hash, is_active, must_change_credentials
    from petshop.users order by id
  `;
  const users = sourceUsers.map((user) => ({
    ...user,
    username: user.username?.trim().toLowerCase() || null,
    email: user.email?.trim().toLowerCase() || null,
  }));
  const accounts = await sql`select id, username, email, legacy_backoffice_user_id from auth.accounts`;
  const links = await sql`select account_id, local_user_id from auth.account_links where app_code = 'backoffice'`;
  const linkedUsers = new Set(links.map((link) => link.local_user_id));
  const sourceUserIds = new Set(users.map((user) => user.id));
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const pending = users.filter((user) => !linkedUsers.has(user.id));
  const identifiers = new Map();
  function addIdentifier(identifier, kind, id) {
    if (!identifier) return;
    const owners = identifiers.get(identifier) ?? { sourceUserIds: new Set(), accountIds: new Set() };
    owners[kind].add(id);
    identifiers.set(identifier, owners);
  }
  for (const user of pending) {
    addIdentifier(user.username, 'sourceUserIds', user.id);
    addIdentifier(user.email, 'sourceUserIds', user.id);
  }
  for (const account of accounts) {
    addIdentifier(account.username, 'accountIds', account.id);
    addIdentifier(account.email, 'accountIds', account.id);
  }
  const conflicts = [];
  for (const link of links) {
    const account = accountsById.get(link.account_id);
    if (!sourceUserIds.has(link.local_user_id) || !account ||
      (account.legacy_backoffice_user_id !== null && account.legacy_backoffice_user_id !== link.local_user_id)) {
      conflicts.push({ code: 'LINK_INCONSISTENT', sourceUserIds: [link.local_user_id], accountIds: [link.account_id] });
    }
  }
  for (const owners of identifiers.values()) {
    if (owners.sourceUserIds.size && (owners.sourceUserIds.size > 1 || owners.accountIds.size)) {
      conflicts.push({
        code: 'IDENTIFIER_CONFLICT',
        sourceUserIds: [...owners.sourceUserIds],
        accountIds: [...owners.accountIds],
      });
    }
  }
  // Jejak impor tanpa tautan tidak boleh diam-diam menghasilkan akun pusat kedua.
  for (const account of accounts) {
    if (pending.some((user) => user.id === account.legacy_backoffice_user_id)) {
      conflicts.push({ code: 'IMPORT_LINK_MISSING', sourceUserIds: [account.legacy_backoffice_user_id], accountIds: [account.id] });
    }
  }
  return {
    pending,
    report: {
      sourceCount: users.length,
      activeCount: users.filter((user) => user.is_active).length,
      inactiveCount: users.filter((user) => !user.is_active).length,
      mustChangePasswordCount: users.filter((user) => user.must_change_credentials).length,
      linkedCount: users.length - pending.length,
      pendingCount: pending.length,
      passwordlessCount: pending.filter((user) => user.password_hash === null).length,
      missingIdentifierCount: pending.filter((user) => !user.username && !user.email).length,
      canApply: conflicts.length === 0,
      conflicts,
    },
  };
}

export async function preflightLegacyAccounts(sql) {
  return sql.begin('isolation level repeatable read read only', async (transaction) => {
    const { report } = await inspectLegacyAccounts(transaction);
    return report;
  });
}

export async function backfillLegacyAccounts(sql) {
  return sql.begin(async (transaction) => {
    // Impor jarang dijalankan; kunci tabel mencegah sumber/tujuan berubah sesudah preflight.
    await transaction`lock table petshop.users in share mode`;
    await transaction`lock table auth.accounts, auth.account_links in share row exclusive mode`;
    const { pending, report } = await inspectLegacyAccounts(transaction);
    if (!report.canApply) {
      const error = new Error('Impor akun ditolak: ada konflik pada preflight.');
      error.report = report;
      throw error;
    }
    for (const user of pending) {
      const [account] = await transaction`
        insert into auth.accounts
          (username, email, password_hash, is_active, must_change_password, legacy_backoffice_user_id, imported_at)
        values (${user.username}, ${user.email}, ${user.password_hash}, ${user.is_active},
          ${user.must_change_credentials}, ${user.id}, now()) returning id
      `;
      await transaction`
        insert into auth.account_links (account_id, app_code, local_user_id)
        values (${account.id}, 'backoffice', ${user.id})
      `;
    }
    return { ...report, importedCount: pending.length };
  });
}
