import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';
import { findViolations } from '../../../scripts/check-module-boundaries.mjs';

const appDir = fileURLToPath(new URL('..', import.meta.url));

describe('scripts/check-module-boundaries.mjs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hris-modules-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  function tulis(path: string, isi: string) {
    const p = join(dir, path);
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSync(p, isi);
  }

  it('lolos untuk impor yang sah', () => {
    tulis('attendance/server/clock.ts', [
      "import { attendanceTable } from '@petshop/hris-db/schema/attendance';",
      "import { jobRuns } from '@petshop/hris-db/schema/shared';",
      "import { hitung } from '../rules/hitung';",
      "import { payroll } from '@/modules/payroll';",
    ].join('\n'));
    expect(findViolations(dir)).toEqual([]);
  });

  it('menolak impor relatif keluar modul, root hris-db, dan schema modul lain', () => {
    tulis('payroll/server/run.ts', [
      "import { x } from '../../attendance/server/clock';",
      "import { db } from '@petshop/hris-db';",
      "export { attendanceTable } from '@petshop/hris-db/schema/attendance';",
      "const m = await import('../../attendance/rules/hitung');",
    ].join('\n'));
    const hasil = findViolations(dir);
    expect(hasil).toHaveLength(4);
    expect(hasil.every((p) => p.startsWith('payroll/server/run.ts'))).toBe(true);
  });
});

describe('eslint.config.mjs apps/hris', () => {
  const eslint = new ESLint({ cwd: appDir });

  async function pesan(kode: string) {
    const [hasil] = await eslint.lintText(kode, { filePath: join(appDir, 'modules/payroll/server/run.ts') });
    return hasil.messages.filter((m) => m.ruleId === '@typescript-eslint/no-restricted-imports');
  }

  it('menolak impor ke dalam modul lain dan tabel petshop', async () => {
    const kode = [
      "import { a } from '@/modules/attendance/server/clock';",
      "import { products } from '@petshop/db';",
      'export const x = [a, products];',
    ].join('\n');
    expect(await pesan(kode)).toHaveLength(2);
  }, 30_000);

  it('membolehkan impor lewat pintu modul', async () => {
    const kode = "import { a } from '@/modules/attendance';\nexport const x = a;";
    expect(await pesan(kode)).toHaveLength(0);
  }, 30_000);
});
