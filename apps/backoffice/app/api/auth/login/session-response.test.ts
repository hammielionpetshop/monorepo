import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createLoginResponse } from './session-response';

describe('createLoginResponse', () => {
  it('sets HTTP-only token cookies without exposing tokens in JSON', async () => {
    const response = createLoginResponse(
      { id: 1, name: 'Admin', role: 'OWNER', branch: 'Pusat' },
      'access-token-rahasia',
      'refresh-token-rahasia'
    );

    const body = await response.json();
    const setCookie = response.headers.getSetCookie().join('\n');

    expect(body).toEqual({
      user: { id: 1, name: 'Admin', role: 'OWNER', branch: 'Pusat' },
    });
    expect(JSON.stringify(body)).not.toContain('access-token-rahasia');
    expect(JSON.stringify(body)).not.toContain('refresh-token-rahasia');
    expect(setCookie).toContain('accessToken=access-token-rahasia');
    expect(setCookie).toContain('refreshToken=refresh-token-rahasia');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=lax');
  });

  it('login route delegates token delivery to secure cookie response helper', () => {
    const routeSource = readFileSync(join(__dirname, 'route.ts'), 'utf8');

    expect(routeSource).toContain('createLoginResponse');
    expect(routeSource).not.toContain('return NextResponse.json({\n      user:');
    expect(routeSource).not.toContain('      accessToken,\n      refreshToken,');
  });
});
