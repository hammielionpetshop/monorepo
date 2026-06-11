import { SignJWT, jwtVerify } from 'jose';
import { JWTPayload } from '@petshop/shared';

function requiredSecret(name: 'JWT_SECRET' | 'JWT_REFRESH_SECRET') {
  const secret = process.env[name];

  if (!secret) {
    throw new Error(`${name} belum dikonfigurasi`);
  }

  return new TextEncoder().encode(secret);
}

export async function signAccessToken(payload: JWTPayload) {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d') // Access token for 1 day as per requirement (flexible)
    .sign(requiredSecret('JWT_SECRET'));
}

export async function signRefreshToken(payload: { userId: number }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(requiredSecret('JWT_REFRESH_SECRET'));
}

export async function verifyAccessToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, requiredSecret('JWT_SECRET'));
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}
