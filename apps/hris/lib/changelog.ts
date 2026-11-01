/**
 * Changelog HRIS (permintaan owner 2026-11-01): `apps/hris/CHANGELOG.md` berisi versi yang sudah rilis
 * produksi; `apps/hris/changelog.d/*.md` berisi potongan yang sudah tayang staging tetapi belum dirilis.
 * Format sama dengan kasir: `## [x.y.z] - YYYY-MM-DD`, `### Added|Changed|Fixed|Removed`, `- butir`.
 */

export const SECTION_LABELS: Record<string, string> = {
  Added: 'Baru',
  Changed: 'Diubah',
  Fixed: 'Diperbaiki',
  Removed: 'Dihapus',
};

export type ChangelogItem = { text: string; children: string[] };
export type ChangelogSection = { name: string; items: ChangelogItem[] };
export type ChangelogVersion = { version: string; date: string; sections: ChangelogSection[] };

/** Pecah teks markdown changelog menjadi versi → bagian → butir (butir anak dari baris "  - "). */
export function parseChangelog(markdown: string): ChangelogVersion[] {
  const versions: ChangelogVersion[] = [];
  let version: ChangelogVersion | null = null;
  let section: ChangelogSection | null = null;
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const head = line.match(/^##\s+\[(.+?)\]\s*-\s*(.+)$/);
    if (head) {
      version = { version: head[1], date: head[2].trim(), sections: [] };
      versions.push(version);
      section = null;
      continue;
    }
    const sub = line.match(/^###\s+(.+)$/);
    if (sub && version) {
      section = { name: sub[1].trim(), items: [] };
      version.sections.push(section);
      continue;
    }
    if (!section) continue;
    const child = line.match(/^\s{2,}-\s+(.+)$/);
    const item = line.match(/^-\s+(.+)$/);
    const last = section.items[section.items.length - 1];
    if (item) section.items.push({ text: item[1], children: [] });
    else if (child && last) last.children.push(child[1]);
    else if (line.trim() && last) {
      // Baris sambungan butir yang dipatah.
      if (last.children.length) last.children[last.children.length - 1] += ` ${line.trim()}`;
      else last.text += ` ${line.trim()}`;
    }
  }
  return versions;
}

/** Potongan changelog.d (tanpa heading versi) digabung per bagian, urut Added → Changed → Fixed → Removed. */
export function mergeFragments(fragments: readonly string[]): ChangelogSection[] {
  const merged = new Map<string, ChangelogItem[]>();
  for (const fragment of fragments) {
    const [version] = parseChangelog(`## [x] - x\n${fragment}`);
    for (const section of version?.sections ?? []) {
      merged.set(section.name, [...(merged.get(section.name) ?? []), ...section.items]);
    }
  }
  const order = Object.keys(SECTION_LABELS);
  return [...merged.entries()]
    .sort(([a], [b]) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99))
    .map(([name, items]) => ({ name, items }));
}

export type InlinePart = { kind: 'text' | 'strong' | 'code'; text: string };

/** `**tebal**` dan `` `kode` `` menjadi potongan bertipe; sisanya teks biasa (tanpa HTML mentah). */
export function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const pattern = /\*\*(.+?)\*\*|`(.+?)`/g;
  let last = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > last) parts.push({ kind: 'text', text: text.slice(last, match.index) });
    parts.push(match[1] !== undefined ? { kind: 'strong', text: match[1] } : { kind: 'code', text: match[2] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
  return parts;
}
