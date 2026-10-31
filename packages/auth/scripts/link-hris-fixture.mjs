// Fixture terkontrol L1d: menautkan akun pusat ke HRIS untuk menguji akses sebelum data karyawan (L2).
// Bukan jalur pengguna: tautan ini bukan karyawan nyata dan tidak boleh dipakai di produksi.
//
//   AUTH_COOKIE_ENV=local DATABASE_URL=... node scripts/link-hris-fixture.mjs <username> --confirm-fixture
//   ... --revoke   mencabut tautan fixture yang sama (sesi HRIS akun itu ikut ditutup)
import postgres from 'postgres';

const [username, ...flags] = process.argv.slice(2);
const environment = process.env.AUTH_COOKIE_ENV;

if (!username || !flags.includes('--confirm-fixture')) {
  console.error('Pemakaian: link-hris-fixture.mjs <username> --confirm-fixture [--revoke]');
  process.exit(2);
}
if (environment !== 'local' && environment !== 'staging') {
  console.error('Ditolak: fixture hanya untuk AUTH_COOKIE_ENV=local atau staging.');
  process.exit(2);
}
if (!process.env.DATABASE_URL) {
  console.error('Ditolak: DATABASE_URL wajib diisi.');
  process.exit(2);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
try {
  await sql.begin(async (tx) => {
    const [account] = await tx`select id from auth.accounts where username = ${username.trim().toLowerCase()} for update`;
    if (!account) throw new Error('Akun tidak ditemukan.');
    const [existing] = await tx`select id, revoked_at from auth.account_links where account_id = ${account.id} and app_code = 'hris'`;
    if (flags.includes('--revoke')) {
      if (!existing || existing.revoked_at) throw new Error('Tidak ada tautan fixture aktif untuk dicabut.');
      await tx`update auth.account_links set revoked_at = now() where id = ${existing.id}`;
      await tx`update auth.session_app_access set revoked_at = now(), revoked_reason = 'LINK_REVOKED'
        where account_link_id = ${existing.id} and revoked_at is null`;
      await tx`insert into auth.audit_events (account_id, action, metadata, description)
        values (${account.id}, 'LINK_REVOKED', '{"appCode":"hris","fixture":true}'::jsonb, 'Tautan HRIS fixture dicabut.')`;
      return;
    }
    if (existing) throw new Error('Akun sudah memiliki tautan HRIS (aktif atau dicabut); tidak ditimpa.');
    // local_user_id fixture = id akun; L2 menggantinya dengan id karyawan sungguhan lewat prosedur resmi.
    await tx`insert into auth.account_links (account_id, app_code, local_user_id) values (${account.id}, 'hris', ${account.id})`;
    await tx`insert into auth.audit_events (account_id, action, metadata, description)
      values (${account.id}, 'LINK_CREATED', '{"appCode":"hris","fixture":true}'::jsonb, 'Tautan HRIS fixture dibuat untuk uji akses L1d.')`;
  });
  console.log(flags.includes('--revoke') ? 'Tautan fixture dicabut.' : 'Tautan fixture dibuat.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
