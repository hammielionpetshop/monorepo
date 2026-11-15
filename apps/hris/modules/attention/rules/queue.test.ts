import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { QUEUE_KINDS, buildQueue, remindsApprover, type AttentionCard } from './queue';

const card = (key: string, over: Partial<AttentionCard> = {}): AttentionCard => ({
  key, title: `Kartu ${key}`, href: `/${key}`, queue: { group: 'TASK' }, ...over,
});

describe('buildQueue: antrean berantai (spec F3-1 §7, TAM-22)', () => {
  it('urut kelompok darurat → aturan → tugas, lalu yang terlama dulu', () => {
    const cards = [
      card('requests', { queue: { group: 'TASK', oldestAt: '2026-11-10T01:00:00Z' } }),
      card('overdue', { queue: { group: 'TASK', oldestAt: '2026-11-08T01:00:00Z' } }),
    ];
    expect(buildQueue(cards, new Set()).map((item) => item.kind)).toEqual(['overdue', 'requests']);
  });

  it('jenis yang sudah tampil hari ini tidak kembali; hari berganti (catatan kosong) tampil lagi', () => {
    const cards = [card('requests'), card('overdue')];
    expect(buildQueue(cards, new Set(['requests'])).map((item) => item.kind)).toEqual(['overdue']);
    expect(buildQueue(cards, new Set()).map((item) => item.kind)).toEqual(['requests', 'overdue']);
  });

  it('kartu tanpa tanda queue atau jenis tak terdaftar tidak menjadi jendela', () => {
    const cards = [card('requests', { queue: undefined }), card('training')];
    expect(buildQueue(cards, new Set())).toEqual([]);
  });

  it('judul dan rincian jendela boleh berbeda dari kartu Beranda', () => {
    const [item] = buildQueue([card('requests', { detail: 'Paling lama 2 hari', queue: { group: 'TASK', title: 'Judul jendela' } })], new Set());
    expect(item).toMatchObject({ title: 'Judul jendela', detail: 'Paling lama 2 hari', href: '/requests' });
  });
});

describe('remindsApprover: B1 baru muncul sesudah batas pengingat', () => {
  it('kurang dari 1 hari belum, 1 hari atau lebih sudah', () => {
    expect(remindsApprover(0, 1)).toBe(false);
    expect(remindsApprover(1, 1)).toBe(true);
    expect(remindsApprover(2, 3)).toBe(false);
  });
});

describe('QUEUE_KINDS', () => {
  it('setiap kunci dihasilkan perangkai dengan tanda queue', () => {
    const source = readFileSync(fileURLToPath(new URL('../server/cards.ts', import.meta.url)), 'utf8');
    for (const kind of Object.keys(QUEUE_KINDS)) {
      const at = source.indexOf(`key: '${kind}'`);
      expect(at, kind).toBeGreaterThan(-1);
      expect(source.slice(at, at + 600), kind).toContain('queue:');
    }
  });
});
