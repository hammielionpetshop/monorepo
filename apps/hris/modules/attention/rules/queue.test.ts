import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { NO_RECIPIENT, ONCE_GROUPS, ONCE_KINDS, QUEUE_KINDS, buildOnceQueue, buildQueue, parseOnceKind, daysUntil, remindsApprover, routeForTop, type AttentionCard } from './queue';

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
    const cards = [card('requests', { queue: undefined }), card('pending-notes')];
    expect(buildQueue(cards, new Set())).toEqual([]);
  });

  it('judul dan rincian jendela boleh berbeda dari kartu Beranda', () => {
    const [item] = buildQueue([card('requests', { detail: 'Paling lama 2 hari', queue: { group: 'TASK', title: 'Judul jendela' } })], new Set());
    expect(item).toMatchObject({ title: 'Judul jendela', detail: 'Paling lama 2 hari', href: '/requests' });
  });
});

describe('buildQueue: jenis gabungan (spec F3-4 §2 butir 1, §4)', () => {
  const trip = (id: number, date: string) => card(`trip-hanging-${id}`, {
    href: `/logistics/trips/${id}`, tone: 'danger', queue: { kind: 'trip-hanging', oldestAt: date },
  });

  it('kartu berkunci nomor dengan jenis sama menjadi satu jendela, jumlah dan yang terlama benar', () => {
    const items = buildQueue([trip(7, '2026-11-27'), trip(3, '2026-11-26'), trip(9, '2026-11-28')], new Set());
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'trip-hanging', group: 'TASK', title: 'Ada 3 trip belum Sampai Garasi.', href: '/logistics/trips?tab=hanging', tone: 'danger' });
    expect(items[0].detail).toBe('Yang paling lama sejak 26 Nov.');
  });

  it('satu kartu saja memakai judul kartunya; kelompok diambil dari daftar jenis', () => {
    const [item] = buildQueue([card('letter-12', { queue: { kind: 'doctor-letter' } })], new Set());
    expect(item).toMatchObject({ kind: 'doctor-letter', group: 'TASK', title: 'Kartu letter-12', href: '/letter-12' });
  });

  it('jenis yang sudah di-OK hari ini tidak kembali walau kartunya bertambah', () => {
    expect(buildQueue([trip(1, '2026-11-26'), trip(2, '2026-11-27')], new Set(['trip-hanging']))).toEqual([]);
  });

  it('beberapa kartu berbeda dengan jenis sama (kasbon diperiksa + diputuskan) menjadi satu jendela', () => {
    const items = buildQueue([
      card('advance-review', { title: '2 kasbon menunggu diperiksa', queue: { kind: 'advance-waiting' } }),
      card('advance-decide', { title: '1 kasbon menunggu diputuskan', queue: { kind: 'advance-waiting' } }),
    ], new Set());
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('2 kasbon menunggu diperiksa · 1 kasbon menunggu diputuskan');
  });
});

describe('kartu baru dari pengingat lonceng (spec F3-4 §5)', () => {
  it('dua periode slip belum ditutup menjadi satu jendela ke daftar periode', () => {
    const items = buildQueue([
      card('payslip-held-2026-10-26', { tone: 'danger', queue: { kind: 'payslip-held', oldestAt: '2026-11-28T17:00:00Z' } }),
      card('payslip-held-W2026-11-20', { queue: { kind: 'payslip-held', oldestAt: '2026-11-26T03:00:00Z' } }),
    ], new Set());
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'payslip-held', title: 'Ada 2 periode slip belum ditutup.', href: '/payroll/periods', tone: 'danger' });
  });

  it('slip belum Dibayar dan Laporan Pulang memang untuk penerimanya, tidak disaring untuk Pemilik/GM', () => {
    const unpaid = card('payslip-unpaid', { queue: { kind: 'payslip-unpaid' } });
    const held = card('payslip-held-2026-10-26', { queue: { kind: 'payslip-held' } });
    expect(routeForTop([unpaid, held], true, () => true)).toEqual([unpaid, held]);
  });
});

describe('routeForTop: naik ke Pemilik/GM (spec F3-4 §2 butir 3)', () => {
  const points = card('store-points', { title: '2 titik toko menunggu persetujuan', queue: { kind: 'store-points' } });
  const trip = card('trip-hanging-1', { queue: { kind: 'trip-hanging' } });

  it('bukan akses penuh: kartu tidak diubah', () => {
    expect(routeForTop([points], false, () => false)).toEqual([points]);
  });

  it('penerima ada: Pemilik/GM tetap melihat kartu, tanpa jendela', () => {
    const [routed] = routeForTop([points], true, () => true);
    expect(routed.queue).toBeUndefined();
    expect(routed.title).toBe(points.title);
  });

  it('penerima tidak ada / cuti: kartu dan jendela naik dengan tanda', () => {
    const [routed] = routeForTop([points], true, () => false);
    expect(routed.title).toBe(`2 titik toko menunggu persetujuan ${NO_RECIPIENT}`);
    expect(buildQueue([routed], new Set())[0].title).toContain(NO_RECIPIENT);
  });

  it('jenis yang memang untuk Pemilik/GM, atau kartu bertanda top, tidak disaring', () => {
    const late = card('objection-late', { queue: { kind: 'objection', top: true } });
    expect(routeForTop([trip, late], true, () => true)).toEqual([trip, late]);
  });
});

describe('remindsApprover: B1 baru muncul sesudah batas pengingat', () => {
  it('kurang dari 1 hari belum, 1 hari atau lebih sudah', () => {
    expect(remindsApprover(0, 1)).toBe(false);
    expect(remindsApprover(1, 1)).toBe(true);
    expect(remindsApprover(2, 3)).toBe(false);
  });
});

describe('daysUntil', () => {
  it('menghitung sisa hari tanggal WIB', () => {
    expect(daysUntil('2026-11-28', '2026-11-29')).toBe(1);
    expect(daysUntil('2026-11-28', '2026-11-28')).toBe(0);
    expect(daysUntil('2026-11-28', '2026-11-25')).toBe(-3);
  });
});

describe('QUEUE_KINDS', () => {
  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
  const sources = [
    '../server/cards.ts', '../../attendance/server/absence.ts', '../../attendance/server/days-off.ts',
    '../../attendance/server/clarification.ts', '../../attendance/server/overtime.ts',
  ].map(read).join('\n');

  it('setiap jenis dihasilkan perangkai atau modulnya dengan tanda queue', () => {
    for (const kind of Object.keys(QUEUE_KINDS)) {
      const at = Math.max(sources.indexOf(`kind: '${kind}'`), sources.indexOf(`key: '${kind}'`));
      expect(at, kind).toBeGreaterThan(-1);
      const around = sources.slice(Math.max(0, at - 600), at + 600);
      expect(around, kind).toContain('queue');
    }
  });

  it('kartu yang tetap di Perlu perhatian saja (spec F3-4 §3.2) tidak terdaftar', () => {
    for (const key of ['weekly-pay', 'my-pay', 'trip-wage-look', 'unloading-look', 'unloading-weights', 'pending-notes', 'deposit-check',
      'deposit-record', 'short-handover', 'kasir-changed', 'self-late', 'self-cash-late', 'money-check', 'advance-weekly', 'fence-off']) {
      expect(key in QUEUE_KINDS, key).toBe(false);
    }
  });
});

describe('buildOnceQueue: antrean sekali baca (spec F3-4 §6)', () => {
  const note = (id: number, kind: string, createdAt: string, link: string | null = null) => ({ id, kind, title: `Kabar ${id}`, body: null, link, createdAt });

  it('satu jendela per kelompok, urut Tabel C, kabar terlama dulu; jenis lain diabaikan', () => {
    const items = buildOnceQueue([
      note(3, 'attendance.shift', '2026-11-27T02:00:00Z'),
      note(2, 'salary.changed', '2026-11-28T02:00:00Z'),
      note(1, 'bonus.rejected', '2026-11-26T02:00:00Z'),
      note(4, 'request.created', '2026-11-25T02:00:00Z'),
    ]);
    expect(items.map((item) => item.kind)).toEqual(['once:pay', 'once:schedule']);
    expect(items[0]).toMatchObject({ group: 'ONCE', title: 'Gaji dan potongan saya berubah: 2 kabar', href: '/notifications' });
    expect(items[0].notes!.map((n) => n.id)).toEqual([1, 2]);
  });

  it('satu kabar bertautan → Buka langsung ke tautannya', () => {
    expect(buildOnceQueue([note(9, 'logistics.assigned', '2026-11-28T02:00:00Z', '/my-trips')])[0].href).toBe('/my-trips');
  });

  it('jenis jendela sekali baca dikenali, yang lain tidak', () => {
    expect(parseOnceKind('once:rights')).toBe('rights');
    expect(parseOnceKind('once:lain')).toBeNull();
    expect(parseOnceKind('requests')).toBeNull();
  });

  it('setiap jenis sekali baca memang dikirim oleh kode modul, dan tidak ganda antar kelompok', () => {
    expect(new Set(ONCE_KINDS).size).toBe(ONCE_KINDS.length);
    expect(Object.keys(ONCE_GROUPS)).toEqual(['pay', 'schedule', 'rights']);
    const root = fileURLToPath(new URL('../../', import.meta.url));
    const sources = (readdirSync(root, { recursive: true }) as string[])
      .filter((file) => /server[\\/][^\\/]+\.ts$/.test(file) && !file.includes('.test.'))
      .map((file) => readFileSync(`${root}${file}`, 'utf8')).join('\n');
    for (const kind of ONCE_KINDS) expect(sources.includes(`'${kind}'`), kind).toBe(true);
  });
});
