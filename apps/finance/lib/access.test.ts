import { describe, expect, it } from 'vitest';
import { hashSessionToken, sessionCookieOptions } from '@petshop/auth';
import { sessionCookieName, sessionTokenHash } from './access';

describe('Sesi auth pusat dibaca Finance', () => {
  it('nama cookie & hash token sama dengan @petshop/auth', () => {
    expect(sessionCookieName('staging')).toBe(sessionCookieOptions({ environment: 'staging', domain: '.staginghml.my.id' }).name);
    expect(sessionCookieName('local')).toBe(sessionCookieOptions({ environment: 'local' }).name);
    expect(sessionCookieName('lain')).toBeNull();
    const token = 'a'.repeat(43);
    expect(sessionTokenHash(token)).toBe(hashSessionToken(token));
  });
});
