import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
const script = readFileSync(new URL('./refresh-db.sh', import.meta.url), 'utf8');

function runRefresh(args = [], additions = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'staging-refresh-test-'));
  const log = join(directory, 'docker.log');
  writeFileSync(join(directory, 'refresh-db.sh'), script);
  writeFileSync(join(directory, 'flock'), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 });
  writeFileSync(join(directory, 'docker'), `#!/usr/bin/env bash
set -eu
printf '%s\\n' "$*" >> "$TEST_DOCKER_LOG"
case "$*" in
  *check-env.mjs*) [ "\${TEST_FAIL_GUARD:-0}" != 1 ] ;;
  *"ps -q postgres"*) printf 'abcdef123456abcdef123456\\n' ;;
  *com.docker.compose.project*) printf 'hammielion\\n' ;;
  *com.docker.compose.service*) printf 'postgres\\n' ;;
  *"-d postgres -At"*) printf '%s\\n' "\${TEST_STAGING_EXISTS:-0}" ;;
  *pg_dump*) [ "\${TEST_FAIL_DUMP:-0}" != 1 ]; printf 'dump-placeholder' ;;
  *"pg_restore --list"*) [ "\${TEST_FAIL_LIST:-0}" != 1 ] ;;
esac
`, { mode: 0o755 });
  try {
    const result = spawnSync(bash, ['--noprofile', join(directory, 'refresh-db.sh'), ...args], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${directory}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`,
        TEST_DOCKER_LOG: log.replaceAll('\\', '/'),
        ...additions,
      },
    });
    if (result.error) throw result.error;
    return { ...result, log: existsSync(log) ? readFileSync(log, 'utf8') : '' };
  } finally {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    rmSync(directory, { recursive: true, force: true });
  }
}

test('argumen target ditolak sebelum perintah Docker apa pun', () => {
  const result = runRefresh(['petshop_db']);
  assert.equal(result.status, 1);
  assert.equal(result.log, '');
});

test('--check tidak menyalin atau mengganti database', () => {
  const result = runRefresh(['--check']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.log, /check-env\.mjs/);
  assert.doesNotMatch(result.log, /pg_dump|dropdb|createdb| stop /);
});

test('kegagalan palang URL menghentikan refresh sebelum backup/reset', () => {
  const result = runRefresh([], { TEST_FAIL_GUARD: '1' });
  assert.equal(result.status, 1);
  assert.match(result.log, /check-env\.mjs/);
  assert.doesNotMatch(result.log, /pg_dump|dropdb|createdb| stop /);
});

test('dump gagal atau tidak valid tidak menghentikan aplikasi dan tidak menghapus staging', () => {
  for (const additions of [{ TEST_FAIL_DUMP: '1' }, { TEST_FAIL_LIST: '1' }]) {
    const result = runRefresh([], additions);
    assert.equal(result.status, 1);
    assert.match(result.log, /pg_dump/);
    assert.doesNotMatch(result.log, /dropdb|createdb| stop /);
  }
});

test('dump divalidasi sebelum reset, dan hanya petshop_staging menjadi target mutasi', () => {
  const result = runRefresh();
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.log.indexOf('pg_dump') < result.log.indexOf('pg_restore --list'));
  assert.ok(result.log.indexOf('pg_restore --list') < result.log.indexOf(' stop '));
  assert.ok(result.log.indexOf(' stop ') < result.log.indexOf('dropdb'));
  assert.match(result.log, /dropdb[^\n]*petshop_staging/);
  assert.match(result.log, /createdb[^\n]*petshop_staging/);
  assert.doesNotMatch(result.log, /(?:dropdb|createdb|psql|pg_restore)[^\n]*petshop_db/);
  assert.doesNotMatch(result.log, / stop (?:postgres|backoffice|order-web)(?: |$)/);
});

test('bootstrap hanya membuat snapshot staging awal tanpa image, reset, migrasi atau app start', () => {
  const result = runRefresh(['--bootstrap']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.log, /pg_dump/);
  assert.match(result.log, /createdb[^\n]*petshop_staging/);
  assert.doesNotMatch(result.log, /check-env|migrator-staging|dropdb| stop | up -d /);
  assert.ok(result.log.indexOf('pg_restore --list') < result.log.indexOf('createdb'));
});

test('bootstrap menolak database staging yang sudah ada sebelum dump atau perubahan', () => {
  const result = runRefresh(['--bootstrap'], { TEST_STAGING_EXISTS: '1' });
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.log, /pg_dump|dropdb|createdb| stop | up -d /);
});

test('bootstrap dengan dump gagal atau tidak valid tidak membuat database', () => {
  for (const additions of [{ TEST_FAIL_DUMP: '1' }, { TEST_FAIL_LIST: '1' }]) {
    const result = runRefresh(['--bootstrap'], additions);
    assert.equal(result.status, 1);
    assert.match(result.log, /pg_dump/);
    assert.doesNotMatch(result.log, /dropdb|createdb| stop | up -d /);
  }
});
