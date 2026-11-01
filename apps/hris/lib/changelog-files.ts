import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fragmentsNewestFirst, parseChangelog, type ChangelogUpdate, type ChangelogVersion } from './changelog';

/**
 * Baca changelog HRIS dari disk. `process.cwd()` = folder apps/hris, baik saat dev maupun di image
 * (WORKDIR /app/apps/hris); kedua berkas ikut bundel lewat `outputFileTracingIncludes` di next.config.
 */
export async function readHrisChangelog(): Promise<{ released: ChangelogVersion[]; unreleased: ChangelogUpdate[] }> {
  const root = process.cwd();
  const released = await fs.readFile(path.join(root, 'CHANGELOG.md'), 'utf8').then(parseChangelog, () => []);
  const dir = path.join(root, 'changelog.d');
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  const fragments = await Promise.all(
    names
      .filter((name) => name.endsWith('.md') && name !== 'README.md' && !name.startsWith('_'))
      .sort()
      .map((name) => fs.readFile(path.join(dir, name), 'utf8')),
  );
  return { released, unreleased: fragmentsNewestFirst(fragments) };
}
