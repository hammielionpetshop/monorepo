import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkEnvironment } from './check-env.mjs';

function environment() {
  return {
    DATABASE_URL: 'postgresql://admin:admin-test@postgres:5432/petshop_staging',
    STAGING_BACKOFFICE_DATABASE_URL: 'postgresql://stg_bo_app:bo-test@postgres:5432/petshop_staging',
    STAGING_ORDER_DATABASE_URL: 'postgresql://stg_order_app:order-test@postgres:5432/petshop_staging',
    STAGING_HRIS_DATABASE_URL: 'postgresql://stg_hris_app:hris-test@postgres:5432/petshop_staging',
    STG_BO_APP_DB_PASSWORD: 'bo-test',
    STG_ORDER_APP_DB_PASSWORD: 'order-test',
    STG_HRIS_APP_DB_PASSWORD: 'hris-test',
    STAGING_JOB_SECRET: 'test-only',
  };
}

test('menerima database staging dan pasangan role/password yang benar', () => {
  assert.doesNotThrow(() => checkEnvironment(environment()));
});

test('menolak database produksi pada semua URL sebelum migrasi', () => {
  for (const key of ['DATABASE_URL', 'STAGING_BACKOFFICE_DATABASE_URL', 'STAGING_ORDER_DATABASE_URL', 'STAGING_HRIS_DATABASE_URL']) {
    const env = environment();
    env[key] = env[key].replace('/petshop_staging', '/petshop_db');
    assert.throws(() => checkEnvironment(env), /petshop_staging/);
  }
});

test('menolak hostname/port asing dan URL tanpa password', () => {
  for (const value of [
    'postgresql://admin:secret@other-host/petshop_staging',
    'postgresql://admin:secret@postgres:6432/petshop_staging',
    'postgresql://admin@postgres/petshop_staging',
    'https://admin:secret@postgres/petshop_staging',
    'postgresql://admin:secret@postgres/petshop_staging#other',
    '', undefined,
  ]) {
    const env = { ...environment(), DATABASE_URL: value };
    assert.throws(() => checkEnvironment(env));
  }
});

test('menolak penggantian target melalui query URL termasuk nama kunci terenkode', () => {
  for (const query of ['host=production', 'database=petshop_db', 'dbname=petshop_db', 'user=admin', '%75ser=admin', 'port=5433', 'service=production']) {
    const env = environment();
    env.DATABASE_URL += `?${query}`;
    assert.throws(() => checkEnvironment(env), /tanpa penggantian target/);
  }
});

test('setiap aplikasi hanya boleh memakai role staging miliknya', () => {
  for (const key of ['STAGING_BACKOFFICE_DATABASE_URL', 'STAGING_ORDER_DATABASE_URL', 'STAGING_HRIS_DATABASE_URL']) {
    const env = environment();
    env[key] = env[key].replace(/\/\/[^:]+:/, '//admin:');
    assert.throws(() => checkEnvironment(env), /wajib memakai role stg_/);
  }
});

test('role aplikasi tidak boleh menjadi pemilik migrasi', () => {
  const env = environment();
  env.DATABASE_URL = env.STAGING_BACKOFFICE_DATABASE_URL;
  assert.throws(() => checkEnvironment(env), /pemilik migrasi/);
});

test('password migrator untuk role staging harus sama dengan URL aplikasi', () => {
  for (const key of ['STG_BO_APP_DB_PASSWORD', 'STG_ORDER_APP_DB_PASSWORD', 'STG_HRIS_APP_DB_PASSWORD']) {
    for (const value of ['', 'mismatch']) {
      assert.throws(() => checkEnvironment({ ...environment(), [key]: value }), /wajib sama/);
    }
  }
});

test('password URL terenkode dibandingkan sebagai nilai asli tanpa membocorkannya', () => {
  const env = environment();
  env.STAGING_HRIS_DATABASE_URL = 'postgres://stg_hris_app:password%40dengan%3Akarakter@postgres/petshop_staging';
  env.STG_HRIS_APP_DB_PASSWORD = 'password@dengan:karakter';
  assert.doesNotThrow(() => checkEnvironment(env));
  env.STG_HRIS_APP_DB_PASSWORD = 'mismatch';
  assert.throws(() => checkEnvironment(env), (error) => !error.message.includes('password@dengan:karakter'));
});

test('menolak kunci job staging kosong', () => {
  assert.throws(() => checkEnvironment({ ...environment(), STAGING_JOB_SECRET: '' }), /STAGING_JOB_SECRET/);
});
