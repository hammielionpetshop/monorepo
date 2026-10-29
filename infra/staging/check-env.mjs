import { pathToFileURL } from 'node:url';

const applicationRoles = [
  ['STAGING_BACKOFFICE_DATABASE_URL', 'stg_bo_app'],
  ['STAGING_ORDER_DATABASE_URL', 'stg_order_app'],
  ['STAGING_HRIS_DATABASE_URL', 'stg_hris_app'],
];

function parseStagingUrl(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} tidak berisi URL database yang valid.`);
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || url.hostname !== 'postgres' || (url.port && url.port !== '5432')
    || url.pathname !== '/petshop_staging' || url.hash
    || ['host', 'hostaddr', 'port', 'user', 'password', 'database', 'dbname', 'service'].some((key) => url.searchParams.has(key))) {
    throw new Error(`${label} wajib menuju postgres:5432/petshop_staging tanpa penggantian target.`);
  }
  if (!url.username || !url.password) {
    throw new Error(`${label} wajib berisi pengguna dan password.`);
  }
  return url;
}

export function checkEnvironment(env) {
  const migrator = parseStagingUrl(env.DATABASE_URL, 'DATABASE_URL migrator');
  if (decodeURIComponent(migrator.username).startsWith('stg_')) {
    throw new Error('Migrator wajib memakai pemilik migrasi, bukan role aplikasi staging.');
  }
  for (const [key, role] of applicationRoles) {
    const url = parseStagingUrl(env[key], key);
    if (decodeURIComponent(url.username) !== role) {
      throw new Error(`${key} wajib memakai role ${role}.`);
    }
    const password = env[`${role.toUpperCase()}_DB_PASSWORD`];
    if (!password || decodeURIComponent(url.password) !== password) {
      throw new Error(`Password ${role} di migrator dan URL aplikasi wajib sama.`);
    }
  }
  if (!env.STAGING_JOB_SECRET) throw new Error('STAGING_JOB_SECRET wajib diisi.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    checkEnvironment(process.env);
    console.log('Tujuan database dan role staging valid.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
