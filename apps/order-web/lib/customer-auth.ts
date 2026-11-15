import { SignJWT, jwtVerify } from 'jose';
import { CustomerJWTPayload } from '@petshop/shared';

function requiredSecret() {
  const secret = process.env.CUSTOMER_JWT_SECRET;

  if (!secret) {
    throw new Error('CUSTOMER_JWT_SECRET belum dikonfigurasi');
  }

  return new TextEncoder().encode(secret);
}

export async function signCustomerToken(payload: CustomerJWTPayload) {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(requiredSecret());
}

export async function verifyCustomerToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, requiredSecret());
    return payload as unknown as CustomerJWTPayload;
  } catch {
    return null;
  }
}
