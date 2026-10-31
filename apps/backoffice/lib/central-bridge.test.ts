import { describe, expect, it } from 'vitest';
import { BRIDGE_MAX_MS, getBridgeDeadline } from './central-bridge';

const now = new Date('2026-11-10T00:00:00.000Z');
const at = (ms: number) => new Date(now.getTime() + ms).toISOString();

describe('tenggat jembatan token lama', () => {
  it('kosong atau tidak valid menutup jembatan', () => {
    expect(getBridgeDeadline(now, undefined)).toBeNull();
    expect(getBridgeDeadline(now, '  ')).toBeNull();
    expect(getBridgeDeadline(now, 'besok')).toBeNull();
  });
  it('sudah lewat atau sama dengan sekarang menutup jembatan', () => {
    expect(getBridgeDeadline(now, at(-1))).toBeNull();
    expect(getBridgeDeadline(now, at(0))).toBeNull();
  });
  it('lebih dari 7 hari ke depan menutup jembatan (gagal tertutup)', () => {
    expect(getBridgeDeadline(now, at(BRIDGE_MAX_MS + 1))).toBeNull();
  });
  it('di dalam 7 hari membuka jembatan', () => {
    expect(getBridgeDeadline(now, at(60_000))?.toISOString()).toBe(at(60_000));
    expect(getBridgeDeadline(now, at(BRIDGE_MAX_MS))).not.toBeNull();
  });
});
