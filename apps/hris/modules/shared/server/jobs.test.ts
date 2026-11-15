import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/jobs/[name]/route';
import { jobs } from './jobs';

const store = vi.hoisted(() => ({
  insert: vi.fn(), values: vi.fn(), returning: vi.fn(),
  update: vi.fn(), set: vi.fn(), where: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: { insert: store.insert, update: store.update } }));

const heartbeat = jobs.get('heartbeat')!;

function request(name = 'heartbeat', key: string | null = 'test-job-secret') {
  return POST(new Request('http://localhost/api/jobs/' + name, {
    method: 'POST', headers: key === null ? {} : { 'x-job-key': key },
  }), { params: Promise.resolve({ name }) });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('JOB_SECRET', 'test-job-secret');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  store.insert.mockReturnValue({ values: store.values });
  store.values.mockReturnValue({ returning: store.returning });
  store.returning.mockResolvedValue([{ id: 41 }]);
  store.update.mockReturnValue({ set: store.set });
  store.set.mockReturnValue({ where: store.where });
  store.where.mockResolvedValue(undefined);
  jobs.set('heartbeat', heartbeat);
});

afterEach(() => {
  jobs.set('heartbeat', heartbeat);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('POST /api/jobs/[name]', () => {
  it.each([null, '', 'wrong', 'test-job-secreu'])('menolak kunci hilang/salah (%s) tanpa menulis DB', async (key) => {
    expect((await request('heartbeat', key)).status).toBe(401);
    expect(store.insert).not.toHaveBeenCalled();
  });

  it('menolak bila JOB_SECRET belum diisi, termasuk bila header kosong', async () => {
    vi.stubEnv('JOB_SECRET', '');
    expect((await request('heartbeat', '')).status).toBe(401);
    expect((await request()).status).toBe(401);
    vi.stubEnv('JOB_SECRET', undefined);
    expect((await request()).status).toBe(401);
    expect(store.insert).not.toHaveBeenCalled();
  });

  it.each(['unknown', 'toString', 'constructor', '__proto__'])('mengembalikan 404 untuk nama asing %s', async (name) => {
    expect((await request(name)).status).toBe(404);
    expect(store.insert).not.toHaveBeenCalled();
  });

  it('mencatat RUNNING lalu SUCCEEDED, dan heartbeat aman dipanggil ulang', async () => {
    store.returning.mockResolvedValueOnce([{ id: 41 }]).mockResolvedValueOnce([{ id: 42 }]);
    const first = await request();
    const second = await request();
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await first.json()).toEqual({ id: 41, status: 'SUCCEEDED', summary: { timestamp: expect.any(String) } });
    expect(await second.json()).toMatchObject({ id: 42, status: 'SUCCEEDED' });
    expect(store.values.mock.calls).toEqual([
      [{ name: 'heartbeat', status: 'RUNNING' }], [{ name: 'heartbeat', status: 'RUNNING' }],
    ]);
    expect(store.set).toHaveBeenCalledTimes(2);
    expect(store.set).toHaveBeenLastCalledWith({
      status: 'SUCCEEDED', finishedAt: expect.any(Date), summary: { timestamp: expect.any(String) },
    });
    expect(store.update).toHaveBeenCalledTimes(2);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('mencatat kegagalan pekerjaan dengan waktu selesai dan tidak membocorkan error pada respons', async () => {
    jobs.set('heartbeat', async () => {
      expect(store.values).toHaveBeenCalledWith({ name: 'heartbeat', status: 'RUNNING' });
      throw new Error('Detail internal pekerjaan');
    });
    const response = await request();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Pekerjaan gagal dijalankan.' });
    expect(store.set).toHaveBeenCalledTimes(1);
    expect(store.set).toHaveBeenCalledWith({
      status: 'FAILED', finishedAt: expect.any(Date), error: 'Detail internal pekerjaan',
    });
    expect(console.error).toHaveBeenCalled();
  });

  it('tetap mencatat kegagalan yang dilempar sebagai teks', async () => {
    jobs.set('heartbeat', async () => { throw 'Pekerjaan ditolak'; });
    expect((await request()).status).toBe(500);
    expect(store.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'FAILED', error: 'Pekerjaan ditolak' }));
  });

  it('tidak menjalankan pekerjaan bila catatan RUNNING gagal disimpan', async () => {
    const job = vi.fn(heartbeat);
    jobs.set('heartbeat', job);
    store.returning.mockRejectedValue(new Error('DB tidak terjangkau'));
    expect((await request()).status).toBe(500);
    expect(job).not.toHaveBeenCalled();
    expect(store.update).not.toHaveBeenCalled();
  });

  it('tidak melaporkan sukses bila hasil eksekusi gagal disimpan', async () => {
    store.where.mockRejectedValue(new Error('DB terputus saat menyimpan hasil'));
    expect((await request()).status).toBe(500);
  });
});
