// Fixture terkontrol L2c (pengganti assign-interim-position L2b): menjadikan akun bertautan HRIS sebagai
// karyawan fixture dengan jabatan/cabang tertentu, untuk menguji hak akses sebelum Akun & Tautan (L2d).
// Bukan jalur pengguna; tidak untuk produksi. Data tidak dihapus: nonaktifkan lewat layar HRIS.
//
//   AUTH_COOKIE_ENV=local DATABASE_URL=... node scripts/assign-fixture-employee.mjs <username> "<jabatan>" --confirm-fixture [--branch "<cabang>"]
//
// Belum ada → karyawan fixture baru (id = local_user_id tautan HRIS, bergabung hari ini, status Karyawan).
// Sudah ada (fixture) → catatan penempatan baru bertanggal hari ini.
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

if (!username || !positionName || !flag('--confirm-fixture')) {
  console.error('Pemakaian: assign-fixture-employee.mjs <username> "<jabatan>" --confirm-fixture [--branch "<cabang>"]');
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
    const [link] = await tx`select a.id as account_id, a.username, l.local_user_id from auth.accounts a
      join auth.account_links l on l.account_id = a.id and l.app_code = 'hris' and l.revoked_at is null
      where a.username = ${username.trim().toLowerCase()}`;
    if (!link) throw new Error('Akun tidak ditemukan atau belum punya tautan HRIS aktif (jalankan link-hris-fixture lebih dulu).');
    const employeeId = link.local_user_id;

    const [position] = await tx`select id, name from hris.positions where lower(name) = lower(${positionName}) and active`;
    if (!position) throw new Error(`Jabatan aktif "${positionName}" tidak ditemukan.`);
    const branchName = option('--branch');
    const [branch] = branchName
      ? await tx`select id, name from hris.branches where lower(name) = lower(${branchName}) and active`
      : await tx`select id, name from hris.branches where active order by id limit 1`;
    if (!branch) throw new Error(branchName ? `Cabang aktif "${branchName}" tidak ditemukan.` : 'Belum ada cabang aktif; buat cabang lebih dulu.');
    const [{ today }] = await tx`select (now() at time zone 'Asia/Jakarta')::date::text as today`;

    const [existing] = await tx`select id, source from hris.employees where id = ${employeeId} for update`;
    if (existing && existing.source !== 'FIXTURE') {
      throw new Error(`Karyawan #${employeeId} bukan data fixture; penempatannya diubah lewat layar HRIS.`);
    }
    if (!existing) {
      const [employee] = await tx`insert into hris.employees (id, code, name, joined_on, source)
        values (${employeeId}, hris.next_employee_code(), ${link.username}, ${today}, 'FIXTURE') returning *`;
      await tx`select setval('hris.employees_id_seq', greatest((select max(id) from hris.employees), 1))`;
      const [placement] = await tx`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from, reason)
        values (${employeeId}, 'INITIAL', ${branch.id}, ${position.id}, 'EMPLOYEE', ${today}, 'Fixture uji L2c') returning *`;
      await tx`insert into hris.audit_events (actor_account_id, entity, entity_id, action, after, reason)
        values (${link.account_id}, 'employee', ${employeeId}, 'create', ${tx.json({ employee, placement })}, 'Fixture uji L2c')`;
      return `Karyawan fixture ${employee.code} dibuat: ${position.name} di ${branch.name}.`;
    }

    const [current] = await tx`select branch_id, position_id, work_status from hris.placements
      where employee_id = ${employeeId} and cancelled_at is null and effective_from <= ${today}
      order by effective_from desc, id desc limit 1`;
    if (current && current.branch_id === branch.id && current.position_id === position.id) {
      return 'Penempatan fixture sudah sesuai; tidak ada perubahan.';
    }
    const kind = current && current.position_id === position.id ? 'BRANCH' : 'POSITION';
    const [placement] = await tx`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from, reason)
      values (${employeeId}, ${kind}, ${branch.id}, ${position.id}, ${current?.work_status ?? 'EMPLOYEE'}, ${today}, 'Fixture uji L2c') returning *`;
    await tx`insert into hris.audit_events (actor_account_id, entity, entity_id, action, before, after, reason)
      values (${link.account_id}, 'placement', ${placement.id}, 'record', ${tx.json(current ?? null)}, ${tx.json(placement)}, 'Fixture uji L2c')`;
    return `Penempatan fixture dicatat: ${position.name} di ${branch.name} mulai hari ini.`;
  });
  console.log(message);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
