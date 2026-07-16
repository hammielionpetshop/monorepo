import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifyCustomerToken } from '@/lib/customer-auth';
import type { CustomerJWTPayload } from '@petshop/shared';

// Middleware sudah menggerbang route ini, tapi tak meneruskan payload — verifikasi ulang di sini
// untuk dapat customerId/tierType (pola sama dengan verifyAccessToken di backoffice).
export async function requireCustomer(): Promise<CustomerJWTPayload | NextResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get('customerToken')?.value;
  const payload = token ? await verifyCustomerToken(token) : null;

  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 });
  }

  return payload;
}
