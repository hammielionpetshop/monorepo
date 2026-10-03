import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ send: vi.fn(), insert: vi.fn(), select: vi.fn() }));
vi.mock('crypto', () => ({ randomInt: () => 123 }));
vi.mock('argon2', () => ({ hash: async () => 'hashed-otp' }));
vi.mock('../customer-auth', () => ({ signCustomerToken: vi.fn() }));
vi.mock('../db', () => ({
  db: { select: mocks.select, insert: () => ({ values: mocks.insert }) },
  customers: {}, customerAuth: {}, customerOtpCodes: {},
  eq: vi.fn(), and: vi.fn(), gt: vi.fn(), desc: vi.fn(), isNull: vi.fn(),
}));
vi.mock('@petshop/shared', async (importOriginal) => ({
  ...await importOriginal<typeof import('@petshop/shared')>(),
  createOtpChannel: () => ({ send: mocks.send }),
}));

import { requestOtp } from './otp-service';

describe('console OTP display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.send.mockResolvedValue({ ok: true });
    mocks.insert.mockResolvedValue(undefined);
    mocks.select
      .mockReturnValueOnce({ from: () => ({ where: () => ({ orderBy: async () => [] }) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: async () => [{ id: 11 }] }) }) });
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ['development', 'console'], ['development', ''], ['production', 'console'], ['production', ''],
  ])('returns the generated OTP in %s with provider %s', async (environment, provider) => {
    vi.stubEnv('NODE_ENV', environment);
    vi.stubEnv('OTP_PROVIDER', provider);
    const result = await requestOtp('085223666617');
    expect(result).toEqual({ ok: true, devOtp: '000123' });
    expect(mocks.send).toHaveBeenCalledWith('+6285223666617', '000123');
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ codeHash: 'hashed-otp' }));
  });

  it.each([
    ['development', 'waha'], ['production', 'waha'],
  ])('does not expose OTP in %s with provider %s', async (environment, provider) => {
    vi.stubEnv('NODE_ENV', environment);
    vi.stubEnv('OTP_PROVIDER', provider);
    expect(await requestOtp('085223666617')).toEqual({ ok: true });
  });

  it('does not generate or expose a code for a customer without online access', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('OTP_PROVIDER', 'console');
    mocks.select.mockReset()
      .mockReturnValueOnce({ from: () => ({ where: () => ({ orderBy: async () => [] }) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: async () => [] }) }) });
    expect(await requestOtp('085223666617')).toEqual({ ok: true });
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('does not expose OTP when sending fails', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('OTP_PROVIDER', 'console');
    mocks.send.mockResolvedValue({ ok: false });
    expect(await requestOtp('085223666617')).toMatchObject({ ok: false, reason: 'SEND_FAILED' });
  });
});
