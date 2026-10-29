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

  function writeFixture(path: string, content: string) {
    const fullPath = join(dir, path);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, content);
  }

  it('lolos untuk impor yang sah', () => {
    writeFixture('attendance/server/clock.ts', [
      "import { attendanceTable } from '@petshop/hris-db/schema/attendance';",
      "import { jobRuns } from '@petshop/hris-db/schema/shared';",
      "import { calculate } from '../rules/calculate';",
      "import { payroll } from '@/modules/payroll';",
    ].join('\n'));
    expect(findViolations(dir)).toEqual([]);
  });

  it('menolak impor relatif keluar modul, root hris-db, dan schema modul lain', () => {
    writeFixture('payroll/server/run.ts', [
      "import { x } from '../../attendance/server/clock';",
      "import { db } from '@petshop/hris-db';",
      "export { attendanceTable } from '@petshop/hris-db/schema/attendance';",
      "const m = await import('../../attendance/rules/calculate');",
    ].join('\n'));
    const violations = findViolations(dir);
    expect(violations).toHaveLength(4);
    expect(violations.every((violation) => violation.startsWith('payroll/server/run.ts'))).toBe(true);
  });
});

describe('eslint.config.mjs apps/hris', () => {
  const eslint = new ESLint({ cwd: appDir });

  async function restrictedImportMessages(code: string) {
    const [result] = await eslint.lintText(code, { filePath: join(appDir, 'modules/payroll/server/run.ts') });
    return result.messages.filter((message) => message.ruleId === '@typescript-eslint/no-restricted-imports');
  }

  it('menolak impor ke dalam modul lain dan tabel petshop', async () => {
    const code = [
      "import { a } from '@/modules/attendance/server/clock';",
      "import { products } from '@petshop/db';",
      'export const x = [a, products];',
    ].join('\n');
    expect(await restrictedImportMessages(code)).toHaveLength(2);
  }, 30_000);

  it('membolehkan impor lewat pintu modul', async () => {
    const code = "import { a } from '@/modules/attendance';\nexport const x = a;";
    expect(await restrictedImportMessages(code)).toHaveLength(0);
  }, 30_000);
});
