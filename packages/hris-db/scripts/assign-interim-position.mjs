// Fixture terkontrol L2b: menetapkan jabatan (dan cabang) sementara untuk akun bertautan HRIS,
// supaya hak akses bisa diuji sebelum data karyawan L2c ada. Bukan jalur pengguna; tidak untuk produksi.
//
//   AUTH_COOKIE_ENV=local DATABASE_URL=... node scripts/assign-interim-position.mjs <username> "<jabatan>" --confirm-fixture [--branch "<cabang>"]
//   ... <username> --remove --confirm-fixture   menghapus penetapan sementara akun itu
import postgres from 'postgres';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const positional = args.filter((arg, i) => !arg.startsWith('--') && args[i - 1] !== '--branch');
const [username, positionName] = positional;
const environment = process.env.AUTH_COOKIE_ENV;

if (!username || !flag('--confirm-fixture') || (!flag('--remove') && !positionName)) {
  console.error('Pemakaian: assign-interim-position.mjs <username> "<jabatan>" --confirm-fixture [--branch "<cabang>"] | <username> --remove --confirm-fixture');
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
  const message = await sql.begin(async (tx) => {
    const [link] = await tx`select a.id as account_id, l.local_user_id from auth.accounts a
      join auth.account_links l on l.account_id = a.id and l.app_code = 'hris' and l.revoked_at is null
      where a.username = ${username.trim().toLowerCase()}`;
    if (!link) throw new Error('Akun tidak ditemukan atau belum punya tautan HRIS aktif (jalankan link-hris-fixture lebih dulu).');
    const [before] = await tx`select * from hris.interim_actor_positions where person_id = ${link.local_user_id} for update`;

    if (flag('--remove')) {
      if (!before) throw new Error('Akun ini tidak punya penetapan jabatan sementara.');
      await tx`delete from hris.interim_actor_positions where person_id = ${link.local_user_id}`;
      await tx`insert into hris.audit_events (actor_account_id, entity, entity_id, action, before, reason)
        values (${link.account_id}, 'interim_actor_position', ${link.local_user_id}, 'remove', ${tx.json(before)}, 'Fixture uji L2b')`;
      return 'Penetapan jabatan sementara dihapus.';
    }

    const [position] = await tx`select id, name from hris.positions where lower(name) = lower(${positionName}) and active`;
    if (!position) throw new Error(`Jabatan aktif "${positionName}" tidak ditemukan.`);
    let branchId = null;
    const branchName = option('--branch');
    if (branchName) {
      const [branch] = await tx`select id from hris.branches where lower(name) = lower(${branchName}) and active`;
      if (!branch) throw new Error(`Cabang aktif "${branchName}" tidak ditemukan.`);
      branchId = branch.id;
    }
    const [after] = await tx`insert into hris.interim_actor_positions (person_id, position_id, branch_id)
      values (${link.local_user_id}, ${position.id}, ${branchId})
      on conflict (person_id) do update set position_id = excluded.position_id, branch_id = excluded.branch_id, updated_at = now()
      returning *`;
    await tx`insert into hris.audit_events (actor_account_id, entity, entity_id, action, before, after, reason)
      values (${link.account_id}, 'interim_actor_position', ${link.local_user_id}, ${before ? 'update' : 'create'},
        ${before ? tx.json(before) : null}, ${tx.json(after)}, 'Fixture uji L2b')`;
    return `Jabatan sementara ${username}: ${position.name}${branchName ? `, cabang ${branchName}` : ''}.`;
  });
  console.log(message);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
