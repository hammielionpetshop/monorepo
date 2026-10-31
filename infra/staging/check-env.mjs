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
  checkAuth(env);
}

const STAGING_HOST = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.staginghml\.my\.id$/;

function stagingOrigin(value, label) {
  let url;
  try { url = new URL(value ?? ''); } catch { throw new Error(`${label} bukan origin yang valid.`); }
  if (url.protocol !== 'https:' || url.origin !== value || !STAGING_HOST.test(url.hostname)) {
    throw new Error(`${label} wajib https dan subdomain staginghml.my.id (tanpa path).`);
  }
  return url;
}

// Auth pusat (HRIS L1). Mode legacy tidak menuntut apa pun; central menuntut set lengkap yang
// terkunci ke staging sehingga cookie/secret produksi tidak bisa terbawa ke sini.
export function checkAuth(env) {
  const mode = env.STAGING_BO_AUTH_MODE || 'legacy';
  if (mode !== 'legacy' && mode !== 'central') throw new Error('STAGING_BO_AUTH_MODE harus legacy atau central.');
  if (mode === 'legacy') return;
  if (env.STAGING_AUTH_COOKIE_DOMAIN !== '.staginghml.my.id') {
    throw new Error('STAGING_AUTH_COOKIE_DOMAIN wajib .staginghml.my.id pada mode central.');
  }
  const bo = stagingOrigin(env.STAGING_BO_ORIGIN, 'STAGING_BO_ORIGIN');
  const hris = stagingOrigin(env.STAGING_HRIS_ORIGIN, 'STAGING_HRIS_ORIGIN');
  if (bo.origin === hris.origin) throw new Error('Origin backoffice dan HRIS staging harus berbeda.');
  for (const key of ['STAGING_BO_CSRF_SECRET', 'STAGING_HRIS_CSRF_SECRET', 'STAGING_HRIS_INTERNAL_KEY']) {
    if (!env[key] || env[key].length < 32) throw new Error(`${key} wajib diisi minimal 32 karakter.`);
  }
  const secrets = [env.STAGING_BO_CSRF_SECRET, env.STAGING_HRIS_CSRF_SECRET, env.STAGING_HRIS_INTERNAL_KEY];
  if (new Set(secrets).size !== secrets.length) throw new Error('Rahasia CSRF dan kunci internal staging harus berbeda satu sama lain.');
  if (secrets.includes(env.STAGING_JOB_SECRET)) throw new Error('Rahasia auth staging tidak boleh sama dengan STAGING_JOB_SECRET.');
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
