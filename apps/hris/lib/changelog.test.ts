import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fragmentPublishedAt, fragmentsNewestFirst, mergeFragments, parseChangelog, parseInline } from './changelog';
import { NEW_FEATURES, activeNewFeatures } from './new-features';
import { NAV_GROUPS } from './nav';

describe('changelog HRIS', () => {
  it('memecah versi, bagian, butir, butir anak, dan baris sambungan', () => {
    const versions = parseChangelog([
      '# Changelog', '', '## [0.2.0] - 2026-12-01', '', '### Added', '- **Satu.** Penjelasan', '  - anak',
      '- Dua yang', '  dipatah', '', '### Fixed', '- Tiga', '', '## [0.1.0] - 2026-11-20', '### Changed', '- Empat',
    ].join('\n'));
    expect(versions.map((v) => [v.version, v.date])).toEqual([['0.2.0', '2026-12-01'], ['0.1.0', '2026-11-20']]);
    expect(versions[0].sections[0]).toEqual({
      name: 'Added', items: [{ text: '**Satu.** Penjelasan', children: ['anak'] }, { text: 'Dua yang dipatah', children: [] }],
    });
    expect(versions[0].sections[1].items[0].text).toBe('Tiga');
  });

  it('potongan digabung per bagian dengan urutan Added → Changed → Fixed → Removed', () => {
    const merged = mergeFragments(['### Fixed\n- F1\n', '### Added\n- A1\n### Fixed\n- F2\n', '### Changed\r\n- C1\r\n']);
    expect(merged.map((s) => [s.name, s.items.map((i) => i.text)])).toEqual([
      ['Added', ['A1']], ['Changed', ['C1']], ['Fixed', ['F1', 'F2']],
    ]);
  });

  it('update terbaru paling atas, termasuk di hari yang sama; tanpa waktu tayang di paling bawah', () => {
    const updates = fragmentsNewestFirst([
      '### Added\n- Tanpa waktu\n',
      '<!-- tayang: 2026-11-01 20:23 -->\n### Added\n- Pagi\n',
      '<!-- tayang: 2026-11-02 08:00 -->\r\n### Added\r\n- Besok\r\n',
      '<!-- tayang: 2026-11-01 21:45 -->\n### Fixed\n- Malam\n',
    ]);
    expect(updates.map((u) => [u.publishedAt, u.sections[0].items[0].text])).toEqual([
      ['2026-11-02 08:00', 'Besok'], ['2026-11-01 21:45', 'Malam'], ['2026-11-01 20:23', 'Pagi'], [null, 'Tanpa waktu'],
    ]);
  });

  it('semua potongan HRIS punya waktu tayang', () => {
    const dir = new URL('../changelog.d/', import.meta.url);
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md')) {
      expect(fragmentPublishedAt(readFileSync(new URL(file, dir), 'utf8')), file).not.toBeNull();
    }
  });

  it('teks tebal dan kode dipecah tanpa HTML mentah', () => {
    expect(parseInline('a **b** `c` <script>')).toEqual([
      { kind: 'text', text: 'a ' }, { kind: 'strong', text: 'b' }, { kind: 'text', text: ' ' },
      { kind: 'code', text: 'c' }, { kind: 'text', text: ' <script>' },
    ]);
  });

  it('potongan di changelog.d bisa dibaca dan tidak kosong', () => {
    const dir = new URL('../changelog.d/', import.meta.url);
    const files = readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md');
    const merged = mergeFragments(files.map((f) => readFileSync(new URL(f, dir), 'utf8')));
    expect(merged.length).toBeGreaterThan(0);
  });
});

describe('tanda Baru', () => {
  const features = { '/a': '2026-11-01', '/b': '2026-11-10', 'fitur/c': '2026-10-20' };

  it('tampil sejak tanggalnya selama lama tampil, lalu hilang; yang belum tiba tidak tampil', () => {
    expect(activeNewFeatures(features, '2026-11-01', 7)).toEqual(['/a']);
    expect(activeNewFeatures(features, '2026-11-07', 7)).toEqual(['/a']);
    expect(activeNewFeatures(features, '2026-11-08', 7)).toEqual([]);
    expect(activeNewFeatures(features, '2026-11-10', 1)).toEqual(['/b']);
    expect(activeNewFeatures(features, '2026-11-01', 30)).toEqual(['/a', 'fitur/c']);
  });

  it('daftar: tanggal sah, dan kunci berawalan "/" adalah menu yang ada', () => {
    const hrefs = new Set(NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href)));
    for (const [key, date] of Object.entries(NEW_FEATURES)) {
      expect(date, key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(key.startsWith('/') ? hrefs.has(key) : key.startsWith('fitur/'), key).toBe(true);
    }
  });
});
