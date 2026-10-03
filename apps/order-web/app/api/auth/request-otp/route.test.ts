import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requestOtp: vi.fn() }));
vi.mock('@/lib/services/otp-service', () => ({ requestOtp: mocks.requestOtp }));

import { POST } from './route';

describe('request OTP response', () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ['development', 'console', true],
    ['production', 'console', false],
    ['development', 'waha', false],
  ])('exposes development code only in %s with %s', async (environment, provider, exposed) => {
    vi.stubEnv('NODE_ENV', environment);
    vi.stubEnv('OTP_PROVIDER', provider);
    mocks.requestOtp.mockResolvedValue({ ok: true, devOtp: '000123' });
    const res = await POST(new Request('http://localhost/api/auth/request-otp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '085223666617' }),
    }));
    const body = await res.json();
    expect(res.status).toBe(200);
    if (exposed) expect(body.devOtp).toBe('000123');
    else expect(body).not.toHaveProperty('devOtp');
  });
});
